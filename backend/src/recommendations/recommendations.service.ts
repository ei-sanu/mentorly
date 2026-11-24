import { NotFoundException } from '../common/errors';
import { StudentProfileModel, MentorProfileModel } from '../database/models';
import { matchingService } from '../matching/matching.service';
import { Types } from 'mongoose';
import { StudentProfile, StudentProfileDocument } from '../database/schemas/student-profile.schema';
import { MentorProfile, MentorProfileDocument, VerificationStatus, MentorStatus } from '../database/schemas/mentor-profile.schema';
import { inMemoryStore } from '../common/in-memory-store';
import { llmRankingService } from './llm-ranking.service';

export class RecommendationsService {
  // In-process cache (was Upstash Redis). Same get/setex/del/keys API,
  // shared instance so invalidate*() busts exactly what get*() cached.
  private redis = inMemoryStore;

  private readonly studentProfileModel = StudentProfileModel;
  private readonly mentorProfileModel = MentorProfileModel;
  private get matchingService() { return matchingService; }
  private get llmRankingService() { return llmRankingService; }

  async getRecommendedMentors(userId: string) {
    const studentProfile = await this.studentProfileModel.findOne({ userId: new Types.ObjectId(userId) }).lean();

    if (!studentProfile) {
      // Return default verified active mentors if student profile is not complete
      const mentors = await this.mentorProfileModel
        .find({
          verificationStatus: VerificationStatus.VERIFIED,
          status: MentorStatus.ACTIVE,
          acceptingMentees: true,
        })
        .select('-mentorEmbedding -__v')
        .populate({ path: 'userId', select: 'firstName lastName avatar' })
        .limit(5)
        .lean();

      return mentors.map((m: any) => {
        const user = m.userId || {};
        // No student profile exists, so no real match can be computed:
        // matchScore 80 stays a documented placeholder (it cannot be a
        // real score with nothing to match against) and no LLM call is
        // made (there are no student fields to ground a ranking in).
        // (2026-11-20, Item 1) These items deliberately carry NO
        // scoreBreakdown: a breakdown of zeros would sum to 0, not 80,
        // and inventing component points for a placeholder score would
        // be fake data. The frontend tooltip must hide/skip when
        // scoreBreakdown is absent.
        // What IS improved honestly: reasons now come from the mentor's
        // own real fields instead of the generic pair, and the item is
        // labelled FALLBACK with llmUsed: false. The User doc carries
        // only identity fields (name/email/role) — nothing that grounds
        // a match reason — so no student-derived reason is invented.
        const noProfileReasons: string[] = [];
        if (m.currentCompany) noProfileReasons.push(`Currently working at ${m.currentCompany}`);
        if (Array.isArray(m.expertise) && m.expertise.length > 0) {
          noProfileReasons.push(`Expertise in ${m.expertise.slice(0, 2).join(', ')}`);
        }
        if (m.yearsOfExperience >= 5) {
          noProfileReasons.push(`Senior mentorship perspective (${m.yearsOfExperience} years of experience)`);
        }
        if (noProfileReasons.length < 2) {
          noProfileReasons.push('Currently accepting mentees');
          noProfileReasons.push('Alumni of LPU');
        }
        return {
          id: m._id.toString(),
          userId: user._id?.toString() || m.userId?.toString(),
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          imageUrl: user.avatar || `https://picsum.photos/seed/${m._id}/200/200`,
          title: m.currentDesignation,
          company: m.currentCompany,
          experienceYears: m.yearsOfExperience,
          expertise: m.expertise,
          industry: m.industry,
          graduationYear: m.graduationYear.toString(),
          programme: m.programme,
          capacity: { max: m.maxCapacity, current: m.currentMenteesCount },
          acceptingMentees: m.acceptingMentees,
          matchScore: 80,
          matchReasons: noProfileReasons,
          matchType: 'FALLBACK',
          llmUsed: false,
        };
      });
    }

    const studentProfileIdStr = studentProfile._id.toString();
    const cacheKey = `recommendations:student:${studentProfileIdStr}`;

    if (this.redis) {
      try {
        const cached = await this.redis.get(cacheKey);
        if (cached) {
          return JSON.parse(cached);
        }
      } catch (err) {
        console.warn(`Failed to fetch cached recommendations: ${err.message}`);
      }
    }

    const baseRecommendations = await this.matchingService.calculateRecommendation(studentProfileIdStr);

    // Phase 2 (2026-11-19): LLM re-ranking at the COMPUTE step (cache miss
    // only — never per HTTP request). rankAndApply() falls back to the base
    // list on any LLM failure, so `recommendations` is always safe to
    // serve and cache. Cache decision: the LLM-ranked list is stored under
    // the EXISTING key with its honest per-item labels (matchType 'LLM' /
    // llmUsed / llmError) attached, so a cached entry always describes how
    // it was computed; a later LLM outage cannot mislabel anything — the
    // next cache miss simply recomputes under the then-current LLM state.
    // getMentorMatchDetails() deliberately does NOT call the LLM: it
    // returns a single mentor, and ranking one candidate is meaningless.
    const ranked = await this.llmRankingService.rankAndApply(studentProfile, baseRecommendations);
    const recommendations = ranked.recommendations;

    if (this.redis) {
      try {
        await this.redis.setex(cacheKey, 3600, JSON.stringify(recommendations));
      } catch (err) {
        console.warn(`Failed to cache recommendations: ${err.message}`);
      }
    }

    return recommendations;
  }

  async getMentorMatchDetails(userId: string, mentorId: string) {
    const studentProfile = await this.studentProfileModel.findOne({ userId: new Types.ObjectId(userId) }).lean();

    if (!studentProfile) {
      throw new NotFoundException('Please complete your student career profile first');
    }

    const matches = await this.matchingService.calculateRecommendation(studentProfile._id.toString(), mentorId);
    if (matches.length === 0) {
      throw new NotFoundException('Mentor is not eligible or not found');
    }

    return matches[0];
  }

  async invalidateCacheForStudent(studentProfileId: string) {
    if (this.redis) {
      try {
        await this.redis.del(`recommendations:student:${studentProfileId}`);
      } catch (err) {
        console.warn(`Failed to invalidate cache for student ${studentProfileId}: ${err.message}`);
      }
    }
  }

  async invalidateAllCaches(): Promise<void> {
    if (this.redis) {
      try {
        const keys = await this.redis.keys('recommendations:student:*');
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      } catch (err) {
        console.warn(`Failed to invalidate all caches: ${err.message}`);
      }
    }
  }
}

export const recommendationsService = new RecommendationsService();
