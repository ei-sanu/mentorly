import { Logger } from '../common/logger';

/**
 * Ollama client for prompt-based LLM ranking (Phase 1 of the LLM-powered
 * matching build — prompt-based, NO fine-tuning).
 *
 * Single responsibility: send one bounded prompt to a local Ollama model
 * and return strictly validated JSON rankings. It never touches the Gemini
 * embedding pipeline (see matching.service.ts generateEmbedding()) and it
 * never retries — one attempt per call; the caller decides the fallback
 * (the deterministic weighted scores).
 *
 * Style follows matching.service.ts: plain class + module-level singleton,
 * config read from process.env in the constructor, failures logged through
 * the shared Logger. No new dependencies — uses the Node 22 global fetch.
 * No provider abstraction is introduced here; this is the first LLM client
 * besides the hardcoded Gemini call, kept deliberately small and typed.
 */

export type OllamaErrorKind = 'unavailable' | 'timeout' | 'invalid_output' | 'disabled';

export interface OllamaError {
  kind: OllamaErrorKind;
  message: string;
}

export interface OllamaRankedCandidate {
  /** Mentor profile id, exactly as passed to the model in the prompt. */
  candidateId: string;
  /** 1-based rank (1 = best). Unique per response. */
  rank: number;
  /** 0-100. */
  score: number;
  /** 1-3 short human-readable reasons. */
  reasons: string[];
}

export interface OllamaRankResult {
  rankings: OllamaRankedCandidate[];
}

export type OllamaRankOutcome =
  | { ok: true; result: OllamaRankResult }
  | { ok: false; error: OllamaError };

/**
 * Outcome of one raw JSON chat call (shared by ranking and request
 * refinement). The caller owns parsing the `content` string.
 */
export type OllamaChatOutcome =
  | { ok: true; content: string }
  | { ok: false; error: OllamaError };

export interface OllamaConfig {
  baseUrl: string;
  model: string;
  timeoutMs: number;
  enabled: boolean;
}

export const DEFAULT_OLLAMA_BASE_URL = 'http://localhost:11434';
export const DEFAULT_OLLAMA_MODEL = 'llama3.2:3b';
export const DEFAULT_OLLAMA_TIMEOUT_MS = 15000;

const MAX_REASONS = 3;

/**
 * Resolve config from env the same way the rest of the backend does
 * (plain process.env reads, see matching.service.ts constructor).
 * Invalid/missing values fall back to the defaults — never throws.
 */
export function resolveOllamaConfig(env: NodeJS.ProcessEnv = process.env): OllamaConfig {
  const timeoutRaw = Number.parseInt(env.OLLAMA_TIMEOUT_MS || '', 10);
  const enabledRaw = (env.LLM_RANKING_ENABLED || '').trim().toLowerCase();
  return {
    baseUrl: (env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_BASE_URL).replace(/\/+$/, ''),
    model: env.OLLAMA_MODEL || DEFAULT_OLLAMA_MODEL,
    timeoutMs: Number.isFinite(timeoutRaw) && timeoutRaw > 0 ? timeoutRaw : DEFAULT_OLLAMA_TIMEOUT_MS,
    enabled: enabledRaw === '' ? true : !['false', '0', 'no', 'off'].includes(enabledRaw),
  };
}

/**
 * Strictly validate one raw model reply. Returns a typed failure — never
 * throws, never returns partial rankings. Exported so tests (and the
 * integration phase) can exercise validation without a live Ollama.
 *
 * Accepted shape (extra fields ignored):
 *   { "rankings": [{ "candidateId": "...", "rank": 1, "score": 87,
 *                     "reasons": ["..."] }] }
 * A ```json fenced reply is unwrapped before parsing. Reasons beyond the
 * first 3 are dropped; anything else malformed is rejected wholesale.
 */
