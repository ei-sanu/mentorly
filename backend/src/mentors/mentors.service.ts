import { NotFoundException, BadRequestException } from '../common/errors';
import { MentorProfileModel, AvailabilityModel, UserModel, MentorLeaveModel } from '../database/models';
import { jobsService } from '../jobs/jobs.service';
import { Types } from 'mongoose';
import { MentorProfile, MentorProfileDocument, VerificationStatus, MentorStatus } from '../database/schemas/mentor-profile.schema';
import { Availability, AvailabilityDocument } from '../database/schemas/availability.schema';
import { MentorLeave, MentorLeaveDocument } from '../database/schemas/mentor-leave.schema';
import { User, UserDocument } from '../database/schemas/user.schema';
import { MentorQueryDto } from './dto/mentor-query.dto';
import { UpdateMentorProfileDto } from './dto/update-mentor-profile.dto';
import { CreateAvailabilityDto } from './dto/create-availability.dto';
import { CreateLeaveDto } from './dto/create-leave.dto';
import { recommendationsService } from '../recommendations/recommendations.service';

export class MentorsService {
  private readonly mentorProfileModel = MentorProfileModel;
  private readonly availabilityModel = AvailabilityModel;
  private readonly mentorLeaveModel = MentorLeaveModel;
  private readonly userModel = UserModel;
  private get jobsService() { return jobsService; }
  // Same lazy-singleton pattern as jobsService above. No import cycle:
  // recommendations.service imports only matching + llm-ranking, and
  // neither of those (nor ollama.service) imports mentors.service.
  private get recommendationsService() { return recommendationsService; }

  /**
   * (Item 5, 2026-11-20) Every /mentors/me/* write resolves the mentor's
   * OWN profile from auth — a client-passed profile id is never trusted.
   */
  private async getOwnProfileId(userId: string): Promise<Types.ObjectId> {
    const profile = await this.mentorProfileModel.findOne({ userId }).select('_id').lean();
    if (!profile) {
      throw new NotFoundException('Mentor profile not found');
    }
    return profile._id;
  }

  private mapAvailabilityRow(a: any) {
    return { ...a, id: a._id.toString() };
  }

  private mapLeaveRow(l: any) {
    return { ...l, id: l._id.toString() };
  }

