import { Logger } from '../common/logger';
import { ollamaService, OllamaService, OllamaErrorKind } from '../matching/ollama.service';
import { MentorshipRequestModel } from '../database/models';

/**
 * AI-refined mentorship requests (2026-11-20) — prompt-based, NO
 * fine-tuning, NO training, and it never touches the matching scorer.
 *
 * Where it sits: RequestsService.create() kicks off refine() in the
 * BACKGROUND after the request row is saved — fire-and-forget, never
 * awaited. The student gets their 201 immediately; the summary lands on
 * the request document when the model answers (seconds later) and the
 * mentor sees it on their next load of the dashboard / requests list,
 * WITH the student's original goal + message still shown alongside it.
 *
 * WHAT IT DOES: the local Llama model rewrites the student's goal +
 * introduction into a clear, detailed summary of what they are actually
 * asking for — what they want to learn or build, their context, and
 * suggested focus areas. The summary comes ONLY from what the student
 * wrote + their profile fields below; the prompt forbids inventing
 * skills, experience, goals, or facts.
 *
 * NEVER BLOCKS, NEVER FAILS THE REQUEST: one LLM attempt, bounded by
 * OLLAMA_TIMEOUT_MS; on ANY failure (unavailable / timeout /
 * invalid_output / disabled) the request keeps its original text, the
 * failure kind is recorded on the request (aiRefineError) for honest
 * labelling, and refine() still resolves normally. This service never
 * throws — even the follow-up document write is guarded.
 *
 * HONEST LABELS: aiRefined is true ONLY when the LLM genuinely
 * produced a refinement. While a refinement is still running,
 * aiRefined is false and aiRefineError is absent; after a failure,
 * aiRefined is false and aiRefineError carries the Ollama error kind.
 *
 * The prompt itself is never logged (it carries the student's own
 * words); only the failure kind is logged.
 */

/** Max characters kept in the refined summary. */
export const LLM_MAX_REFINEMENT_SUMMARY_CHARS = 800;
/** Max focus areas kept from one refinement. */
export const LLM_MAX_FOCUS_AREAS = 4;
/** Max characters kept per focus area. */
export const LLM_MAX_FOCUS_AREA_CHARS = 100;
/** Max items kept from a student list field in the prompt. */
const MAX_LIST_ITEMS = 10;
/** Max characters kept from a free-text profile field in the prompt. */
const MAX_FREE_TEXT_CHARS = 500;
/** Goal is capped by the create-request DTO at 200 chars. */
const MAX_GOAL_CHARS = 200;
/** Message is capped by the create-request DTO at 1000 chars. */
const MAX_MESSAGE_CHARS = 1000;

const REFINEMENT_SYSTEM_PROMPT =
  'You refine mentorship requests into clear summaries for mentors. Reply with JSON only, no prose, no markdown fences.';

/** The student fields the prompt is built from — only fields that exist on the StudentProfile doc. */
export interface RefinementStudentSnapshot {
  programme?: string;
  school?: string;
  targetRole?: string;
  targetIndustry?: string;
  currentSkills?: string[];
  careerGoals?: string[];
  interests?: string[];
  mentoringNeeds?: string;
}

export interface RefinementResult {
  /** 2-4 sentences, plain professional language, max 800 chars. */
  summary: string;
  /** Up to 4 short phrases naming the concrete topics. */
  focusAreas: string[];
}

export type RefinementOutcome =
  | { ok: true; result: RefinementResult }
  | { ok: false; error: { kind: OllamaErrorKind; message: string } };

export type RequestRefinementOutcome =
  | { ok: true; summary: string; focusAreas: string[] }
  | { ok: false; error: { kind: OllamaErrorKind; message: string } };

/** Parse the LLM_REFINEMENT_ENABLED flag the same way the ranking flag is parsed. Default: true. */
export function resolveRefinementEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = (env.LLM_REFINEMENT_ENABLED || '').trim().toLowerCase();
  return raw === '' ? true : !['false', '0', 'no', 'off'].includes(raw);
}