export function parseRankResponse(content: string): OllamaRankOutcome {
  const fail = (message: string): OllamaRankOutcome => ({
    ok: false,
    error: { kind: 'invalid_output', message },
  });

  if (typeof content !== 'string' || content.trim() === '') {
    return fail('Ollama returned an empty response.');
  }

  // Models often wrap JSON in a ```json fence even with format: 'json'.
  let text = content.trim();
  const fence = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fence) text = fence[1].trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return fail('Ollama response was not valid JSON.');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return fail('Ollama response was not a JSON object.');
  }

  const rankings = (parsed as Record<string, unknown>).rankings;
  if (!Array.isArray(rankings) || rankings.length === 0) {
    return fail('Ollama response is missing a non-empty "rankings" array.');
  }

  const seenIds = new Set<string>();
  const seenRanks = new Set<number>();
  const result: OllamaRankedCandidate[] = [];

  for (const entry of rankings) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return fail('Each ranking entry must be a JSON object.');
    }
    const e = entry as Record<string, unknown>;

    if (typeof e.candidateId !== 'string' || e.candidateId.trim() === '') {
      return fail('Each ranking entry needs a non-empty string "candidateId".');
    }
    const candidateId = e.candidateId.trim();
    if (seenIds.has(candidateId)) {
      return fail(`Duplicate candidateId in rankings: ${candidateId}.`);
    }
    seenIds.add(candidateId);

    if (typeof e.rank !== 'number' || !Number.isInteger(e.rank) || e.rank < 1) {
      return fail(`Ranking for ${candidateId} needs a positive integer "rank".`);
    }
    if (seenRanks.has(e.rank)) {
      return fail(`Duplicate rank in rankings: ${e.rank}.`);
    }
    seenRanks.add(e.rank);

    if (typeof e.score !== 'number' || !Number.isFinite(e.score) || e.score < 0 || e.score > 100) {
      return fail(`Ranking for ${candidateId} needs a "score" between 0 and 100.`);
    }

    if (!Array.isArray(e.reasons) || e.reasons.length === 0) {
      return fail(`Ranking for ${candidateId} needs at least one "reasons" string.`);
    }
    const reasons: string[] = [];
    for (const r of e.reasons) {
      if (typeof r !== 'string' || r.trim() === '') {
        return fail(`Ranking for ${candidateId} has an empty "reasons" entry.`);
      }
      reasons.push(r.trim());
    }

    result.push({ candidateId, rank: e.rank, score: e.score, reasons: reasons.slice(0, MAX_REASONS) });
  }

  result.sort((a, b) => a.rank - b.rank);
  return { ok: true, result: { rankings: result } };
}

export class OllamaService {
  private readonly logger = new Logger(OllamaService.name);
  private readonly config: OllamaConfig;

  constructor(config?: Partial<OllamaConfig>) {
    this.config = { ...resolveOllamaConfig(), ...config };
  }

