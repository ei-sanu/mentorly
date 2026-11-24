import { Logger } from '../common/logger';
import { ollamaService, OllamaService, OllamaErrorKind, OllamaRankedCandidate } from '../matching/ollama.service';

/**
 * LLM ranking integration (Phase 2 of the LLM-powered matching build —
 * prompt-based, NO fine-tuning, NO weight changes, NO training).
 *
 * Where it sits: RecommendationsService.getRecommendedMentors() calls
 * rankAndApply() at the COMPUTE step, on cache miss only, AFTER the
 * deterministic weighted scorer (MatchingService.calculateRecommendation)
 * has produced its ranked list. The 1h cache is untouched — the LLM-ranked
 * list is stored under the existing `recommendations:student:<id>` key
 * WITH its honest per-item labels attached, so a cached entry always
 * describes how it was actually computed.
 *
 * BOUNDED INFLUENCE (the one rule): the LLM may re-rank ONLY the top
 * LLM_RANK_CANDIDATE_LIMIT base candidates and attach 1-2 short reasons
 * per mentor grounded in the prompt fields. It moves a mentor's score
 * HALFWAY toward its own judgement, capped at LLM_SCORE_ADJUST_BAND
 * (±30) points away from its base score, clamped to 0-100. It can never
 * invent a mentor (unknown candidateIds are dropped), never change
 * eligibility (it only ever sees candidates the base scorer already
 * approved), never change the weights, and never produce a score from
 * nothing (every LLM score is anchored to a base score). Final order is
 * by adjusted score desc, ties broken by LLM rank, then base order — so
 * score and order can never disagree.
 *
 * WHY ±30 (2026-11-20, Item 1 — widened from ±15): two mentors showed an
 * identical 23% because their BASE scores were identical (22.5 → 23:
 * semantic 0.5 default × 35 = 17.5 + availability 0.5 default × 10 = 5,
 * everything else 0 — no embeddings, no availability rows, no overlaps;
 * see MANIFEST Item 1). The prompt ALSO used to show the LLM each
 * candidate's baseScore and tell it to stay within the band, so the small
 * model echoed the base. And even a perfect LLM verdict was compressed
 * by the band: judged 75 vs 35 off identical bases of 23 becomes 38 vs
 * 35 under ±15 — a 40-point judged gap collapsed to 3 points, i.e. the
 * reported bug survives a working LLM. Under ±30 the same verdict
 * becomes 53 vs 35 — an 18-point spread that preserves the LLM's order
 * and a meaningful gap, while every final score is still within 30
 * points of its deterministic base. The prompt no longer shows baseScore
 * at all, so the LLM judges fit from the evidence alone and the band is
 * the only anchor. Weights are unchanged.
 *
 * WHY A BLEND, NOT A CLAMP (2026-11-20, match fix — Item 1): the ±30
 * clamp above still saturated in production. The user's screenshot
 * showed BOTH mentors at 53% with an identical breakdown: the LLM
 * scored both candidates ≥53 (both are plausible fits), so BOTH got
 * exactly +30 off identical bases of 23 — the clamp discarded the
 * LLM's own difference between the two. The blend fixes that while
 * keeping the ±30 bounded-influence rule: final = base +
 * clamp(round(0.5 × (llmScore − base)), −30, +30). The LLM moves the
 * score halfway toward its own judgement, so two LLM scores of 85 vs
 * 70 off identical bases of 23 become 53 vs 47 instead of 53 vs 53,
 * and no final is ever more than 30 points from its base. The prompt
 * also gained a comparative instruction (scores must differ by ≥15
 * when the evidence clearly favours one candidate) so the model
 * spreads its own scores instead of handing every candidate a
 * similar one. LLM_SCORE_ADJUST_BAND keeps its name and value (30).
 *
 * FALLBACK: on ANY LLM failure (unavailable / timeout / invalid_output /
 * disabled) or when the LLM returns zero usable entries, the base scorer
 * result is returned unchanged, immediately, one attempt, no retry. The
 * failure kind is logged in the existing log format and surfaced per item
 * as additive `llmError`.
 *
 * HONEST LABELS: `matchType: 'LLM'` appears ONLY on items the LLM
 * actually re-ranked/reasoned; every other item keeps its base label
 * ('HYBRID' | 'FALLBACK'). Additive `llmUsed: boolean` is set on every
 * item (true only where the LLM contributed); additive `llmError` (the
 * Ollama error kind) is set on every item only when the run fell back
 * because the LLM failed. No other endpoint, route, or response shape
 * changes.
 *
 * The prompt itself is never logged (it carries student/mentor profile
 * text); only counts, the failure kind, and dropped ids are logged.
 */