function cleanList(values: unknown, limit: number = MAX_LIST_ITEMS): string[] {
  if (!Array.isArray(values)) return [];
  return values
    .filter((v) => typeof v === 'string' && (v as string).trim() !== '')
    .map((v) => (v as string).trim())
    .slice(0, limit);
}

function cleanText(value: unknown, maxChars: number = MAX_FREE_TEXT_CHARS): string {
  if (typeof value !== 'string') return '';
  const text = value.trim();
  return text.length > maxChars ? text.slice(0, maxChars) : text;
}

/**
 * Build the bounded refinement prompt. Only the student's own goal +
 * message and non-empty profile fields are included; nothing is
 * invented. The prompt instructs JSON-only output in the exact shape
 * the validator below accepts, and forbids inventing facts.
 */
export function buildRefinementPrompt(
  goal: string,
  message: string,
  student: RefinementStudentSnapshot,
): string {
  const lines: string[] = [];
  lines.push('You refine a mentorship request into a clear summary for the mentor who will read it. Use ONLY the student\'s own words and profile below — never invent skills, experience, goals, companies, or facts that are not stated. If the request is vague, say so plainly in the summary instead of guessing what the student meant.');
  lines.push('');
  lines.push('STUDENT GOAL (what they want to work on)');
  lines.push(cleanText(goal, MAX_GOAL_CHARS) || '(not stated)');
  lines.push('');
  lines.push('STUDENT INTRODUCTION (in their own words)');
  lines.push(cleanText(message, MAX_MESSAGE_CHARS) || '(not stated)');
  lines.push('');
  lines.push('STUDENT PROFILE (for context only — do not restate it as the request)');
  const profileLines: Array<[string, string]> = [
    ['Programme', cleanText(student.programme, 120)],
    ['School', cleanText(student.school, 120)],
    ['Target role', cleanText(student.targetRole, 120)],
    ['Target industry', cleanText(student.targetIndustry, 120)],
    ['Skills', cleanList(student.currentSkills).join(', ')],
    ['Career goals', cleanList(student.careerGoals).join(', ')],
    ['Interests', cleanList(student.interests).join(', ')],
    ['Mentoring needs', cleanText(student.mentoringNeeds)],
  ];
  let anyProfile = false;
  for (const [label, value] of profileLines) {
    if (value) {
      lines.push(`- ${label}: ${value}`);
      anyProfile = true;
    }
  }
  if (!anyProfile) lines.push('- (no profile details provided)');
  lines.push('');
  lines.push('Reply with JSON only, no prose, no markdown fences:');
  lines.push('{ "summary": "...", "focusAreas": ["...", "..."] }');
  lines.push('Rules:');
  lines.push(`- "summary": 2-4 sentences, plain professional language, max ${LLM_MAX_REFINEMENT_SUMMARY_CHARS} characters. State what the student wants to learn or build, the context they gave, and what kind of help they are asking the mentor for.`);
  lines.push(`- "focusAreas": up to ${LLM_MAX_FOCUS_AREAS} short phrases naming the concrete topics the student wants help with, grounded ONLY in the goal, message, and profile above. Omit it (or leave it empty) if no concrete topic can be named.`);
  lines.push('- Do not add facts, skills, timelines, or promises that the student did not state.');
  return lines.join('\n');
}

/**
 * Strictly validate one raw model reply. Returns a typed failure — never
 * throws, never returns a partial refinement. Exported so tests can
 * exercise validation without a live Ollama.
 *
 * Accepted shape (extra fields ignored):
 *   { "summary": "...", "focusAreas": ["...", "..."] }
 * A ```json fenced reply is unwrapped before parsing. An over-long
 * summary is truncated to the cap; empty or missing summary, a
 * non-array focusAreas, or malformed JSON is rejected wholesale.
 */
