import { Logger } from '../common/logger';
import { StudentProfileModel, MentorProfileModel, AvailabilityModel, SystemConfigModel } from '../database/models';
import { Types } from 'mongoose';
import { StudentProfile, StudentProfileDocument } from '../database/schemas/student-profile.schema';
import { MentorProfile, MentorProfileDocument, VerificationStatus, MentorStatus } from '../database/schemas/mentor-profile.schema';
import { Availability, AvailabilityDocument } from '../database/schemas/availability.schema';
import { SystemConfig, SystemConfigDocument } from '../database/schemas/system-config.schema';
import { GoogleGenAI } from '@google/genai';

export interface MatchingWeights {
  semanticSimilarity: number;
  careerGoal: number;
  expertise: number;
  industry: number;
  targetRole: number;
  availability: number;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0.5;
  let dot = 0;
  let mA = 0;
  let mB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    mA += a[i] * a[i];
    mB += b[i] * b[i];
  }
  if (mA === 0 || mB === 0) return 0.5;
  return dot / (Math.sqrt(mA) * Math.sqrt(mB));
}

/**
 * Token/alias matching (2026-11-20, match fix — Item 1).
 *
 * WHY: the old component scorers measured almost nothing for real
 * profiles. Career-goal used substring matching between full sentences
 * ("I want to become a software engineer!!" vs "Backend Systems" → 0);
 * expertise used exact string equality ("React" vs "Node.js" → 0);
 * industry used exact equality ("Software & Tech" vs "Technology" → 0);
 * target-role used substring ("Frontend Developer" vs "SDE 2 at Google"
 * / "Senior Software Engineer at Google" → 0). Both mentors in the
 * reported screenshot scored 0 on all four, so their bases were
 * identical and only the two 0.5 defaults (semantic 17.5 + availability
 * 5) showed up. Tokenising both sides and comparing canonical tokens
 * recovers the real overlap without changing any weight.
 *
 * tokenize(): lowercase; string-level normalisation first
 * ("front-end"→"frontend", "full-stack"→"fullstack"); split on
 * non-alphanumerics; drop stopwords; expand aliases per token
 * (js→javascript, ts→typescript, tech→technology, sde→software
 * development engineer, ai→artificial intelligence, ml→machine
 * learning, developer/development→develop, engineering→engineer);
 * strip a trailing 's' for tokens longer than 3 chars not ending in
 * 'ss' (systems→system). Alias expansion runs a second pass so an
 * alias value that is itself an alias (e.g. 'development' inside the
 * 'sde' expansion) canonicalises too. No new dependency.
 *
 * computeTextMatchScores() is pure (no I/O) so the four text
 * components are unit-testable without a database. Scores:
 * - careerGoal: |student goal tokens ∩ mentor tokens| / |student goal
 *   tokens| (student side = careerGoals + mentoringNeeds; mentor side
 *   = mentoringAreas + expertise + designation). 0 when the student
 *   has no goal tokens.
 * - expertise: |student skill tokens ∩ mentor expertise tokens| /
 *   |student skill tokens|. 0 when the student has no skill tokens.
 * - industry: 1.0 when, after alias expansion, one side's token set
 *   is a subset of the other's OR they share ≥1 token; else 0.0.
 * - targetRole: binary 1.0/0.0 — 1.0 when ANY canonical token of the
 *   target role appears in the designation token set.
 * Every component keeps the old both-sides-non-empty guard shape, so
 * an empty side is "no information", never a match (the 2026-11-20
 * empty-string traps stay fixed). Denominators count UNIQUE tokens.
 * Weights, semantic, and availability are untouched by this change.
 */
const MATCH_STOPWORDS = new Set([
  'i', 'want', 'to', 'become', 'a', 'an', 'the', 'and', 'or', 'of', 'in',
  'at', 'for', 'with', 'my', 'me', 'is', 'am', 'are', 'on', 'as', 'by',
  'from', 'into',
]);

const MATCH_TOKEN_ALIASES: Record<string, string[]> = {
  js: ['javascript'],
  ts: ['typescript'],
  tech: ['technology'],
  sde: ['software', 'development', 'engineer'],
  ai: ['artificial', 'intelligence'],
  ml: ['machine', 'learning'],
  developer: ['develop'],
  development: ['develop'],
  engineering: ['engineer'],
};