/** How many top base candidates are sent to the LLM. The rest of the list keeps base scores/order. */
export const LLM_RANK_CANDIDATE_LIMIT = 8;
/** Max points an LLM score may move a mentor away from its base score. */
export const LLM_SCORE_ADJUST_BAND = 30;
/** Max characters kept per LLM reason. */
export const LLM_MAX_REASON_CHARS = 200;
/** Max LLM reasons kept per mentor (the client allows up to 3; we keep 1-2). */
export const LLM_MAX_REASONS_PER_MENTOR = 2;
/** Max items kept from a student list field in the prompt. */
const MAX_LIST_ITEMS = 10;
/** Max characters kept from a free-text student field in the prompt. */
const MAX_FREE_TEXT_CHARS = 500;

/** The student fields the prompt is built from — only fields that exist on the StudentProfile doc. */
export interface LlmStudentSnapshot {
  programme?: string;
  school?: string;
  targetRole?: string;
  targetIndustry?: string;
  currentSkills?: string[];
  careerGoals?: string[];
  interests?: string[];
  mentoringNeeds?: string;
}

/**
 * One base candidate as sent to the LLM — only real fields the base scorer used.
 * NOTE (2026-11-20, Item 1): there is deliberately NO baseScore here.
 * Showing it anchored the small model on the deterministic score — it echoed
 * the base instead of judging fit, so mentors with identical bases got
 * identical LLM scores too. The LLM now scores fit 0-100 from the evidence
 * alone; the caller blends the result halfway toward the LLM score,
 * capped at ±LLM_SCORE_ADJUST_BAND around the base, so the band — not
 * the prompt — is the anchor.
 */
export interface LlmCandidateSnapshot {
  id: string;
  title?: string;
  company?: string;
  industry?: string;
  expertise?: string[];
  mentoringAreas?: string[];
  yearsOfExperience?: number;
}

/** A base recommendation item plus the additive honest-label fields. Extra fields pass through untouched. */
export interface RankedRecommendation {
  id: string;
  matchScore: number;
  matchReasons: string[];
  matchType?: string;
  llmUsed?: boolean;
  llmError?: OllamaErrorKind;
  /** Per-component points from the deterministic scorer; llmAdjustment (signed points) is added here only when the LLM genuinely ran. */
  scoreBreakdown?: {
    semantic: number;
    careerGoal: number;
    expertise: number;
    industry: number;
    targetRole: number;
    availability: number;
    llmAdjustment?: number;
  };
  [key: string]: any;
}

export interface ApplyLlmRankingsResult {
  recommendations: RankedRecommendation[];
  /** How many LLM ranking entries were actually applied. */
  appliedCount: number;
  /** LLM candidateIds that were not in the base set and were dropped. */
  droppedCandidateIds: string[];
}