export function parseRefinementResponse(content: string): RefinementOutcome {
  const fail = (message: string): RefinementOutcome => ({
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

  const p = parsed as Record<string, unknown>;

  if (typeof p.summary !== 'string' || p.summary.trim() === '') {
    return fail('Ollama response needs a non-empty string "summary".');
  }
  const summary = p.summary.trim().slice(0, LLM_MAX_REFINEMENT_SUMMARY_CHARS);

  let focusAreas: string[] = [];
  if (p.focusAreas !== undefined) {
    if (!Array.isArray(p.focusAreas)) {
      return fail('Ollama response "focusAreas" must be an array when present.');
    }
    focusAreas = (p.focusAreas as unknown[])
      .filter((a) => typeof a === 'string' && (a as string).trim() !== '')
      .map((a) => (a as string).trim().slice(0, LLM_MAX_FOCUS_AREA_CHARS))
      .filter((a) => a !== '')
      .slice(0, LLM_MAX_FOCUS_AREAS);
  }

  return { ok: true, result: { summary, focusAreas } };
}

export class RequestRefinementService {
  private readonly logger = new Logger(RequestRefinementService.name);
  private readonly ollama: OllamaService;
  private readonly requestModel: typeof MentorshipRequestModel;
  private readonly refinementEnabled: boolean;

  constructor(deps?: {
    ollama?: OllamaService;
    requestModel?: typeof MentorshipRequestModel;
    refinementEnabled?: boolean;
  }) {
    this.ollama = deps?.ollama || ollamaService;
    this.requestModel = deps?.requestModel || MentorshipRequestModel;
    this.refinementEnabled = deps?.refinementEnabled ?? resolveRefinementEnabled();
  }

  /** Record a failed refinement attempt on the request — best-effort, never throws. */
  private async markFailed(requestId: string, kind: OllamaErrorKind): Promise<void> {
    try {
      await this.requestModel.findByIdAndUpdate(requestId, {
        $set: { aiRefined: false, aiRefineError: kind },
      });
    } catch (error: any) {
      this.logger.warn(
        `Could not record refinement failure for request ${requestId}: ${error?.message || 'unknown error'}`,
      );
    }
  }

  private async fail(
    requestId: string,
    kind: OllamaErrorKind,
  ): Promise<RequestRefinementOutcome> {
    this.logger.warn(
      `Request refinement failed (${kind}) for request ${requestId}; the student's original text is kept.`,
    );
    await this.markFailed(requestId, kind);
    return { ok: false, error: { kind, message: `Request refinement failed (${kind}).` } };
  }

  /**
   * One LLM attempt to refine a request, then record the outcome on the
   * request document. Never throws — any failure resolves as
   * { ok: false } with the error kind, and the request keeps its
   * original text. Callers must NOT await this on the request-creation
   * path: it runs in the background so the 201 goes out immediately.
   */
  async refine(
    requestId: string,
    goal: string,
    message: string,
    student: RefinementStudentSnapshot,
  ): Promise<RequestRefinementOutcome> {
    try {
      if (!this.refinementEnabled) {
        return this.fail(requestId, 'disabled');
      }

      const prompt = buildRefinementPrompt(goal, message, student);
      const chat = await this.ollama.chatJson(REFINEMENT_SYSTEM_PROMPT, prompt);
      if (chat.ok === false) {
        return this.fail(requestId, chat.error.kind);
      }

      const parsed = parseRefinementResponse(chat.content);
      if (parsed.ok === false) {
        return this.fail(requestId, 'invalid_output');
      }

      try {
        await this.requestModel.findByIdAndUpdate(requestId, {
          $set: {
            aiRefinedSummary: parsed.result.summary,
            aiFocusAreas: parsed.result.focusAreas,
            aiRefined: true,
            aiRefinedAt: new Date(),
          },
        });
      } catch (error: any) {
        this.logger.warn(
          `Could not store refinement for request ${requestId}: ${error?.message || 'unknown error'}`,
        );
        return this.fail(requestId, 'unavailable');
      }

      this.logger.log(`Request refinement stored for request ${requestId}.`);
      return { ok: true, summary: parsed.result.summary, focusAreas: parsed.result.focusAreas };
    } catch (error: any) {
      // Absolute safety net: refine() must never throw into the caller.
      this.logger.warn(
        `Unexpected refinement error for request ${requestId}: ${error?.message || 'unknown error'}`,
      );
      return this.fail(requestId, 'unavailable');
    }
  }
}

export const requestRefinementService = new RequestRefinementService();