  /** Start of the local today — leaves ending today still count as upcoming. */
  private startOfToday(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  async findMany(query: MentorQueryDto, isAdminOrOfficer = false): Promise<any> {
    const {
      search,
      skills,
      industry,
      role,
      experienceMin,
      experienceMax,
      availability,
      acceptingMentees,
      page = 1,
      limit = 10,
      sort,
    } = query;

    const skip = (page - 1) * limit;

    const where: any = {
      profileVisibility: true,
    };

    if (!isAdminOrOfficer) {
      where.verificationStatus = VerificationStatus.VERIFIED;
      where.status = MentorStatus.ACTIVE;
      where.acceptingMentees = true;
      where.$expr = { $lt: ['$currentMenteesCount', '$maxCapacity'] };
    } else {
      if (acceptingMentees !== undefined) {
        where.acceptingMentees = acceptingMentees;
      }
    }

    if (industry) {
      where.industry = { $regex: `^${industry}$`, $options: 'i' };
    }

    if (role) {
      where.currentDesignation = { $regex: role, $options: 'i' };
    }

    if (experienceMin !== undefined || experienceMax !== undefined) {
      where.yearsOfExperience = {};
      if (experienceMin !== undefined) where.yearsOfExperience.$gte = experienceMin;
      if (experienceMax !== undefined) where.yearsOfExperience.$lte = experienceMax;
    }

    if (skills) {
      const skillsList = skills.split(',').map((s) => s.trim());
      where.expertise = { $in: skillsList };
    }

    if (availability) {
      const dayMapping: { [key: string]: number } = {
        sunday: 0,
        monday: 1,
        tuesday: 2,
        wednesday: 3,
        thursday: 4,
        friday: 5,
        saturday: 6,
      };
      const targetDay = dayMapping[availability.toLowerCase()];
      if (targetDay !== undefined) {
        const availMentors = await this.availabilityModel
          .find({ dayOfWeek: targetDay })
          .distinct('mentorProfileId');

        where._id = { $in: availMentors };
      }
    }

    if (search) {
      const matchingUsers = await this.userModel
        .find({
          $or: [
            { firstName: { $regex: search, $options: 'i' } },
            { lastName: { $regex: search, $options: 'i' } },
          ],
        })
        .distinct('_id');

      const searchConditions: any[] = [
        { currentCompany: { $regex: search, $options: 'i' } },
        { currentDesignation: { $regex: search, $options: 'i' } },
        { bio: { $regex: search, $options: 'i' } },
        { expertise: { $in: [search] } },
      ];

      if (matchingUsers.length > 0) {
        searchConditions.push({ userId: { $in: matchingUsers } });
      }

      if (where.$or) {
        where.$and = [{ $or: where.$or }, { $or: searchConditions }];
        delete where.$or;
      } else {
        where.$or = searchConditions;
      }
    }

    let sortObj: any = { createdAt: -1 };
    if (sort) {
      const [field, direction] = sort.split('_');
      const dirValue = direction === 'asc' ? 1 : -1;
      if (field === 'experienceYears') {
        sortObj = { yearsOfExperience: dirValue };
      }
    }

    const total = await this.mentorProfileModel.countDocuments(where);
    const mentors = await this.mentorProfileModel
      .find(where)
      .select('-mentorEmbedding -__v')
      .populate({ path: 'userId', select: 'firstName lastName avatar email' })
      .sort(sortObj)
      .skip(skip)
      .limit(limit)
      .lean();

    const mapped = mentors.map((m) => this.mapToPublicProfile(m));

    return {
      success: true,
      data: mapped,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<any> {
    const mentor = await this.mentorProfileModel
      .findById(id)
      .select('-mentorEmbedding -__v')
      .populate({ path: 'userId', select: 'firstName lastName avatar email' })
      .lean();

    if (!mentor) {
      throw new NotFoundException(`Mentor with ID ${id} not found`);
    }

    return this.mapToPublicProfile(mentor);
  }

  async getAvailability(id: string): Promise<any> {
    return this.availabilityModel.find({ mentorProfileId: new Types.ObjectId(id) }).lean();
  }

  // ---- Availability + leave (Item 5, 2026-11-20) ----
  // Weekly slots are advisory for session scheduling, not a gate on
  // mentorship requests; leave is the dated, reasoned "unavailable" and
  // IS enforced (requests.service create, sessions.service createSession)
  // and shown to students. No PATCH for slots — delete + re-add avoids
  // unique-index collisions on edit.

  async getMyAvailability(userId: string): Promise<any> {
    const profileId = await this.getOwnProfileId(userId);
    const rows = await this.availabilityModel
      .find({ mentorProfileId: profileId })
      .sort({ dayOfWeek: 1, startTime: 1 })
      .lean();
    return rows.map((a) => this.mapAvailabilityRow(a));
  }

  async addAvailability(userId: string, dto: CreateAvailabilityDto): Promise<any> {
    const profileId = await this.getOwnProfileId(userId);
    // The DTO already regex-validates "HH:MM"; the lexical compare is
    // the endTime > startTime rule (24h times compare correctly as
    // strings) and is re-checked here so direct service calls are safe.
    if (!dto.startTime || !dto.endTime || dto.endTime <= dto.startTime) {
      throw new BadRequestException('End time must be after start time');
    }
    try {
      const created = new this.availabilityModel({
        mentorProfileId: profileId,
        dayOfWeek: dto.dayOfWeek,
        startTime: dto.startTime,
        endTime: dto.endTime,
        timezone: dto.timezone || 'Asia/Kolkata',
      });
      const saved = await created.save();
      return this.mapAvailabilityRow(saved.toObject());
    } catch (err: any) {
      // Unique index { mentorProfileId, dayOfWeek, startTime } — the
      // mentor already has this slot; a raw 11000 is not user-facing.
      if (err?.code === 11000) {
        throw new BadRequestException('This time slot already exists');
      }
      throw err;
    }
  }

  async deleteAvailability(userId: string, slotId: string): Promise<any> {
    const profileId = await this.getOwnProfileId(userId);
    const deleted = await this.availabilityModel
      .findOneAndDelete({ _id: new Types.ObjectId(slotId), mentorProfileId: profileId })
      .lean();
    if (!deleted) {
      throw new NotFoundException('Availability slot not found');
    }
    return { deleted: true, id: slotId };
  }

  async getMyLeaves(userId: string): Promise<any> {
    const profileId = await this.getOwnProfileId(userId);
    const rows = await this.mentorLeaveModel
      .find({ mentorProfileId: profileId })
      .sort({ startDate: 1 })
      .lean();
    return rows.map((l) => this.mapLeaveRow(l));
  }

  async addLeave(userId: string, dto: CreateLeaveDto): Promise<any> {
    const profileId = await this.getOwnProfileId(userId);
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Leave dates must be valid dates');
    }
    // Normalise to day boundaries so endDate is the LAST day inclusive:
    // a session on the end date is inside the leave, the day after is
    // not. Without this, an endDate stored at midnight would stop
    // blocking partway through its own last day.
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    if (end < start) {
      throw new BadRequestException('End date must be on or after start date');
    }
    // Overlap: any existing leave whose window intersects the new one.
    const overlapping = await this.mentorLeaveModel
      .findOne({
        mentorProfileId: profileId,
        startDate: { $lte: end },
        endDate: { $gte: start },
      })
      .lean();
    if (overlapping) {
      throw new BadRequestException('This leave overlaps an existing leave');
    }
    const created = new this.mentorLeaveModel({
      mentorProfileId: profileId,
      startDate: start,
      endDate: end,
      reason: dto.reason,
    });
    const saved = await created.save();
    return this.mapLeaveRow(saved.toObject());
  }

  async deleteLeave(userId: string, leaveId: string): Promise<any> {
    const profileId = await this.getOwnProfileId(userId);
    const deleted = await this.mentorLeaveModel
      .findOneAndDelete({ _id: new Types.ObjectId(leaveId), mentorProfileId: profileId })
      .lean();
    if (!deleted) {
      throw new NotFoundException('Leave not found');
    }
    return { deleted: true, id: leaveId };
  }

  /**
   * Public, upcoming leaves only (endDate >= start of today) — what the
   * student-facing request dialog and profile view read. The reason is
   * mentor-written for display, so it is kept.
   */
  async getLeavesByMentorId(mentorProfileId: string): Promise<any> {
    const rows = await this.mentorLeaveModel
      .find({
        mentorProfileId: new Types.ObjectId(mentorProfileId),
        endDate: { $gte: this.startOfToday() },
      })
      .sort({ startDate: 1 })
      .lean();
    return rows.map((l) => this.mapLeaveRow(l));
  }

  async getProfileByUserId(userId: string): Promise<any> {
    const profile = await this.mentorProfileModel
      .findOne({ userId })
      .select('-mentorEmbedding -__v')
      .populate({ path: 'userId', select: 'firstName lastName avatar email' })
      .lean();

    if (!profile) {
      throw new NotFoundException(`Mentor profile not found for user ${userId}`);
    }

    const availabilities = await this.availabilityModel
      .find({ mentorProfileId: profile._id })
      .lean();

    return {
      ...profile,
      id: profile._id.toString(),
      availabilities: availabilities.map((a) => ({ ...a, id: a._id.toString() })),
    };
  }

  async updateProfile(userId: string, dto: UpdateMentorProfileDto): Promise<any> {
    const existing = await this.mentorProfileModel.findOne({ userId }).lean();

    let profile;
    if (existing) {
      profile = await this.mentorProfileModel
        .findOneAndUpdate({ userId }, { $set: dto }, { new: true })
        .lean();
    } else {
      const created = new this.mentorProfileModel({
        userId,
        graduationYear: dto.graduationYear || new Date().getFullYear() - 5,
        programme: dto.programme || '',
        currentCompany: dto.currentCompany || '',
        currentDesignation: dto.currentDesignation || '',
        yearsOfExperience: dto.yearsOfExperience || 0,
        industry: dto.industry || '',
        expertise: dto.expertise || [],
        mentoringAreas: dto.mentoringAreas || [],
        bio: dto.bio || '',
        careerSummary: dto.careerSummary || '',
        maxCapacity: dto.maxCapacity || 3,
      });
      const saved = await created.save();
      profile = saved.toObject();
    }

    const profileIdStr = profile._id.toString();
    await this.jobsService.queueMentorEmbedding(profileIdStr);

    // (match-fix, 2026-11-20) A capacity / accepting change alters the
    // "N slots left" badge on every cached recommendation list (1 h
    // in-process cache under recommendations:student:<id>), and nothing
    // invalidated it — a mentor changing capacity saw no change for up
    // to an hour. Bust all recommendation caches when either field
    // changes. invalidateAllCaches() never throws (logs + swallows).
    // Other profile edits (expertise, bio, ...) are not invalidated
    // here: they change match inputs, which is the matching slice's
    // embedding/cache work, not this capacity fix.
    if (dto.maxCapacity !== undefined || dto.acceptingMentees !== undefined) {
      await this.recommendationsService.invalidateAllCaches();
    }

    return {
      ...profile,
      id: profileIdStr,
    };
  }

  mapToPublicProfile(m: any) {
    const user = m.userId || {};
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
      capacity: {
        max: m.maxCapacity,
        current: m.currentMenteesCount,
      },
      acceptingMentees: m.acceptingMentees && m.currentMenteesCount < m.maxCapacity,
    };
  }
}

export const mentorsService = new MentorsService();