export interface RankAndApplyResult {
  recommendations: RankedRecommendation[];
  /** True when the LLM contributed to at least one item in this run. */
  llmUsed: boolean;
  /** Present only when the run fell back to base scores because the LLM failed. */
  llmError?: OllamaErrorKind;
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

function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Build the bounded ranking prompt. Only non-empty student fields and the
 * given (already bounded) candidates are included; nothing is invented.
 * The prompt instructs JSON-only output in the exact shape the Ollama
 * client validates, and forbids inventing mentors, skills, or facts.
 */
export function buildRankingPrompt(student: LlmStudentSnapshot, candidates: LlmCandidateSnapshot[]): string {
  const lines: string[] = [];
  lines.push('You rank mentor candidates for one student. Rank ONLY the candidates listed below — never invent, add, or rename a mentor, and never invent skills, companies, or facts that are not listed.');
  lines.push('');
  lines.push('STUDENT');
  const studentLines: Array<[string, string]> = [
    ['Programme', cleanText(student.programme, 120)],
    ['School', cleanText(student.school, 120)],
    ['Target role', cleanText(student.targetRole, 120)],
    ['Target industry', cleanText(student.targetIndustry, 120)],
    ['Skills', cleanList(student.currentSkills).join(', ')],
    ['Career goals', cleanList(student.careerGoals).join(', ')],
    ['Interests', cleanList(student.interests).join(', ')],
    ['Mentoring needs', cleanText(student.mentoringNeeds)],
  ];
  for (const [label, value] of studentLines) {
    if (value) lines.push(`- ${label}: ${value}`);
  }
  lines.push('');
  lines.push('CANDIDATES — score each one 0-100 on how well it fits this student, from the fields listed only');
  candidates.forEach((c, i) => {
    const parts: string[] = [`candidateId: ${c.id}`];
    const title = cleanText(c.title, 120);
    if (title) parts.push(`Designation: ${title}`);
    const company = cleanText(c.company, 120);
    if (company) parts.push(`Company: ${company}`);
    const industry = cleanText(c.industry, 120);
    if (industry) parts.push(`Industry: ${industry}`);
    const expertise = cleanList(c.expertise).join(', ');
    if (expertise) parts.push(`Expertise: ${expertise}`);
    const areas = cleanList(c.mentoringAreas).join(', ');
    if (areas) parts.push(`Mentoring areas: ${areas}`);
    if (typeof c.yearsOfExperience === 'number') parts.push(`Experience: ${c.yearsOfExperience} years`);
    lines.push(`${i + 1}. ${parts.join(' | ')}`);
  });
  lines.push('');
  lines.push('Reply with JSON only, no prose, no markdown fences:');
  lines.push('{ "rankings": [{ "candidateId": "<id exactly as listed>", "rank": 1, "score": 0-100, "reasons": ["...", "..."] }] }');
  lines.push('Rules:');
  lines.push('- "rank" is 1-based and unique; rank the best candidate first.');
  lines.push('- "score" is your own 0-100 fit judgement for that candidate from the evidence above — judge each candidate on its own merits, do not give every candidate the same score, and use the full range when the evidence differs (a strong fit is 75+, a weak fit is under 40). The caller blends your score with the deterministic matcher, moving the base score halfway toward your score, at most ' + LLM_SCORE_ADJUST_BAND + ' points.');
  lines.push('- Score candidates relative to each other: if the evidence clearly favours one candidate over another, their scores must differ by at least 15 points; do not give every candidate a similar score.');
  lines.push('- "reasons": 1-2 short reasons each, grounded ONLY in the student and candidate fields above.');
  // (2026-11-20, workspace slice Item 4) The small model writes
  // negative "No match in skills" / "No match in industry" reasons
  // when a dimension does not overlap — the deterministic scorer never
  // emits those lines, so the LLM is their only source. A "Why this
  // mentor?" card must say what DOES match: forbid the negative
  // phrasing in the prompt AND drop it server-side (sanitiseLlmReasons)
  // in case the model writes it anyway.
  lines.push('- Each reason must say what DOES match (a shared skill, the same industry, a mentoring area that fits a goal). Never write a "No match in …" reason — if a dimension does not match, say what does match instead, or leave that dimension out.');
  lines.push('- You may omit a candidate from "rankings" if you cannot judge it from the given fields; omitted candidates keep their base score and order.');
  return lines.join('\n');
}

/**
 * (2026-11-20, workspace slice Item 4) Negative reason phrasings the
 * LLM writes when a dimension does not overlap ("No match in skills",
 * "No match in industry", "No relevant experience in …"). The
 * deterministic scorer never emits these — its fallbacks are positive
 * ("Currently accepting mentees", "Alumni of LPU") — so the LLM is
 * their only source. A "Why this mentor?" card must say what DOES
 * match, never lead with what does not.
 */
const NEGATIVE_REASON_PATTERNS: RegExp[] = [
  /^no\s+(match|overlap|shared|common|alignment)\b/i,
  /\bno\s+match\b/i,
  /\bdoes\s+not\s+match\b/i,
  /\bdoesn'?t\s+match\b/i,
  /\bno\s+(experience|expertise|background)\s+in\b/i,
  /\blacks?\s+(relevant\s+)?(experience|expertise|skills?|background)\b/i,
  /\bnot\s+(a\s+)?(good\s+)?(fit|match)\b/i,
  /\bno\s+relevant\b/i,
];

/**
 * Clean one LLM reason list: trim, drop empties, truncate to
 * LLM_MAX_REASON_CHARS, drop negative "No match in …" reasons, keep
 * at most LLM_MAX_REASONS_PER_MENTOR. Pure + exported for unit tests.
 * The caller keeps the entry's templated base reasons when nothing
 * usable survives, so a mentor is never left reason-less.
 */
export function sanitiseLlmReasons(reasons: unknown): string[] {
  return (Array.isArray(reasons) ? reasons : [])
    .filter((r) => typeof r === 'string' && r.trim() !== '')
    .map((r) => (r as string).trim().slice(0, LLM_MAX_REASON_CHARS))
    .filter((r) => r !== '' && !NEGATIVE_REASON_PATTERNS.some((p) => p.test(r)))
    .slice(0, LLM_MAX_REASONS_PER_MENTOR);
}

/**
 * Apply validated LLM rankings to a base list (pure — no I/O, unit-testable).
 * Unknown candidateIds are dropped; scores are blended halfway toward the
 * LLM score, capped at ±LLM_SCORE_ADJUST_BAND from the base, and clamped
 * to 0-100; reasons are sanitised (trimmed, empties dropped, truncated,
 * negative "No match in …" reasons dropped by sanitiseLlmReasons, max 2 —
 * an entry with no usable reasons keeps its templated base reasons but
 * still keeps its adjusted score); unranked candidates keep base scores,
 * reasons, and labels.
 */
export function applyLlmRankings(
  base: RankedRecommendation[],
  rankings: OllamaRankedCandidate[],
): ApplyLlmRankingsResult {
  const baseById = new Map<string, RankedRecommendation>();
  base.forEach((item) => baseById.set(item.id, item));

  const adjusted = new Map<string, { score: number; reasons: string[]; rank: number }>();
  const droppedCandidateIds: string[] = [];

  for (const entry of rankings) {
    const baseItem = baseById.get(entry.candidateId);
    if (!baseItem) {
      droppedCandidateIds.push(entry.candidateId);
      continue;
    }
    // (2026-11-20, match fix) BLEND, not clamp: move the base score
    // halfway toward the LLM's judgement, capped at ±LLM_SCORE_ADJUST_BAND.
    // The old clamp (delta = clamp(llmScore − base, −30, +30)) saturated
    // when bases were identical: two LLM scores of 85 and 70 off bases
    // of 23/23 both clamped to exactly +30, so both finals were 53 and
    // the LLM's 15-point difference was discarded. Halving preserves the
    // difference (85 → +30 capped, 70 → +24 off a base of 23: 53 vs 47)
    // while the ±30 cap keeps the bounded-influence rule: no final is
    // ever more than 30 points from its deterministic base.
    const delta = Math.max(
      -LLM_SCORE_ADJUST_BAND,
      Math.min(LLM_SCORE_ADJUST_BAND, Math.round(0.5 * (entry.score - baseItem.matchScore))),
    );
    const score = clampScore(baseItem.matchScore + delta);
    const reasons = sanitiseLlmReasons(entry.reasons);
    adjusted.set(entry.candidateId, {
      score,
      reasons: reasons.length > 0 ? reasons : baseItem.matchReasons,
      rank: entry.rank,
    });
  }

  const withOrder = base.map((item, baseIndex) => {
    const adj = adjusted.get(item.id);
    if (!adj) return { item: { ...item, llmUsed: false }, llmRank: Number.POSITIVE_INFINITY, baseIndex };
    // (2026-11-20, Item 1) Record the LLM's contribution inside the
    // breakdown the tooltip renders: signed points added/subtracted vs
    // the deterministic base score. Present ONLY on items the LLM
    // genuinely re-ranked — fallback items keep the base breakdown with
    // no llmAdjustment key at all. The `as` cast is safe: ranked items
    // always come from calculateRecommendation, which always sets a full
    // six-key breakdown; the `|| {}` is only a runtime guard for callers
    // that hand rankAndApply a hand-built list.
    return {
      item: {
        ...item,
        matchScore: adj.score,
        matchReasons: adj.reasons,
        matchType: 'LLM',
        llmUsed: true,
        scoreBreakdown: {
          ...(item.scoreBreakdown || {}),
          llmAdjustment: adj.score - item.matchScore,
        } as NonNullable<RankedRecommendation['scoreBreakdown']>,
      },
      llmRank: adj.rank,
      baseIndex,
    };
  });

  withOrder.sort((a, b) => b.item.matchScore - a.item.matchScore || a.llmRank - b.llmRank || a.baseIndex - b.baseIndex);

  return {
    recommendations: withOrder.map((w) => w.item),
    appliedCount: adjusted.size,
    droppedCandidateIds,
  };
}

export class LlmRankingService {
  private readonly logger = new Logger(LlmRankingService.name);
  private readonly ollama: OllamaService;

