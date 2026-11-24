import { NotFoundException } from '../common/errors';
import { StudentProfileModel, UserModel } from '../database/models';
import { jobsService } from '../jobs/jobs.service';
import { recommendationsService } from '../recommendations/recommendations.service';
import { StudentProfile, StudentProfileDocument } from '../database/schemas/student-profile.schema';
import { User, UserDocument } from '../database/schemas/user.schema';
import { UpdateStudentProfileDto } from './dto/update-student-profile.dto';
import { UpdateStudentCareerDto } from './dto/update-student-career.dto';

export class StudentsService {
  private readonly studentProfileModel = StudentProfileModel;
  private readonly userModel = UserModel;
  private get jobsService() { return jobsService; }
  // Same lazy-singleton pattern as jobsService above. No import cycle:
  // recommendations.service imports only matching + llm-ranking, and
  // neither of those (nor ollama.service) imports students.service.
  private get recommendationsService() { return recommendationsService; }

  async getProfileByUserId(userId: string): Promise<any> {
    const profile = await this.studentProfileModel
      .findOne({ userId })
      .populate('userId')
      .lean();

    if (!profile) {
      throw new NotFoundException(`Student profile not found for user ${userId}`);
    }

    return {
      ...profile,
      id: profile._id.toString(),
      user: {
        ...(profile.userId as any),
        id: (profile.userId as any)._id?.toString(),
      },
    };
  }

  async updateProfile(userId: string, dto: UpdateStudentProfileDto): Promise<any> {
    const existing = await this.studentProfileModel.findOne({ userId }).lean();

    let profile;
    if (existing) {
      const completion = this.calculateCompletion({ ...existing, ...dto });
      profile = await this.studentProfileModel
        .findOneAndUpdate({ userId }, { $set: { ...dto, profileCompletion: completion } }, { new: true })
        .lean();
    } else {
      const completion = this.calculateCompletion(dto);
      const created = new this.studentProfileModel({
        userId,
        programme: dto.programme || '',
        school: dto.school || '',
        yearOfStudy: dto.yearOfStudy || 1,
        graduationYear: dto.graduationYear || new Date().getFullYear() + 4,
        interests: dto.interests || [],
        mentoringNeeds: dto.mentoringNeeds || '',
        preferredFrequency: dto.preferredFrequency || '',
        targetRole: '',
        targetIndustry: '',
        profileCompletion: completion,
      });
      const saved = await created.save();
      profile = saved.toObject();
    }

    const profileIdStr = profile._id.toString();
    await this.jobsService.queueStudentEmbedding(profileIdStr);

    // (match-fix, 2026-11-20) A student profile/career edit changes match
    // inputs, but nothing invalidated the 1 h recommendations cache
    // (recommendations:student:<id>) — the student kept seeing stale
    // matches for up to an hour. Bust this student's cache after save.
    // invalidateCacheForStudent() never throws (logs + swallows).
    await this.recommendationsService.invalidateCacheForStudent(profileIdStr);

    return {
      ...profile,
      id: profileIdStr,
    };
  }

  async updateCareer(userId: string, dto: UpdateStudentCareerDto): Promise<any> {
    const existing = await this.studentProfileModel.findOne({ userId }).lean();

    let profile;
    if (!existing) {
      const completion = this.calculateCompletion(dto);
      const created = new this.studentProfileModel({
        userId,
        programme: '',
        school: '',
        yearOfStudy: 1,
        graduationYear: new Date().getFullYear() + 4,
        interests: [],
        mentoringNeeds: '',
        preferredFrequency: '',
        careerGoals: dto.careerGoals || [],
        targetRole: dto.targetRole || '',
        targetIndustry: dto.targetIndustry || '',
        currentSkills: dto.currentSkills || [],
        profileCompletion: completion,
      });
      const saved = await created.save();
      profile = saved.toObject();
    } else {
      const completion = this.calculateCompletion({ ...existing, ...dto });
      profile = await this.studentProfileModel
        .findOneAndUpdate({ userId }, { $set: { ...dto, profileCompletion: completion } }, { new: true })
        .lean();
    }

    const profileIdStr = profile._id.toString();
    await this.jobsService.queueStudentEmbedding(profileIdStr);

    // (match-fix, 2026-11-20) A student profile/career edit changes match
    // inputs, but nothing invalidated the 1 h recommendations cache
    // (recommendations:student:<id>) — the student kept seeing stale
    // matches for up to an hour. Bust this student's cache after save.
    // invalidateCacheForStudent() never throws (logs + swallows).
    await this.recommendationsService.invalidateCacheForStudent(profileIdStr);

    return {
      ...profile,
      id: profileIdStr,
    };
  }

  private calculateCompletion(p: any): number {
    let score = 0;
    if (p.programme) score += 10;
    if (p.school) score += 10;
    if (p.yearOfStudy) score += 10;
    if (p.graduationYear) score += 10;
    if (p.interests && p.interests.length > 0) score += 15;
    if (p.mentoringNeeds) score += 15;
    if (p.targetRole) score += 10;
    if (p.targetIndustry) score += 10;
    if (p.currentSkills && p.currentSkills.length > 0) score += 10;
    return Math.min(score, 100);
  }
}

export const studentsService = new StudentsService();
