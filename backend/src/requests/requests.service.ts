import { NotFoundException, BadRequestException, ForbiddenException } from '../common/errors';
import { MentorshipRequestModel, MentorProfileModel, StudentProfileModel, UserModel, MentorshipModel, ConversationModel, MessageModel, MentorLeaveModel } from '../database/models';
import { auditService } from '../audit/audit.service';
import { notificationsService } from '../notifications/notifications.service';
import mongoose, { Types } from 'mongoose';
import { MentorshipRequest, MentorshipRequestDocument, RequestStatus } from '../database/schemas/mentorship-request.schema';
import { MentorProfile, MentorProfileDocument, VerificationStatus, MentorStatus } from '../database/schemas/mentor-profile.schema';
import { StudentProfile, StudentProfileDocument } from '../database/schemas/student-profile.schema';
import { User, UserDocument, Role } from '../database/schemas/user.schema';
import { Mentorship, MentorshipDocument, MentorshipStatus } from '../database/schemas/mentorship.schema';
import { Conversation, ConversationDocument } from '../database/schemas/conversation.schema';
import { Message, MessageDocument } from '../database/schemas/message.schema';
import { CreateRequestDto } from './dto/create-request.dto';
import { requestRefinementService } from './request-refinement.service';
import { runTransactionSafely } from '../database/transaction.helper';
import { globalEventBus } from '../common/event-bus';
import { mentorsService } from '../mentors/mentors.service';

export class RequestsService {
  private readonly requestModel = MentorshipRequestModel;
  private readonly mentorProfileModel = MentorProfileModel;
  private readonly studentProfileModel = StudentProfileModel;
  private readonly userModel = UserModel;
  private readonly mentorshipModel = MentorshipModel;
  private readonly conversationModel = ConversationModel;
  private readonly messageModel = MessageModel;
  private readonly mentorLeaveModel = MentorLeaveModel;
  private get audit() { return auditService; }
  private get notifications() { return notificationsService; }
  private readonly connection = mongoose.connection;

  /**
   * Shape a populated mentor profile exactly like GET /mentors/:id does
   * (MentorPublicProfile: firstName/lastName/title/company/imageUrl at
   * the top level). The raw profile document carries none of those
   * names — the names live on the nested populated user, the role and
   * company are currentDesignation/currentCompany — so spreading the
   * raw document made the student request cards render a blank name
   * and a dangling "at". The nested `user` object is kept for
   * consumers that already read it.
   */
  private mapRequestMentor(mentorDoc: any) {
    if (!mentorDoc || !mentorDoc._id) return null;
    const mapped = mentorsService.mapToPublicProfile(mentorDoc);
    const user = mentorDoc.userId && typeof mentorDoc.userId === 'object' ? mentorDoc.userId : null;
    return {
      ...mapped,
      user: user ? { ...user, id: user._id?.toString() } : null,
    };
  }

