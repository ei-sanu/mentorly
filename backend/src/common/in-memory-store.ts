/**
 * In-process replacement for the Redis bits this backend used.
 *
 * Previously every service opened its own ioredis client against Upstash
 * (REDIS_URL = dynamic-cow-87566.upstash.io). When that host was unreachable
 * the server still booted, but BullMQ retried forever and every service
 * logged `getaddrinfo ENOTFOUND` spam, OTP rate-limiting silently turned
 * off, and /health reported unhealthy.
 *
 * This store implements only the Redis commands the codebase actually
 * uses — get / set (with EX) / setex / del / keys (glob) / ttl / incr /
 * expire — with the same async signatures and return shapes, so call
 * sites did not need logic changes.
 *
 * ONE shared instance (`inMemoryStore`) is exported and used by every
 * service. That matters: dashboard-events busts `dash:*` keys that
 * analytics cached, and recommendations invalidates keys it cached —
 * separate instances would silently break cache busting.
 *
 * Trade-offs, stated plainly:
 * - State lives only in this Node process. A restart wipes cache, OTP
 *   cooldowns/attempt counters and reqIds. That is the same behaviour
 *   the old code had when Upstash was down (guards skipped), except
 *   now rate-limiting actually runs instead of being silently disabled.
 * - State is NOT shared across processes / replicas. Fine for a
 *   single-instance dev server; a multi-instance production deploy
 *   would need a real shared Redis again.
 * - Entries expire lazily on access, plus a 60s sweep (unref'd, so it
 *   never keeps the process alive on its own).
 */

type Entry = { value: string; expiresAt?: number };

function globToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped.replace(/\*/g, '.*').replace(/\?/g, '.')}$`);
}

export class InMemoryStore {
  private entries = new Map<string, Entry>();
  private sweepTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.sweepTimer = setInterval(() => this.purgeExpired(), 60_000);
    // Never keep the process alive just for cache housekeeping.
    if (typeof this.sweepTimer.unref === 'function') this.sweepTimer.unref();
  }

  private purgeExpired(now = Date.now()): void {
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt !== undefined && entry.expiresAt <= now) {
        this.entries.delete(key);
      }
    }
  }

  private getLive(key: string): Entry | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt !== undefined && entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry;
  }

  async get(key: string): Promise<string | null> {
    return this.getLive(key)?.value ?? null;
  }

  async set(
    key: string,
    value: string,
    mode?: 'EX',
    ttlSeconds?: number,
  ): Promise<'OK'> {
    const entry: Entry = { value };
    if (mode === 'EX' && ttlSeconds !== undefined) {
      entry.expiresAt = Date.now() + ttlSeconds * 1000;
    }
    this.entries.set(key, entry);
    return 'OK';
  }

  async setex(key: string, seconds: number, value: string): Promise<'OK'> {
    return this.set(key, value, 'EX', seconds);
  }

  async del(...keys: string[]): Promise<number> {
    let removed = 0;
    for (const key of keys) {
      if (this.entries.delete(key)) removed += 1;
    }
    return removed;
  }

  async keys(pattern: string): Promise<string[]> {
    this.purgeExpired();
    const re = globToRegExp(pattern);
    return [...this.entries.keys()].filter((key) => re.test(key));
  }

  /** Redis TTL semantics: -2 = missing, -1 = no expiry, else seconds left. */
  async ttl(key: string): Promise<number> {
    const entry = this.getLive(key);
    if (!entry) return -2;
    if (entry.expiresAt === undefined) return -1;
    return Math.max(0, Math.ceil((entry.expiresAt - Date.now()) / 1000));
  }

  /** INCR preserves any existing TTL, like Redis. Missing key starts at 1. */
  async incr(key: string): Promise<number> {
    const entry = this.getLive(key);
    const next = (entry ? parseInt(entry.value, 10) || 0 : 0) + 1;
    this.entries.set(key, { value: String(next), expiresAt: entry?.expiresAt });
    return next;
  }

  /** EXPIRE: 1 if the key existed, 0 otherwise. */
  async expire(key: string, seconds: number): Promise<number> {
    const entry = this.getLive(key);
    if (!entry) return 0;
    entry.expiresAt = Date.now() + seconds * 1000;
    return 1;
  }
}

/** The single shared store for the whole process — see header comment. */
export const inMemoryStore = new InMemoryStore();