export function tokenize(text: string): string[] {
  if (!text) return [];
  const normalised = text
    .toLowerCase()
    .replace(/front-end/g, 'frontend')
    .replace(/full-stack/g, 'fullstack');
  const out: string[] = [];
  for (const raw of normalised.split(/[^a-z0-9]+/)) {
    if (raw === '' || MATCH_STOPWORDS.has(raw)) continue;
    // Strip a trailing 's' BEFORE alias lookup so plurals of aliased
    // words canonicalise too ('developers' → 'developer' → 'develop').
    let token = raw;
    if (token.length > 3 && token.endsWith('s') && !token.endsWith('ss')) {
      token = token.slice(0, -1);
    }
    // Expand aliases; one extra pass so an alias value that is itself
    // an alias ('development' inside the 'sde' expansion) canonicalises.
    const first = MATCH_TOKEN_ALIASES[token];
    if (!first) {
      out.push(token);
      continue;
    }
    for (const piece of first) {
      const second = MATCH_TOKEN_ALIASES[piece];
      if (second) out.push(...second);
      else out.push(piece);
    }
  }
  return out;
}

function tokenSet(text: string): Set<string> {
  return new Set(tokenize(text));
}

export interface TextMatchStudent {
  careerGoals: string[];
  mentoringNeeds: string;
  currentSkills: string[];
  targetRole: string;
  targetIndustry: string;
}

export interface TextMatchMentor {
  mentoringAreas: string[];
  expertise: string[];
  currentDesignation: string;
  industry: string;
}

export interface TextMatchScores {
  careerGoal: number;
  expertise: number;
  industry: number;
  targetRole: number;
}

export function computeTextMatchScores(student: TextMatchStudent, mentor: TextMatchMentor): TextMatchScores {
  // A. Career Goal Match — token overlap, not substring of full sentences.
  let careerGoal = 0;
  const studentGoalTokens = tokenSet([...(student.careerGoals || []), student.mentoringNeeds || ''].join(' '));
  const mentorGoalTokens = tokenSet(
    [...(mentor.mentoringAreas || []), ...(mentor.expertise || []), mentor.currentDesignation || ''].join(' '),
  );
  if (studentGoalTokens.size > 0 && mentorGoalTokens.size > 0) {
    let hits = 0;
    studentGoalTokens.forEach((t) => {
      if (mentorGoalTokens.has(t)) hits++;
    });
    careerGoal = hits / studentGoalTokens.size;
  }

  // B. Expertise Match — token overlap, not exact string equality.
  let expertise = 0;
  const studentSkillTokens = tokenSet((student.currentSkills || []).join(' '));
  const mentorExpertiseTokens = tokenSet((mentor.expertise || []).join(' '));
  if (studentSkillTokens.size > 0 && mentorExpertiseTokens.size > 0) {
    let hits = 0;
    studentSkillTokens.forEach((t) => {
      if (mentorExpertiseTokens.has(t)) hits++;
    });
    expertise = hits / studentSkillTokens.size;
  }

  // C. Industry Match — token overlap after alias expansion, not exact
  // equality. Empty side = no information, never a match.
  let industry = 0;
  const studentIndustryTokens = tokenSet(student.targetIndustry || '');
  const mentorIndustryTokens = tokenSet(mentor.industry || '');
  if (studentIndustryTokens.size > 0 && mentorIndustryTokens.size > 0) {
    let shared = false;
    studentIndustryTokens.forEach((t) => {
      if (mentorIndustryTokens.has(t)) shared = true;
    });
    const subset =
      [...studentIndustryTokens].every((t) => mentorIndustryTokens.has(t)) ||
      [...mentorIndustryTokens].every((t) => studentIndustryTokens.has(t));
    industry = subset || shared ? 1.0 : 0.0;
  }

  // D. Role Match — binary: 1.0 when ANY canonical token of the target
  // role appears in the designation token set. Empty side = no match.
  let targetRole = 0;
  const roleTokens = tokenSet(student.targetRole || '');
  const designationTokens = tokenSet(mentor.currentDesignation || '');
  if (roleTokens.size > 0 && designationTokens.size > 0) {
    let matched = false;
    roleTokens.forEach((t) => {
      if (designationTokens.has(t)) matched = true;
    });
    targetRole = matched ? 1.0 : 0.0;
  }

  return { careerGoal, expertise, industry, targetRole };
}