  /** An id field that may be an ObjectId, a populated document, or a string — always a string. */
  private toIdString(value: any): string | null {
    if (!value) return null;
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && value._id) return value._id.toString();
    return value.toString();
  }

  /**
   * (Item 3, 2026-11-20) Whitelist a StudentProfile row for mentor-facing
   * request responses. Only these 7 fields — never spread the profile
   * doc. Returns null when no profile row exists, so the frontend renders
   * "Not provided" instead of inventing a programme.
   */
  private pickStudentProfile(profile: any) {
    if (!profile) return null;
    return {
      programme: profile.programme,
      school: profile.school,
      yearOfStudy: profile.yearOfStudy,
      graduationYear: profile.graduationYear,
      targetRole: profile.targetRole,
      currentSkills: profile.currentSkills,
      mentoringNeeds: profile.mentoringNeeds,
    };
  }

  /** Local-day boundaries, for "is today inside this leave?" checks. */
  private todayBounds() {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    return { startOfToday, endOfToday };
  }

  /** Human leave date for error messages, e.g. "30 Nov 2026". */
  private formatLeaveDate(value: any): string {
    return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  async create(studentUserId: string, dto: CreateRequestDto): Promise<any> {
    const studentProfile = await this.studentProfileModel.findOne({ userId: studentUserId }).lean();
    if (!studentProfile) {
      throw new BadRequestException('You must complete your career profile before requesting a mentor.');
    }

    // 1. Throttling Limit check: Max 3 pending requests (TEST 3)
    const pendingCount = await this.requestModel.countDocuments({
      studentId: new Types.ObjectId(studentUserId),
      status: RequestStatus.PENDING,
    });

    if (pendingCount >= 3) {
      throw new BadRequestException('You have reached the maximum limit of 3 pending requests.');
    }

    // The mentor id arrives in the request body (no :id route guard can
    // cover it). Reject a malformed id here, before findById() turns it
    // into a raw Mongoose CastError ("input must be a 24 character hex
    // string...") that used to reach the user as a 500.
    if (!Types.ObjectId.isValid(dto.mentorId)) {
      throw new BadRequestException('Please choose a valid mentor and try again.');
    }

    const mentor = await this.mentorProfileModel.findById(dto.mentorId).populate('userId').lean();
    if (!mentor) {
      throw new NotFoundException('Mentor not found');
    }

    // TEST 5: Unverified mentor check
    if (mentor.verificationStatus !== VerificationStatus.VERIFIED) {
      throw new BadRequestException('This mentor is not verified yet.');
    }

    if (mentor.status !== MentorStatus.ACTIVE || !mentor.acceptingMentees) {
      throw new BadRequestException('This mentor is not currently accepting new requests.');
    }

    // (Item 5, 2026-11-20) Leave backstop: a mentor on leave today cannot
    // take a new request. The student-facing dialog shows the leave
    // before sending; this is the enforcement if the dialog is bypassed
    // or the leave started after the dialog loaded. Leave dates are
    // stored start-of-day / end-of-day, so "today inside the leave" is
    // a day-boundary overlap, not a midnight comparison.
    const { startOfToday, endOfToday } = this.todayBounds();
    const activeLeave = await this.mentorLeaveModel
      .findOne({
        mentorProfileId: mentor._id,
        startDate: { $lte: endOfToday },
        endDate: { $gte: startOfToday },
      })
      .lean();
    if (activeLeave) {
      throw new BadRequestException(`This mentor is on leave until ${this.formatLeaveDate((activeLeave as any).endDate)}.`);
    }

    if (mentor.currentMenteesCount >= mentor.maxCapacity) {
      throw new BadRequestException('This mentor is currently at capacity.');
    }

    // Check if request is already active or pending with this mentor
    const existing = await this.requestModel.findOne({
      studentId: new Types.ObjectId(studentUserId),
      mentorId: new Types.ObjectId(dto.mentorId),
      status: { $in: [RequestStatus.PENDING, RequestStatus.ACCEPTED] },
    });

    if (existing) {
      throw new BadRequestException('You already have a pending request or active mentorship with this mentor.');
    }

    const request = new this.requestModel({
      studentId: new Types.ObjectId(studentUserId),
      mentorId: new Types.ObjectId(dto.mentorId),
      message: dto.message,
      goal: dto.goal,
      status: RequestStatus.PENDING,
    });
    await request.save();

    const requestPopulated = await this.requestModel
      .findById(request._id)
      .populate('studentId')
      .lean();

    if (!requestPopulated) {
      throw new BadRequestException('Failed to retrieve created request details.');
    }

    // AI refinement (2026-11-20): the local Llama model rewrites the
    // student's goal + message into a clear summary for the mentor (see
    // request-refinement.service.ts). It runs in the BACKGROUND — never
    // awaited, never allowed to fail or delay this response: the request
    // is already created and the 201 below goes out immediately; the
    // summary lands on the request document when the model answers and
    // the mentor sees it on their next load. Any failure leaves the
    // original text untouched, with the error kind recorded on the
    // request. The trailing .catch is belt-and-braces: refine() itself
    // never throws.
    void requestRefinementService
      .refine(request._id.toString(), dto.goal, dto.message, {
        programme: studentProfile.programme,
        school: studentProfile.school,
        targetRole: studentProfile.targetRole,
        targetIndustry: studentProfile.targetIndustry,
        currentSkills: studentProfile.currentSkills,
        careerGoals: studentProfile.careerGoals,
        interests: studentProfile.interests,
        mentoringNeeds: studentProfile.mentoringNeeds,
      })
      .catch(() => undefined);

    // Notify Mentor — mentor was fetched with .populate('userId').lean(),
    // so userId is a PLAIN OBJECT ({ _id, firstName, ... }), not a
    // Mongoose document: .toString() on it is "[object Object]", and the
    // notification insert then threw a BSONError ("input must be a 24
    // character hex string...") AFTER the request row was already saved
    // — the student saw "That link looks broken" for a request that
    // actually exists (2026-11-20). toIdString() reads the _id off the
    // populated object (and still accepts a raw ObjectId/string), so the
    // mentor's real user id flows.
    await this.notifications.create(
      this.toIdString(mentor.userId),
      'NEW_REQUEST',
      'New Mentorship Request',
      `${(requestPopulated.studentId as any).firstName} ${(requestPopulated.studentId as any).lastName} requested you as a mentor for: ${dto.goal}`,
      { requestId: request._id.toString() },
    );

    await this.audit.log(
      studentUserId,
      'SEND_REQUEST',
      'MentorshipRequest',
      request._id.toString(),
      { mentorId: dto.mentorId },
    );

    globalEventBus.emit('dashboard_update', { type: 'MENTORSHIP_REQUEST_CREATED' });

    return {
      ...requestPopulated,
      id: request._id.toString(),
    };
  }

  async findAll(userId: string, role: string) {
    // Role-pending users (no role chosen yet) have no requests of their
    // own — and must never fall through to the privileged "all
    // requests" branch below. The auth guard already fences them to
    // onboarding; this is defence in depth for direct service calls.
    if (role === Role.PENDING) {
      return [];
    }
    if (role === Role.STUDENT) {
      const list = await this.requestModel
        .find({ studentId: new Types.ObjectId(userId) })
        .populate({
          path: 'mentorId',
          populate: { path: 'userId' },
        })
        .sort({ createdAt: -1 })
        .lean();

      return list.map((r: any) => ({
        ...r,
        id: r._id.toString(),
        // (2026-11-20) studentId is the caller's own id, unpopulated
        // here — a raw ObjectId in the lean doc, not a string. Normalise
        // it like mentorId so every consumer can rely on `string`.
        studentId: this.toIdString(r.studentId),
        mentorId: this.toIdString(r.mentorId),
        mentor: this.mapRequestMentor(r.mentorId),
      }));
    } else if (role === Role.MENTOR) {
      const mentorProfile = await this.mentorProfileModel.findOne({ userId }).lean();
      if (!mentorProfile) return [];

      const list = await this.requestModel
        .find({ mentorId: mentorProfile._id })
        .populate('studentId')
        .sort({ createdAt: -1 })
        .lean();

      // (Item 3, 2026-11-20) Attach the whitelisted studentProfile to
      // every row. ONE $in query over the page's student user ids, keyed
      // by user id — never one query per row. Students with no profile
      // row get studentProfile: null.
      const studentUserIds = [...new Set(
        list.map((r: any) => this.toIdString(r.studentId)).filter((id): id is string => !!id && Types.ObjectId.isValid(id)),
      )];
      const profilesByUser = new Map<string, any>();
      if (studentUserIds.length > 0) {
        const profiles = await this.studentProfileModel
          .find({ userId: { $in: studentUserIds.map((id) => new Types.ObjectId(id)) } })
          .lean();
        for (const p of profiles as any[]) {
          profilesByUser.set(p.userId?.toString(), p);
        }
      }

      // (2026-11-20) the spread above used to leak the POPULATED student
      // User document into `studentId` (a plain object, not a string),
      // so calling .slice() on it in the mentor dashboard threw
      // "slice is not a function" and crashed the whole page. studentId
      // is now a plain string id — the populated student lives in
      // `student` (firstName/lastName) for display.
      return list.map((r: any) => ({
        ...r,
        id: r._id.toString(),
        studentId: this.toIdString(r.studentId),
        mentorId: this.toIdString(r.mentorId),
        student: r.studentId
          ? {
              ...r.studentId,
              id: r.studentId._id?.toString(),
            }
          : null,
        studentProfile: this.pickStudentProfile(profilesByUser.get(this.toIdString(r.studentId) || '')),
      }));
    }

    const list = await this.requestModel
      .find()
      .populate('studentId')
      .populate({
        path: 'mentorId',
        populate: { path: 'userId' },
      })
      .sort({ createdAt: -1 })
      .lean();

    return list.map((r: any) => ({
      ...r,
      id: r._id.toString(),
      studentId: this.toIdString(r.studentId),
      mentorId: this.toIdString(r.mentorId),
      student: r.studentId ? { ...r.studentId, id: r.studentId._id?.toString() } : null,
      mentor: this.mapRequestMentor(r.mentorId),
    }));
  }

  async findOne(id: string, userId: string): Promise<any> {
    const request = await this.requestModel
      .findById(id)
      .populate('studentId')
      .populate({
        path: 'mentorId',
        populate: { path: 'userId' },
      })
      .lean();

    if (!request) {
      throw new NotFoundException(`Request with ID ${id} not found`);
    }

    const requestStudentIdStr = request.studentId._id?.toString() || request.studentId?.toString();
    const mentorUserIdStr = (request.mentorId as any)?.userId?._id?.toString() || (request.mentorId as any)?.userId?.toString();

    // Check ownership
    if (requestStudentIdStr !== userId && mentorUserIdStr !== userId) {
      throw new ForbiddenException('Access denied. You do not own this request.');
    }

    // (Item 3, 2026-11-20) Same whitelisted studentProfile as the list
    // branch — the detail dialog reads it from here. Null when the
    // student has no profile row.
    const studentProfile = requestStudentIdStr
      ? await this.studentProfileModel.findOne({ userId: requestStudentIdStr }).lean()
      : null;

    return {
      ...request,
      id: request._id.toString(),
      // (2026-11-20) same normalisation as findAll: the spread leaks the
      // populated student document into studentId — send the string id.
      studentId: requestStudentIdStr,
      mentorId: this.toIdString(request.mentorId),
      student: request.studentId ? { ...request.studentId, id: requestStudentIdStr } : null,
      mentor: this.mapRequestMentor(request.mentorId),
      studentProfile: this.pickStudentProfile(studentProfile),
    };
  }

  async accept(id: string, mentorUserId: string) {
    const request = await this.requestModel
      .findById(id)
      .populate('studentId')
      .populate({
        path: 'mentorId',
        populate: { path: 'userId' },
      })
      .lean();

    if (!request) {
      throw new NotFoundException(`Request with ID ${id} not found`);
    }

    const mentorUserIdStr = (request.mentorId as any)?.userId?._id?.toString() || (request.mentorId as any)?.userId?.toString();
    if (mentorUserIdStr !== mentorUserId) {
      throw new ForbiddenException('Access denied. You are not the assigned mentor.');
    }

    // TEST 4: Request expiration check
    if (request.status === RequestStatus.EXPIRED) {
      throw new BadRequestException('This request has expired and cannot be accepted.');
    }

    if (request.status !== RequestStatus.PENDING) {
      throw new BadRequestException(`Request cannot be accepted in state: ${request.status}`);
    }

    const { mentorship, conversationId } = await runTransactionSafely(this.connection, async (session) => {
      // 1. Update request status to ACCEPTED
      await this.requestModel.findByIdAndUpdate(
        id,
        { $set: { status: RequestStatus.ACCEPTED } },
        { session },
      );

      const updatedMentor = await this.mentorProfileModel.findByIdAndUpdate(
        (request.mentorId as any)._id,
        { $inc: { currentMenteesCount: 1 } },
        { new: true, session },
      ).lean();

      if (!updatedMentor) {
        throw new BadRequestException('Mentor profile not found.');
      }

      if (updatedMentor.currentMenteesCount > updatedMentor.maxCapacity) {
        throw new BadRequestException('This mentor is currently at capacity.');
      }

      // Check if student profile exists, if not create
      let studentProfile = await this.studentProfileModel
        .findOne({ userId: request.studentId._id })
        .session(session)
        .lean();

      if (!studentProfile) {
        const created = new this.studentProfileModel({
          userId: request.studentId._id,
          programme: 'B.Tech',
          school: 'LPU',
          yearOfStudy: 1,
          graduationYear: new Date().getFullYear() + 4,
          interests: [],
          mentoringNeeds: 'General career growth',
          preferredFrequency: 'Weekly',
          targetRole: '',
          targetIndustry: '',
        });
        const saved = await created.save({ session });
        studentProfile = saved.toObject();
      }

      // 3. Create Mentorship
      const createdMentorship = new this.mentorshipModel({
        studentProfileId: studentProfile._id,
        mentorProfileId: (request.mentorId as any)._id,
        status: MentorshipStatus.ACTIVE,
        startDate: new Date(),
      });
      const savedMentorship = await createdMentorship.save({ session });
      const m = savedMentorship.toObject();

      // 4. Create Private Conversation
      const conversation = new this.conversationModel({
        mentorshipId: m._id,
        participants: [request.studentId._id, new Types.ObjectId(mentorUserId)],
      });
      await conversation.save({ session });

      // 5. Send Initial welcome message
      const welcomeMessage = new this.messageModel({
        conversationId: conversation._id,
        senderId: new Types.ObjectId(mentorUserId),
        content: `Hi! I have accepted your mentorship request. I am excited to connect and help you with: "${request.goal}". Let's schedule a session!`,
      });
      await welcomeMessage.save({ session });

      // (Item 4, 2026-11-20) The conversation id is returned with the
      // mentorship so the accept flow can navigate straight to Messages
      // — the frontend never learned it before, and there was no link
      // from an accepted mentorship to its conversation.
      return { mentorship: m, conversationId: conversation._id.toString() };
    });

    const studentIdStr = request.studentId._id.toString();

    // Notify Student
    await this.notifications.create(
      studentIdStr,
      'REQUEST_ACCEPTED',
      'Mentorship Request Accepted!',
      `Mentor ${(request.mentorId as any).userId.firstName} ${(request.mentorId as any).userId.lastName} has accepted your request.`,
      { mentorshipId: mentorship._id.toString(), conversationId },
    );

    await this.audit.log(
      mentorUserId,
      'ACCEPT_REQUEST',
      'MentorshipRequest',
      id,
      { studentUserId: studentIdStr, mentorshipId: mentorship._id.toString() },
    );

    globalEventBus.emit('dashboard_update', { type: 'MENTORSHIP_REQUEST_ACCEPTED' });

    return {
      ...mentorship,
      id: mentorship._id.toString(),
      conversationId,
    };
  }

  async decline(id: string, mentorUserId: string): Promise<any> {
    const request = await this.requestModel
      .findById(id)
      .populate({
        path: 'mentorId',
        populate: { path: 'userId' },
      })
      .lean();

    if (!request) {
      throw new NotFoundException('Request not found');
    }

    const mentorUserIdStr = (request.mentorId as any).userId?._id?.toString() || (request.mentorId as any).userId?.toString();
    if (mentorUserIdStr !== mentorUserId) {
      throw new ForbiddenException('Access denied. You are not the assigned mentor.');
    }

    if (request.status !== RequestStatus.PENDING) {
      throw new BadRequestException('Request is not pending');
    }

    const updated = await this.requestModel
      .findByIdAndUpdate(id, { $set: { status: RequestStatus.DECLINED } }, { new: true })
      .lean();

    const studentIdStr = request.studentId.toString();

    // Notify Student
    await this.notifications.create(
      studentIdStr,
      'REQUEST_DECLINED',
      'Mentorship Request Declined',
      `Mentor ${(request.mentorId as any).userId.firstName} ${(request.mentorId as any).userId.lastName} has declined your request.`,
      { requestId: id },
    );

    await this.audit.log(
      mentorUserId,
      'DECLINE_REQUEST',
      'MentorshipRequest',
      id,
      { studentUserId: studentIdStr },
    );

    globalEventBus.emit('dashboard_update', { type: 'MENTORSHIP_REQUEST_DECLINED' });

    return {
      ...updated,
      id: updated._id.toString(),
    };
  }

  async cancel(id: string, studentUserId: string): Promise<any> {
    const request = await this.requestModel.findById(id).lean();
    if (!request) {
      throw new NotFoundException('Request not found');
    }

    const studentIdStr = request.studentId.toString();
    if (studentIdStr !== studentUserId) {
      throw new ForbiddenException('Access denied. You did not submit this request.');
    }

    if (request.status !== RequestStatus.PENDING) {
      throw new BadRequestException('Only pending requests can be cancelled.');
    }

    const updated = await this.requestModel
      .findByIdAndUpdate(id, { $set: { status: RequestStatus.CANCELLED } }, { new: true })
      .lean();

    await this.audit.log(
      studentUserId,
      'CANCEL_REQUEST',
      'MentorshipRequest',
      id,
      { mentorId: request.mentorId.toString() },
    );

    globalEventBus.emit('dashboard_update', { type: 'MENTORSHIP_REQUEST_CANCELLED' });

    return {
      ...updated,
      id: updated._id.toString(),
    };
  }
}

export const requestsService = new RequestsService();
