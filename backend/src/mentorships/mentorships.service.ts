import { NotFoundException, ForbiddenException, BadRequestException } from '../common/errors';
import { MentorshipModel, MentorProfileModel, StudentProfileModel } from '../database/models';
import mongoose, { Types } from 'mongoose';
import { Mentorship, MentorshipDocument, MentorshipStatus } from '../database/schemas/mentorship.schema';
import { MentorProfile, MentorProfileDocument } from '../database/schemas/mentor-profile.schema';
import { StudentProfile, StudentProfileDocument } from '../database/schemas/student-profile.schema';
import { Role } from '../database/schemas/user.schema';
import { runTransactionSafely } from '../database/transaction.helper';

export class MentorshipsService {
  private readonly mentorshipModel = MentorshipModel;
  private readonly mentorProfileModel = MentorProfileModel;
  private readonly studentProfileModel = StudentProfileModel;
  private readonly connection = mongoose.connection;

  /**
   * (2026-11-20, workspace slice Item 2) Flat display shapes for the
   * other party of a mentorship. ROOT CAUSE of the workspace header
   * rendering a bare " at ": the profile documents carry NO
   * firstName/lastName/title/company at the top level — names live on
   * the populated User doc (profile.userId) and the role/company live
   * in currentDesignation/currentCompany. The old code returned the
   * raw profile spread, so `mentor.firstName`, `mentor.title` and
   * `mentor.company` were all undefined (and findOne returned no
   * `mentor` key at all — only `mentorProfile`). The frontend
   * Mentorship type declares mentor?: MentorPublicProfile, so the
   * header rendered "{undefined} {undefined}" + "{undefined} at
   * {undefined}". These mappers build the declared shape from the
   * populated docs (same field mapping as
   * mentorsService.mapToPublicProfile, which the request cards
   * already rely on). The raw profile keys (mentorProfile /
   * studentProfile) are left untouched for any reader that uses
   * them; the mapped objects MERGE the raw spread with the flat
   * fields, so no raw field is lost.
   */
  private mapMentorDisplay(m: any) {
    if (!m) return null;
    const user = m.userId && typeof m.userId === 'object' ? m.userId : {};
    return {
      id: m._id?.toString(),
      userId: user._id?.toString() || (m.userId ? String(m.userId) : ''),
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      imageUrl: user.avatar || `https://picsum.photos/seed/${m._id}/200/200`,
      title: m.currentDesignation,
      company: m.currentCompany,
      experienceYears: m.yearsOfExperience,
      expertise: m.expertise,
      industry: m.industry,
      graduationYear: m.graduationYear?.toString(),
      programme: m.programme,
      capacity: { max: m.maxCapacity, current: m.currentMenteesCount },
      acceptingMentees: m.acceptingMentees && m.currentMenteesCount < m.maxCapacity,
      user: user._id ? { ...user, id: user._id.toString() } : null,
    };
  }

  private mapStudentDisplay(s: any) {
    if (!s) return null;
    const user = s.userId && typeof s.userId === 'object' ? s.userId : {};
    return {
      id: s._id?.toString(),
      userId: user._id?.toString() || (s.userId ? String(s.userId) : ''),
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email || '',
      imageUrl: user.avatar || '',
      programme: s.programme || '',
      school: s.school || '',
      yearOfStudy: s.yearOfStudy,
      graduationYear: s.graduationYear,
      targetRole: s.targetRole || '',
      targetIndustry: s.targetIndustry || '',
      currentSkills: s.currentSkills || [],
      user: user._id ? { ...user, id: user._id.toString() } : null,
    };
  }

  async findAll(userId: string, role: string) {
    if (role === Role.STUDENT) {
      const studentProfile = await this.studentProfileModel.findOne({ userId }).lean();
      if (!studentProfile) return [];

      const list = await this.mentorshipModel
        .find({ studentProfileId: studentProfile._id })
        .populate({
          path: 'mentorProfileId',
          populate: { path: 'userId' },
        })
        .lean();

      return list.map((m: any) => ({
        ...m,
        id: m._id.toString(),
        mentor: m.mentorProfileId
          ? {
              ...m.mentorProfileId,
              id: m.mentorProfileId._id?.toString(),
              ...this.mapMentorDisplay(m.mentorProfileId),
            }
          : null,
      }));
    } else if (role === Role.MENTOR) {
      const mentorProfile = await this.mentorProfileModel.findOne({ userId }).lean();
      if (!mentorProfile) return [];

      const list = await this.mentorshipModel
        .find({ mentorProfileId: mentorProfile._id })
        .populate({
          path: 'studentProfileId',
          populate: { path: 'userId' },
        })
        .lean();

      return list.map((m: any) => ({
        ...m,
        id: m._id.toString(),
        student: m.studentProfileId
          ? {
              ...m.studentProfileId,
              id: m.studentProfileId._id?.toString(),
              ...this.mapStudentDisplay(m.studentProfileId),
            }
          : null,
      }));
    }

    // Admin/Officer
    const list = await this.mentorshipModel
      .find()
      .populate({ path: 'studentProfileId', populate: { path: 'userId' } })
      .populate({ path: 'mentorProfileId', populate: { path: 'userId' } })
      .lean();

    return list.map((m: any) => ({
      ...m,
      id: m._id.toString(),
      student: m.studentProfileId ? { ...m.studentProfileId, id: m.studentProfileId._id?.toString() } : null,
      mentor: m.mentorProfileId ? { ...m.mentorProfileId, id: m.mentorProfileId._id?.toString() } : null,
    }));
  }