export class MatchingService {
  private readonly logger = new Logger(MatchingService.name);
  private ai: GoogleGenAI | null = null;

  private readonly studentProfileModel = StudentProfileModel;
  private readonly mentorProfileModel = MentorProfileModel;
  private readonly availabilityModel = AvailabilityModel;
  private readonly configModel = SystemConfigModel;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== 'mock_gemini_key') {
      this.ai = new GoogleGenAI({ apiKey });
    }
  }

  async getMatchingWeights(): Promise<MatchingWeights> {
    const config = await this.configModel.findOne({ key: 'MATCHING_WEIGHTS' }).lean();
    if (config) {
      return config.value as unknown as MatchingWeights;
    }
    return {
      semanticSimilarity: 35,
      careerGoal: 20,
      expertise: 15,
      industry: 10,
      targetRole: 10,
      availability: 10,
    };
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      if (this.ai) {
        const response = await this.ai.models.embedContent({
          model: 'text-embedding-004',
          contents: text,
        });

        const values = response.embeddings?.[0]?.values;
        if (values) {
          if (values.length === 768) {
            return [...values, ...values];
          }
          if (values.length === 1536) {
            return values;
          }
          const target = new Array(1536).fill(0);
          for (let i = 0; i < Math.min(values.length, 1536); i++) {
            target[i] = values[i];
          }
          return target;
        }
      }
    } catch (error) {
      this.logger.error(`AI Embedding generation failed: ${error.message}. Using fallback dummy vector.`);
    }

    const dummy = new Array(1536).fill(0);
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = text.charCodeAt(i) + ((hash << 5) - hash);
    }
    for (let i = 0; i < 1536; i++) {
      dummy[i] = Math.sin(hash + i) * 0.1;
    }
    return dummy;
  }

  async generateAndSaveStudentEmbedding(studentProfileId: string) {
    const student = await this.studentProfileModel.findById(studentProfileId).lean();
    if (!student) return;

    const representation = `
      Programme: ${student.programme}
      School: ${student.school}
      Target Role: ${student.targetRole}
      Target Industry: ${student.targetIndustry}
      Skills: ${student.currentSkills.join(', ')}
      Goals: ${student.careerGoals.join(', ')}
      Needs: ${student.mentoringNeeds}
    `;

    const embedding = await this.generateEmbedding(representation);

    await this.studentProfileModel.findByIdAndUpdate(studentProfileId, {
      $set: { studentEmbedding: embedding },
    });

    this.logger.log(`Generated and stored embedding for StudentProfile: ${studentProfileId}`);
  }

  async generateAndSaveMentorEmbedding(mentorProfileId: string) {
    const mentor = await this.mentorProfileModel.findById(mentorProfileId).lean();
    if (!mentor) return;

    const representation = `
      Programme: ${mentor.programme}
      Designation: ${mentor.currentDesignation}
      Company: ${mentor.currentCompany}
      Industry: ${mentor.industry}
      Expertise: ${mentor.expertise.join(', ')}
      Areas: ${mentor.mentoringAreas.join(', ')}
      Bio: ${mentor.bio}
      Summary: ${mentor.careerSummary}
    `;

    const embedding = await this.generateEmbedding(representation);

    await this.mentorProfileModel.findByIdAndUpdate(mentorProfileId, {
      $set: { mentorEmbedding: embedding },
    });

    this.logger.log(`Generated and stored embedding for MentorProfile: ${mentorProfileId}`);
  }

  async calculateRecommendation(studentProfileId: string, mentorProfileId?: string) {
    const student = await this.studentProfileModel.findById(studentProfileId).lean();
    if (!student) {
      throw new Error(`Student profile ${studentProfileId} not found`);
    }

    const weights = await this.getMatchingWeights();

    let mentors = [];
    if (mentorProfileId) {
      const single = await this.mentorProfileModel
        .findById(mentorProfileId)
        .select('-mentorEmbedding -__v')
        .populate({ path: 'userId', select: 'firstName lastName avatar' })
        .lean();
      if (single) mentors = [single];
    } else {
      mentors = await this.mentorProfileModel
        .find({
          verificationStatus: VerificationStatus.VERIFIED,
          status: MentorStatus.ACTIVE,
          acceptingMentees: true,
          profileVisibility: true,
          $expr: { $lt: ['$currentMenteesCount', '$maxCapacity'] },
        })
        .select('-mentorEmbedding -__v')
        .populate({ path: 'userId', select: 'firstName lastName avatar' })
        .lean();
    }

    // Single grouped fetch for all availabilities instead of N+1 per mentor
    const mentorIds = mentors.map((m) => m._id);
    const availabilityRows = mentorIds.length
      ? await this.availabilityModel
          .find({ mentorProfileId: { $in: mentorIds } })
          .select('mentorProfileId')
          .lean()
      : [];
    const availabilityByMentor = new Map<string, number>();
    for (const row of availabilityRows as Array<{ mentorProfileId: Types.ObjectId | string }>) {
      const key = row.mentorProfileId.toString();
      availabilityByMentor.set(key, (availabilityByMentor.get(key) ?? 0) + 1);
    }

    let semanticScores: Record<string, number> = {};
    let isFallback = false;

    // Honest-label fix (2026-11-19): when no real Gemini key is configured
    // this.ai is null (constructor) and every stored embedding is a dummy
    // sin(hash) vector from generateEmbedding()'s fallback — so the semantic
    // component is noise, not a real similarity signal, and labelling the
    // run 'HYBRID' was a lie. Label it 'FALLBACK' instead. LABEL ONLY:
    // scores and weights are unchanged by this fix. Residual limitation:
    // if a key was configured when embeddings were generated and removed
    // later, real embeddings are conservatively labelled FALLBACK too —
    // and a dummy vector stored while the key was briefly unset cannot be
    // told apart from a real one. Removing the dummy-vector semantic
    // component from the score itself is a scorer change, out of scope.
    const embeddingsUsable = this.ai !== null;
    if (!embeddingsUsable) {
      isFallback = true;
    }

    const studentEmb = student.studentEmbedding;

    if (studentEmb && studentEmb.length > 0) {
      try {
        for (const m of mentors) {
          if (m.mentorEmbedding && m.mentorEmbedding.length > 0) {
            const similarity = cosineSimilarity(studentEmb, m.mentorEmbedding);
            const normalized = (similarity + 1) / 2;
            semanticScores[m._id.toString()] = isNaN(normalized) ? 0.5 : normalized;
          } else {
            semanticScores[m._id.toString()] = 0.5;
          }
        }
      } catch (err) {
        this.logger.error(`Vector search logic failed: ${err.message}. Using fallback.`);
        isFallback = true;
      }
    } else {
      isFallback = true;
    }

    const recommendations = [];
    for (const m of mentors) {
      const mIdStr = m._id.toString();

      // A–D. Text matches — token/alias matching (computeTextMatchScores
      // above). Weights unchanged; the four 0.0s the old substring /
      // exact-equality scorers produced for this kind of profile are
      // what made both mentors' bases identical.
      const textScores = computeTextMatchScores(
        {
          careerGoals: student.careerGoals,
          mentoringNeeds: student.mentoringNeeds,
          currentSkills: student.currentSkills,
          targetRole: student.targetRole,
          targetIndustry: student.targetIndustry,
        },
        {
          mentoringAreas: m.mentoringAreas,
          expertise: m.expertise,
          currentDesignation: m.currentDesignation,
          industry: m.industry,
        },
      );
      const careerGoalScore = textScores.careerGoal;
      const expertiseScore = textScores.expertise;
      const industryScore = textScores.industry;
      const roleScore = textScores.targetRole;

      // E. Availability Match (from pre-fetched map)
      // REMAINING DATA GAP (2026-11-20, match fix): a mentor with no
      // availability rows still scores the 0.5 default (5 points) —
      // unchanged here, because slots are a data problem, not a
      // scorer problem. Real slots (Item 5) are what make this
      // component differentiate.
      const availabilityScore = (availabilityByMentor.get(mIdStr) ?? 0) > 0 ? 1.0 : 0.5;

      // F. Semantic Score
      // REMAINING DATA GAP (2026-11-20, match fix): with no stored
      // student embedding (onboarding never queues one) this is still
      // the 0.5 default (17.5 points) for every mentor — unchanged
      // here. Real embeddings (a real Gemini key, or an Ollama
      // embedding model) are what make this component differentiate.
      const semanticScore = semanticScores[mIdStr] !== undefined ? semanticScores[mIdStr] : 0.5;

      const totalWeight =
        weights.semanticSimilarity +
        weights.careerGoal +
        weights.expertise +
        weights.industry +
        weights.targetRole +
        weights.availability;

      // (2026-11-20, Item 1) Per-component breakdown, in POINTS contributed
      // (each max = its weight: 35/20/15/10/10/10 with the default weights;
      // the actual configured weights are used, so the maxima follow any
      // SystemConfig MATCHING_WEIGHTS override). Rounded to 1 decimal so
      // the six values sum to matchScore (within rounding) at the default
      // weights. llmAdjustment is added by the LLM ranking step, inside
      // this same object, ONLY when the LLM genuinely ran — it is absent
      // on fallback items. The frontend renders this in the match-score
      // tooltip; no other payload field changes.
      const round1 = (n: number) => Math.round(n * 10) / 10;
      const scoreBreakdown = {
        semantic: round1(semanticScore * weights.semanticSimilarity),
        careerGoal: round1(careerGoalScore * weights.careerGoal),
        expertise: round1(expertiseScore * weights.expertise),
        industry: round1(industryScore * weights.industry),
        targetRole: round1(roleScore * weights.targetRole),
        availability: round1(availabilityScore * weights.availability),
      };

      const finalScore =
        (semanticScore * weights.semanticSimilarity +
          careerGoalScore * weights.careerGoal +
          expertiseScore * weights.expertise +
          industryScore * weights.industry +
          roleScore * weights.targetRole +
          availabilityScore * weights.availability) /
        totalWeight;

      const matchReasons: string[] = [];
      if (roleScore > 0) matchReasons.push('Matches your target role');
      if (industryScore > 0) matchReasons.push(`Relevant experience in ${m.industry}`);
      if (expertiseScore > 0) matchReasons.push('Aligns with your skill-development needs');
      if (careerGoalScore > 0) matchReasons.push('Matches your primary career goals');
      if (m.yearsOfExperience >= 5) matchReasons.push(`Senior mentorship perspective (${m.yearsOfExperience} years of experience)`);
      if (m.currentCompany) matchReasons.push(`Currently working at ${m.currentCompany}`);

      if (matchReasons.length < 2) {
        matchReasons.push('Currently accepting mentees');
        matchReasons.push('Alumni of LPU');
      }

      const user = m.userId || {};
      recommendations.push({
        id: mIdStr,
        userId: user._id?.toString() || m.userId?.toString(),
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        imageUrl: user.avatar || `https://picsum.photos/seed/${mIdStr}/200/200`,
        title: m.currentDesignation,
        company: m.currentCompany,
        experienceYears: m.yearsOfExperience,
        expertise: m.expertise,
        // Additive (2026-11-19): the LLM ranking prompt needs the mentor's
        // real mentoring areas — the base scorer already uses them, but
        // they were not in the response shape. No existing field changes.
        mentoringAreas: m.mentoringAreas,
        industry: m.industry,
        graduationYear: m.graduationYear.toString(),
        programme: m.programme,
        capacity: {
          max: m.maxCapacity,
          current: m.currentMenteesCount,
        },
        acceptingMentees: m.acceptingMentees && m.currentMenteesCount < m.maxCapacity,
        matchScore: Math.round(finalScore * 100),
        scoreBreakdown,
        matchReasons,
        matchType: isFallback ? 'FALLBACK' : 'HYBRID',
      });
    }

    return recommendations.sort((a, b) => b.matchScore - a.matchScore);
  }
}

export const matchingService = new MatchingService();