  constructor(ollama?: OllamaService) {
    this.ollama = ollama || ollamaService;
  }

  /**
   * One LLM attempt, then base fallback — never throws, never retries.
   * The caller (RecommendationsService) owns the cache; this method only
   * transforms the already-computed base list.
   */
  async rankAndApply(student: LlmStudentSnapshot, baseRecommendations: RankedRecommendation[]): Promise<RankAndApplyResult> {
    const base: RankedRecommendation[] = (baseRecommendations || []).map((r) => ({ ...r, llmUsed: false }));
    if (base.length === 0) {
      return { recommendations: base, llmUsed: false };
    }

    const top = base.slice(0, LLM_RANK_CANDIDATE_LIMIT);
    const prompt = buildRankingPrompt(student, top.map((r) => ({
      id: r.id,
      title: r.title,
      company: r.company,
      industry: r.industry,
      expertise: r.expertise,
      mentoringAreas: r.mentoringAreas,
      yearsOfExperience: r.experienceYears,
    })));

    const outcome = await this.ollama.rankCandidates(prompt);
    if (outcome.ok === false) {
      if (outcome.error.kind === 'disabled') {
        this.logger.log('LLM ranking disabled (LLM_RANKING_ENABLED=false); using deterministic base scores.');
      } else {
        this.logger.warn(`LLM ranking failed (${outcome.error.kind}); using deterministic base scores.`);
      }
      return {
        recommendations: base.map((r) => ({ ...r, llmError: outcome.error.kind })),
        llmUsed: false,
        llmError: outcome.error.kind,
      };
    }

    const applied = applyLlmRankings(base, outcome.result.rankings);
    if (applied.appliedCount === 0) {
      this.logger.warn(
        `LLM ranking returned no usable entries (dropped unknown candidateIds: ${applied.droppedCandidateIds.join(', ') || 'none'}); using deterministic base scores.`,
      );
      return {
        recommendations: base.map((r) => ({ ...r, llmError: 'invalid_output' as OllamaErrorKind })),
        llmUsed: false,
        llmError: 'invalid_output',
      };
    }
    if (applied.droppedCandidateIds.length > 0) {
      this.logger.warn(`LLM ranking dropped unknown candidateIds: ${applied.droppedCandidateIds.join(', ')}.`);
    }
    this.logger.log(`LLM ranking applied to ${applied.appliedCount} of ${top.length} candidates sent.`);
    return { recommendations: applied.recommendations, llmUsed: true };
  }
}

export const llmRankingService = new LlmRankingService();