  async findOne(id: string, userId: string, isAdminOrOfficer = false): Promise<any> {
    const mentorship = await this.mentorshipModel
      .findById(id)
      .populate({ path: 'studentProfileId', populate: { path: 'userId' } })
      .populate({ path: 'mentorProfileId', populate: { path: 'userId' } })
      .lean();

    if (!mentorship) {
      throw new NotFoundException(`Mentorship with ID ${id} not found`);
    }

    const studentUserIdStr = (mentorship.studentProfileId as any).userId?._id?.toString() || (mentorship.studentProfileId as any).userId?.toString();
    const mentorUserIdStr = (mentorship.mentorProfileId as any).userId?._id?.toString() || (mentorship.mentorProfileId as any).userId?.toString();

    // TEST 6: Ownership verify
    if (
      !isAdminOrOfficer &&
      studentUserIdStr !== userId &&
      mentorUserIdStr !== userId
    ) {
      throw new ForbiddenException('Access Denied. You do not participate in this mentorship.');
    }

    return {
      ...mentorship,
      id: mentorship._id.toString(),
      // (2026-11-20, workspace slice Item 2) The workspace header and
      // the mentor workspace read mentorship.mentor / mentorship.student
      // in the flat MentorPublicProfile shape — findOne returned neither
      // key, only the raw mentorProfile/studentProfile spreads, so the
      // header rendered a bare " at ". Both are built from the same
      // populated docs as the raw keys below, which are left untouched.
      mentor: mentorship.mentorProfileId
        ? {
            ...(mentorship.mentorProfileId as any),
            id: (mentorship.mentorProfileId as any)._id?.toString(),
            ...this.mapMentorDisplay(mentorship.mentorProfileId),
          }
        : null,
      student: mentorship.studentProfileId
        ? {
            ...(mentorship.studentProfileId as any),
            id: (mentorship.studentProfileId as any)._id?.toString(),
            ...this.mapStudentDisplay(mentorship.studentProfileId),
          }
        : null,
      studentProfile: mentorship.studentProfileId
        ? {
            ...(mentorship.studentProfileId as any),
            id: (mentorship.studentProfileId as any)._id?.toString(),
            user: (mentorship.studentProfileId as any).userId
              ? {
                  ...(mentorship.studentProfileId as any).userId,
                  id: studentUserIdStr,
                }
              : null,
          }
        : null,
      mentorProfile: mentorship.mentorProfileId
        ? {
            ...(mentorship.mentorProfileId as any),
            id: (mentorship.mentorProfileId as any)._id?.toString(),
            user: (mentorship.mentorProfileId as any).userId
              ? {
                  ...(mentorship.mentorProfileId as any).userId,
                  id: mentorUserIdStr,
                }
              : null,
          }
        : null,
    };
  }

  async updateStatus(id: string, userId: string, status: MentorshipStatus): Promise<any> {
    const mentorship = await this.findOne(id, userId);

    const validTransitions: Record<string, string[]> = {
      ACTIVE: ['PAUSED', 'COMPLETED', 'CANCELLED'],
      PAUSED: ['ACTIVE', 'COMPLETED', 'CANCELLED'],
      COMPLETED: [],
      CANCELLED: [],
    };

    const allowed = validTransitions[mentorship.status] || [];
    if (!allowed.includes(status)) {
      throw new BadRequestException(
        `Cannot transition mentorship from state ${mentorship.status} to ${status}`,
      );
    }

    const updated = await runTransactionSafely(this.connection, async (session) => {
      const u = await this.mentorshipModel.findByIdAndUpdate(
        id,
        { $set: { status } },
        { new: true, session },
      ).lean();

      if (status === MentorshipStatus.COMPLETED || status === MentorshipStatus.CANCELLED) {
        const mentorProfileId = new Types.ObjectId(mentorship.mentorProfile.id);
        const mentorProfile = await this.mentorProfileModel.findById(mentorProfileId).session(session).lean();

        if (mentorProfile && mentorProfile.currentMenteesCount > 0) {
          await this.mentorProfileModel.findByIdAndUpdate(
            mentorProfileId,
            { $inc: { currentMenteesCount: -1 } },
            { session },
          );
        }
      }

      return u;
    });

    return {
      ...updated,
      id: updated._id.toString(),
    };
  }
}

export const mentorshipsService = new MentorshipsService();
