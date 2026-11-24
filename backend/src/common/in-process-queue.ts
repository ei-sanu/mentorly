import { Logger } from './logger';

/**
 * In-process replacement for the two BullMQ queues (embeddings + emails).
 *
 * BullMQ needs a Redis server — that was the Upstash dependency. This
 * queue runs the same processor functions in this Node process, with
 * the same concurrency and retry shape the BullMQ workers had:
 *   - embeddings: concurrency 2, 3 attempts, exponential backoff 10s
 *   - emails:      concurrency 3, 5 attempts, exponential backoff 5s
 *
 * Trade-off: jobs are NOT durable. If the process crashes mid-job the
 * job is lost (BullMQ persisted jobs in Redis). For this single-instance
 * server that is acceptable; a failed job is logged, not silently
 * dropped, and the caller-facing methods keep their exact signatures
 * so students/mentors services needed no changes.
 */

export interface AddOptions {
  attempts?: number;
  backoff?: { type: 'exponential'; delay: number };
}

interface PendingJob<T> {
  name: string;
  data: T;
  options: Required<AddOptions>;
}

export class InProcessQueue<T extends Record<string, unknown>> {
  private readonly logger = new Logger(`InProcessQueue:${this.name}`);
  private pending: PendingJob<T>[] = [];
  private running = 0;
  private closed = false;
  private timers = new Set<NodeJS.Timeout>();

  constructor(
    private readonly name: string,
    private readonly processor: (data: T) => Promise<void>,
    private readonly concurrency = 1,
  ) {}

  /** Mirrors Queue.add(): enqueue and process in the background. */
  async add(name: string, data: T, options: AddOptions = {}): Promise<void> {
    if (this.closed) return;
    this.pending.push({
      name,
      data,
      options: {
        attempts: options.attempts ?? 1,
        backoff: options.backoff ?? { type: 'exponential', delay: 1000 },
      },
    });
    this.logger.debug(`Enqueued ${name} (queue=${this.name}, pending=${this.pending.length})`);
    void this.drain();
  }

  private async drain(): Promise<void> {
    while (!this.closed && this.running < this.concurrency && this.pending.length > 0) {
      const job = this.pending.shift()!;
      this.running += 1;
      void this.runWithRetries(job).finally(() => {
        this.running -= 1;
        void this.drain();
      });
    }
  }

  private async runWithRetries(job: PendingJob<T>): Promise<void> {
    const { attempts, backoff } = job.options;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        await this.processor(job.data);
        this.logger.log(`Job ${job.name} completed (attempt ${attempt}/${attempts})`);
        return;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (attempt >= attempts) {
          this.logger.error(
            `Job ${job.name} failed after ${attempts} attempt(s): ${message}`,
          );
          return;
        }
        const delay = backoff.delay * 2 ** (attempt - 1);
        this.logger.warn(
          `Job ${job.name} failed (attempt ${attempt}/${attempts}): ${message}. Retrying in ${delay}ms.`,
        );
        await this.sleep(delay);
        if (this.closed) return;
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.timers.delete(timer);
        resolve();
      }, ms);
      this.timers.add(timer);
      if (typeof timer.unref === 'function') timer.unref();
    });
  }

  async close(): Promise<void> {
    this.closed = true;
    this.pending = [];
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
  }
}