  /** Effective config (resolved env + overrides). Useful for admin diagnostics. */
  getConfig(): OllamaConfig {
    return { ...this.config };
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Lightweight reachability probe for the admin LLM-status endpoint
   * (Phase 3). GET {baseUrl}/api/tags with the configured timeout.
   * Never throws — any failure (Ollama not running, timeout, non-2xx)
   * is simply `false`. Probes even when ranking is disabled:
   * reachability and the enabled flag are reported separately.
   */
  async checkHealth(): Promise<boolean> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await fetch(`${this.config.baseUrl}/api/tags`, {
        method: 'GET',
        signal: controller.signal,
      });
      return response.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * One bounded /api/chat call with temperature 0. `formatJson` keeps
   * the JSON-only contract for ranking/refinement; free-text callers
   * (the chatbot) pass false. The single fetch path for every LLM
   * feature — one attempt, no retries, never throws: every failure
   * is a typed { ok: false, error } outcome. The prompt itself is never
   * logged (it carries student/mentor profile text); only the failure
   * kind and a short message are logged.
   */
  private async postChat(
    systemPrompt: string,
    userPrompt: string,
    formatJson = true,
  ): Promise<OllamaChatOutcome> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(`${this.config.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          ...(formatJson ? { format: 'json' } : {}),
          stream: false,
          options: { temperature: 0 },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const message = `Ollama request failed with HTTP ${response.status}.`;
        this.logger.error(message);
        return { ok: false, error: { kind: 'unavailable', message } };
      }

      let body: unknown;
      try {
        body = await response.json();
      } catch {
        return { ok: false, error: { kind: 'invalid_output', message: 'Ollama returned a non-JSON HTTP response.' } };
      }

      const content = (body as any)?.message?.content;
      if (typeof content !== 'string') {
        return { ok: false, error: { kind: 'invalid_output', message: 'Ollama response has no message.content string.' } };
      }

      return { ok: true, content };
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        const message = `Ollama request timed out after ${this.config.timeoutMs}ms.`;
        this.logger.warn(message);
        return { ok: false, error: { kind: 'timeout', message } };
      }
      const message = `Ollama unreachable at ${this.config.baseUrl} (${error?.message || 'unknown error'}).`;
      this.logger.error(message);
      return { ok: false, error: { kind: 'unavailable', message } };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Ask Ollama to rank candidates from a caller-built prompt. One attempt,
   * no retries. The prompt must instruct the model to reply with JSON only:
   *   { "rankings": [{ "candidateId": "...", "rank": 1, "score": 87,
   *                     "reasons": ["..."] }] }
   * Never throws: every failure is a typed { ok: false, error } outcome.
   * The prompt itself is never logged (it carries student/mentor profile
   * text); only the failure kind and a short message are logged.
   */
  async rankCandidates(prompt: string): Promise<OllamaRankOutcome> {
    if (!this.config.enabled) {
      return {
        ok: false,
        error: { kind: 'disabled', message: 'LLM ranking is disabled (LLM_RANKING_ENABLED=false).' },
      };
    }
    if (typeof prompt !== 'string' || prompt.trim() === '') {
      return {
        ok: false,
        error: { kind: 'invalid_output', message: 'rankCandidates requires a non-empty prompt.' },
      };
    }

    const chat = await this.postChat(
      'You rank mentor candidates. Reply with JSON only, no prose, no markdown fences.',
      prompt,
    );
    if (chat.ok === false) {
      return chat;
    }

    const outcome = parseRankResponse(chat.content);
    if (outcome.ok === false) {
      this.logger.warn(`Ollama ranking rejected: ${outcome.error.message}`);
    }
    return outcome;
  }

  /**
   * One raw JSON chat call for features other than ranking (request
   * refinement). The caller owns its own enabled flag and parses the
   * returned content — this method deliberately does NOT gate on the
   * ranking flag (LLM_RANKING_ENABLED), so switching ranking off does
   * not silently switch refinement off too. Same one-attempt, never-
   * throws contract as rankCandidates.
   */
  async chatJson(systemPrompt: string, userPrompt: string): Promise<OllamaChatOutcome> {
    if (typeof userPrompt !== 'string' || userPrompt.trim() === '') {
      return {
        ok: false,
        error: { kind: 'invalid_output', message: 'chatJson requires a non-empty prompt.' },
      };
    }
    return this.postChat(systemPrompt, userPrompt);
  }

  /**
   * One free-text chat call for the Mentorly AI chatbot (2026-11-20).
   * Same one-attempt, never-throws contract as chatJson, but without
   * `format: 'json'` — the chatbot answers in prose, not JSON. Like
   * chatJson it is NOT gated on LLM_RANKING_ENABLED (that flag is
   * about ranking); the chatbot answers whenever Ollama is reachable.
   * The caller owns prompt construction and the honest fallback when
   * this returns { ok: false }.
   */
  async chatText(systemPrompt: string, userPrompt: string): Promise<OllamaChatOutcome> {
    if (typeof userPrompt !== 'string' || userPrompt.trim() === '') {
      return {
        ok: false,
        error: { kind: 'invalid_output', message: 'chatText requires a non-empty prompt.' },
      };
    }
    return this.postChat(systemPrompt, userPrompt, false);
  }

  /**
   * Streaming free-text chat call for the Mentorly AI chatbot (2026-11-21).
   * Same one-attempt, never-throws contract as chatText, but with
   * `stream: true`: Ollama replies NDJSON, one JSON object per line,
   * each carrying `message.content`. Every non-empty content chunk is
   * handed to `onToken` the moment it arrives, so the caller can
   * forward it (SSE) instead of waiting for the whole reply — this is
   * what removes the 1–2s lag the non-streaming chatText path had.
   * Resolves with the full concatenated content. Like chatText it is
   * NOT gated on LLM_RANKING_ENABLED. Non-OK HTTP, network failure,
   * timeout, a missing body, and malformed NDJSON lines are typed
   * { ok: false } outcomes, never throws. A failure after some tokens
   * were already delivered still resolves { ok: false } — the caller
   * (chatbot.service chatStream) owns the partial-reply decision.
   */
  async chatTextStream(
    systemPrompt: string,
    userPrompt: string,
    onToken: (token: string) => void,
  ): Promise<OllamaChatOutcome> {
    if (typeof userPrompt !== 'string' || userPrompt.trim() === '') {
      return {
        ok: false,
        error: { kind: 'invalid_output', message: 'chatTextStream requires a non-empty prompt.' },
      };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(`${this.config.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          stream: true,
          options: { temperature: 0 },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const message = `Ollama request failed with HTTP ${response.status}.`;
        this.logger.error(message);
        return { ok: false, error: { kind: 'unavailable', message } };
      }
      if (!response.body) {
        return { ok: false, error: { kind: 'invalid_output', message: 'Ollama streaming response has no body.' } };
      }

      // One NDJSON line = one JSON object; parse + forward each line as
      // it arrives. A line is malformed only when it is not valid JSON
      // or has no message.content string — the final `done` line carries
      // an empty content string and is skipped, not an error.
      let content = '';
      const emitLine = (line: string): OllamaError | null => {
        const text = line.trim();
        if (!text) return null;
        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          return { kind: 'invalid_output', message: 'Ollama streaming response contained a malformed line.' };
        }
        const chunk = (parsed as any)?.message?.content;
        if (typeof chunk !== 'string') {
          return { kind: 'invalid_output', message: 'Ollama streaming line has no message.content string.' };
        }
        if (chunk) {
          content += chunk;
          try {
            onToken(chunk);
          } catch {
            return { kind: 'invalid_output', message: 'Streaming token callback failed.' };
          }
        }
        return null;
      };

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let newline = buffer.indexOf('\n');
          while (newline !== -1) {
            const error = emitLine(buffer.slice(0, newline));
            if (error) return { ok: false, error };
            buffer = buffer.slice(newline + 1);
            newline = buffer.indexOf('\n');
          }
        }
        // Tolerate a final line with no trailing newline.
        const tailError = emitLine(buffer + decoder.decode());
        if (tailError) return { ok: false, error: tailError };
      } finally {
        try {
          reader.releaseLock();
        } catch {
          // Already released — nothing to do.
        }
      }

      return { ok: true, content };
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        const message = `Ollama request timed out after ${this.config.timeoutMs}ms.`;
        this.logger.warn(message);
        return { ok: false, error: { kind: 'timeout', message } };
      }
      const message = `Ollama unreachable at ${this.config.baseUrl} (${error?.message || 'unknown error'}).`;
      this.logger.error(message);
      return { ok: false, error: { kind: 'unavailable', message } };
    } finally {
      clearTimeout(timer);
    }
  }
}

export const ollamaService = new OllamaService();
