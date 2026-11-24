import { NotFoundException, ForbiddenException, BadRequestException } from '../common/errors';
import { SessionModel, MentorshipModel, MentorLeaveModel } from '../database/models';
import { notificationsService } from '../notifications/notifications.service';
import { calendarService } from '../calendar/calendar.service';
import { auditService } from '../audit/audit.service';
import { Types } from 'mongoose';
import { Session, SessionDocument, SessionStatus, CalendarSyncStatus } from '../database/schemas/session.schema';
import { Mentorship, MentorshipDocument, MentorshipStatus } from '../database/schemas/mentorship.schema';
import { CreateSessionDto } from './dto/create-session.dto';
import { globalEventBus } from '../common/event-bus';

export class SessionsService {
  private readonly sessionModel = SessionModel;
  private readonly mentorshipModel = MentorshipModel;
  private readonly mentorLeaveModel = MentorLeaveModel;
  private get notifications() { return notificationsService; }
  private get calendar() { return calendarService; }
  private get audit() { return auditService; }

  /**
   * (Item 6, 2026-11-20) The Step-4 proof-link idiom: a real URL whose
   * protocol is http: or https: — nothing else (no ftp:, no javascript:,
   * no bare hostname). Used by createSession (defence in depth behind
   * the DTO's @IsUrl) and by updateSession, whose dto is `any` and has
   * no DTO validation at all. Empty/whitespace is NOT valid here — the
   * callers treat empty as "no link" before calling this.
   */
  private isValidHttpUrl(value: any): boolean {
    if (typeof value !== 'string' || value.trim() === '') return false;
    try {
      const url = new URL(value.trim());
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /** Normalise an optional supplied link: trimmed string, or undefined when absent/empty. Throws on an invalid URL. */
  private normaliseMeetingUrl(value: any): string | undefined {
    if (value === undefined || value === null) return undefined;
    if (typeof value !== 'string' || value.trim() === '') return undefined;
    if (!this.isValidHttpUrl(value)) {
      throw new BadRequestException('Meeting link must be a valid http(s) URL');
    }
    return value.trim();
  }

  async findSessionsForMentorship(mentorshipId: string, userId: string): Promise<any[]> {
    const mentorship = await this.mentorshipModel
      .findById(mentorshipId)
      .populate('studentProfileId')
      .populate('mentorProfileId')
      .lean();

    if (!mentorship) {
      throw new NotFoundException('Mentorship not found');
    }

    const studentUserIdStr = (mentorship.studentProfileId as any).userId?.toString();
    const mentorUserIdStr = (mentorship.mentorProfileId as any).userId?.toString();

    if (studentUserIdStr !== userId && mentorUserIdStr !== userId) {
      return [];
    }

    const list = await this.sessionModel
      .find({ mentorshipId: new Types.ObjectId(mentorshipId) })
      .sort({ startTime: 1 })
      .lean();

    return list.map((s) => ({
      ...s,
      id: s._id.toString(),
    }));
  }

  async createSession(mentorshipId: string, userId: string, dto: CreateSessionDto): Promise<any> {
    const mentorship = await this.mentorshipModel
      .findById(mentorshipId)
      .populate({ path: 'studentProfileId', populate: { path: 'userId' } })
      .populate({ path: 'mentorProfileId', populate: { path: 'userId' } })
      .lean();

    if (!mentorship) {
      throw new NotFoundException('Mentorship not found');
    }

    if (mentorship.status !== MentorshipStatus.ACTIVE) {
      throw new BadRequestException('Can only book sessions for ACTIVE mentorships');
    }

    const studentUserIdStr = (mentorship.studentProfileId as any).userId?._id?.toString();
    const mentorUserIdStr = (mentorship.mentorProfileId as any).userId?._id?.toString();

    if (studentUserIdStr !== userId && mentorUserIdStr !== userId) {
      throw new ForbiddenException('Access denied. You do not participate in this mentorship.');
    }

    const start = new Date(dto.startTime);
    const end = new Date(dto.endTime);

    if (start >= end) {
      throw new BadRequestException('End time must be after start time');
    }

    // (Item 3, 2026-11-20) A session cannot start in the past. The chat
    // schedule dialog validates this client-side first (future-only);
    // this is the server backstop, so a past start is rejected no matter
    // which client calls POST /mentorships/:id/sessions. updateSession
    // is untouched — rescheduling an existing session is a separate
    // flow and keeps its own rules.
    if (start <= new Date()) {
      throw new BadRequestException('Session start time must be in the future');
    }

    // Find all active mentorships for this student or mentor to check for overlap
    const activeMentorshipIds = await this.mentorshipModel
      .find({
        $or: [
          { studentProfileId: (mentorship.studentProfileId as any)._id },
          { mentorProfileId: (mentorship.mentorProfileId as any)._id },
        ],
      })
      .distinct('_id');

    // 1. Transaction-safe Overlap conflict detection (TEST 9)
    const conflict = await this.sessionModel.findOne({
      status: SessionStatus.SCHEDULED,
      mentorshipId: { $in: activeMentorshipIds },
      startTime: { $lt: end },
      endTime: { $gt: start },
    });

    if (conflict) {
      throw new BadRequestException('Scheduling conflict. Either the student or mentor is already booked.');
    }

    // (Item 5, 2026-11-20) Leave backstop: no session inside a mentor
    // leave. Leave dates are stored start-of-day / end-of-day, so a
    // session window intersecting the leave window is the right test —
    // a session on the leave's last day IS inside it.
    const blockingLeave = await this.mentorLeaveModel
      .findOne({
        mentorProfileId: (mentorship.mentorProfileId as any)._id,
        startDate: { $lte: end },
        endDate: { $gte: start },
      })
      .lean();
    if (blockingLeave) {
      throw new BadRequestException('Mentor is on leave during this time.');
    }

    // 2. Create local session
    // (Item 6, 2026-11-20) The fake link is GONE: createSession used to
    // store 'https://meet.google.com/mock-link-' + random for every
    // session. meetingUrl is now undefined unless the caller supplied a
    // real, validated link — never generated. Existing Mongo rows keep
    // their fake values (no silent rewrite); the one-off cleanup is in
    // the MANIFEST.
    // (2026-11-20, workspace slice Item 3) Who creates the session
    // decides its status. A student can only SEND a schedule request:
    // it is stored REQUESTED and is not a confirmed session until the
    // mentor approves it. A mentor scheduling directly creates a
    // confirmed SCHEDULED session, exactly as before.
    const isStudentCreator = userId === studentUserIdStr;
    const session = new this.sessionModel({
      mentorshipId: new Types.ObjectId(mentorshipId),
      title: dto.title,
      startTime: start,
      endTime: end,
      timezone: dto.timezone || 'Asia/Kolkata',
      status: isStudentCreator ? SessionStatus.REQUESTED : SessionStatus.SCHEDULED,
      notes: dto.notes,
      createdBy: userId,
      meetingUrl: this.normaliseMeetingUrl(dto.meetingUrl),
      calendarSyncStatus: CalendarSyncStatus.PENDING,
    });
    await session.save();

    const sessionIdStr = session._id.toString();

    // 3. Sync Calendar asynchronously (TEST 66) — confirmed sessions
    // only. A REQUESTED session has no calendar event until the mentor
    // approves it (approveSession syncs then).
    if (!isStudentCreator) {
      this.calendar.syncSessionEvent(sessionIdStr).catch((err) => {
        console.error(`Deferred calendar sync failed for session ${sessionIdStr}: ${err.message}`);
      });
    }

    // 4. Notifications
    const receiverId = userId === studentUserIdStr ? mentorUserIdStr : studentUserIdStr;
    const requesterName = userId === studentUserIdStr
      ? `${(mentorship.studentProfileId as any).userId.firstName} ${(mentorship.studentProfileId as any).userId.lastName}`
      : `${(mentorship.mentorProfileId as any).userId.firstName} ${(mentorship.mentorProfileId as any).userId.lastName}`;

    if (isStudentCreator) {
      await this.notifications.create(
        receiverId,
        'SESSION_REQUESTED',
        'New Session Request',
        `${requesterName} requested a session: "${dto.title}" on ${start.toLocaleDateString()}`,
        { sessionId: sessionIdStr },
      );
    } else {
      await this.notifications.create(
        receiverId,
        'SESSION_SCHEDULED',
        'New Mentorship Session Scheduled',
        `${requesterName} scheduled a session: "${dto.title}" on ${start.toLocaleDateString()}`,
        { sessionId: sessionIdStr },
      );
    }

    await this.audit.log(
      userId,
      isStudentCreator ? 'REQUEST_SESSION' : 'SCHEDULE_SESSION',
      'Session',
      sessionIdStr,
      { mentorshipId },
    );

    globalEventBus.emit('dashboard_update', { type: isStudentCreator ? 'SESSION_REQUESTED' : 'SESSION_BOOKED' });

    return {
      ...session.toObject(),
      id: sessionIdStr,
    };
  }

  /**
   * (2026-11-20, workspace slice Item 3) Mentor-only decision on a
   * student's schedule request. Shared guard: the session must exist,
   * the caller must be the mentor of the mentorship, and the session
   * must still be REQUESTED — deciding anything else is a 400, never
   * a silent no-op. The student is notified either way.
   */
  private async loadSessionForDecision(id: string, userId: string) {
    const session = await this.sessionModel
      .findById(id)
      .populate({
        path: 'mentorshipId',
        populate: [
          { path: 'studentProfileId', populate: { path: 'userId' } },
          { path: 'mentorProfileId', populate: { path: 'userId' } },
        ],
      })
      .lean();

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    const mentorship: any = session.mentorshipId;
    const studentUserIdStr = mentorship.studentProfileId?.userId?._id?.toString();
    const mentorUserIdStr = mentorship.mentorProfileId?.userId?._id?.toString();

    if (mentorUserIdStr !== userId) {
      throw new ForbiddenException('Only the mentor can decide on a session request.');
    }

    return { session, mentorship, studentUserIdStr, mentorUserIdStr };
  }

  async approveSession(id: string, userId: string): Promise<any> {
    const { session, mentorship, studentUserIdStr } = await this.loadSessionForDecision(id, userId);

    if (session.status !== SessionStatus.REQUESTED) {
      throw new BadRequestException('Only a pending session request can be approved.');
    }

    const start = new Date(session.startTime);
    const end = new Date(session.endTime);

    // The slot may have been taken since the request was sent (another
    // session confirmed, or a leave added): re-run the same guards the
    // create path runs, so approving can never double-book or book
    // inside a leave.
    const activeMentorshipIds = await this.mentorshipModel
      .find({
        $or: [
          { studentProfileId: (mentorship as any).studentProfileId?._id },
          { mentorProfileId: (mentorship as any).mentorProfileId?._id },
        ],
      })
      .distinct('_id');

    const conflict = await this.sessionModel.findOne({
      _id: { $ne: new Types.ObjectId(id) },
      status: SessionStatus.SCHEDULED,
      mentorshipId: { $in: activeMentorshipIds },
      startTime: { $lt: end },
      endTime: { $gt: start },
    });
    if (conflict) {
      throw new BadRequestException('Scheduling conflict. Either the student or mentor is already booked.');
    }

    const blockingLeave = await this.mentorLeaveModel
      .findOne({
        mentorProfileId: (mentorship as any).mentorProfileId?._id,
        startDate: { $lte: end },
        endDate: { $gte: start },
      })
      .lean();
    if (blockingLeave) {
      throw new BadRequestException('Mentor is on leave during this time.');
    }

    const updated = await this.sessionModel
      .findByIdAndUpdate(id, { $set: { status: SessionStatus.SCHEDULED } }, { new: true })
      .lean();

    // A confirmed session gets its calendar event now (create-time sync
    // was skipped while the session was only a request).
    this.calendar.syncSessionEvent(id).catch((err) => {
      console.error(`Calendar sync failed for approved session ${id}: ${err.message}`);
    });

    const mentorUser = (mentorship as any).mentorProfileId?.userId;
    const mentorName = `${mentorUser?.firstName || ''} ${mentorUser?.lastName || ''}`.trim() || 'Your mentor';
    await this.notifications.create(
      studentUserIdStr,
      'SESSION_APPROVED',
      'Session Request Approved',
      `${mentorName} approved your session request: "${session.title}" on ${start.toLocaleDateString()}`,
      { sessionId: id },
    );

    await this.audit.log(userId, 'APPROVE_SESSION', 'Session', id, { mentorshipId: (mentorship as any)._id?.toString() });
    globalEventBus.emit('dashboard_update', { type: 'SESSION_APPROVED' });

    return {
      ...updated,
      id: updated._id.toString(),
    };
  }

  async declineSession(id: string, userId: string): Promise<any> {
    const { session, mentorship, studentUserIdStr } = await this.loadSessionForDecision(id, userId);

    if (session.status !== SessionStatus.REQUESTED) {
      throw new BadRequestException('Only a pending session request can be declined.');
    }

    const updated = await this.sessionModel
      .findByIdAndUpdate(id, { $set: { status: SessionStatus.CANCELLED } }, { new: true })
      .lean();

    // No calendar sync: a request never created a calendar event.
    const mentorUser = (mentorship as any).mentorProfileId?.userId;
    const mentorName = `${mentorUser?.firstName || ''} ${mentorUser?.lastName || ''}`.trim() || 'Your mentor';
    const start = new Date(session.startTime);
    await this.notifications.create(
      studentUserIdStr,
      'SESSION_DECLINED',
      'Session Request Declined',
      `${mentorName} declined your session request: "${session.title}" on ${start.toLocaleDateString()}`,
      { sessionId: id },
    );

    await this.audit.log(userId, 'DECLINE_SESSION', 'Session', id, { mentorshipId: (mentorship as any)._id?.toString() });
    globalEventBus.emit('dashboard_update', { type: 'SESSION_DECLINED' });

    return {
      ...updated,
      id: updated._id.toString(),
    };
  }

  async updateSession(id: string, userId: string, dto: any): Promise<any> {
    const session = await this.sessionModel
      .findById(id)
      .populate({
        path: 'mentorshipId',
        populate: [
          { path: 'studentProfileId' },
          { path: 'mentorProfileId' },
        ],
      })
      .lean();

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    const studentUserIdStr = (session.mentorshipId as any).studentProfileId?.userId?.toString();
    const mentorUserIdStr = (session.mentorshipId as any).mentorProfileId?.userId?.toString();

    if (studentUserIdStr !== userId && mentorUserIdStr !== userId) {
      throw new ForbiddenException('Access denied');
    }

    // (2026-11-20, workspace slice Item 3) Status moves only through
    // the approve/decline routes: a student must never be able to
    // confirm their own request by PATCHing status, and a REQUESTED
    // session's status is decided in the workspace, not by editing.
    // Times/title/notes on a pending request stay editable by either
    // party — only the status field is guarded here.
    if (dto.status !== undefined) {
      if (session.status === SessionStatus.REQUESTED) {
        throw new BadRequestException('Session requests are approved or declined from the workspace, not by editing.');
      }
      if (studentUserIdStr === userId) {
        throw new ForbiddenException('Only the mentor can change a session status.');
      }
    }

    const start = dto.startTime ? new Date(dto.startTime) : session.startTime;
    const end = dto.endTime ? new Date(dto.endTime) : session.endTime;

    if (start >= end) {
      throw new BadRequestException('End time must be after start time');
    }

    if (dto.startTime || dto.endTime) {
      // Overlap conflict detection on reschedule
      const activeMentorshipIds = await this.mentorshipModel
        .find({
          $or: [
            { studentProfileId: (session.mentorshipId as any).studentProfileId?._id },
            { mentorProfileId: (session.mentorshipId as any).mentorProfileId?._id },
          ],
        })
        .distinct('_id');

      const conflict = await this.sessionModel.findOne({
        _id: { $ne: new Types.ObjectId(id) },
        status: SessionStatus.SCHEDULED,
        mentorshipId: { $in: activeMentorshipIds },
        startTime: { $lt: end },
        endTime: { $gt: start },
      });

      if (conflict) {
        throw new BadRequestException('Rescheduling conflict. Either student or mentor is booked.');
      }
    }

    const updated = await this.sessionModel
      .findByIdAndUpdate(
        id,
        {
          // (Item 6, 2026-11-20) meetingUrl is set ONLY when the key is
          // present in the body — a PATCH without it must not wipe the
          // stored link. Present + a real http(s) URL → set it; present
          // + empty → $unset it (explicit clear); present + anything
          // else → 400. Validation lives here because PATCH has no DTO.
          $set: {
            title: dto.title,
            startTime: start,
            endTime: end,
            notes: dto.notes,
            status: dto.status,
            ...(dto.meetingUrl !== undefined &&
            typeof dto.meetingUrl === 'string' &&
            dto.meetingUrl.trim() !== ''
              ? { meetingUrl: this.normaliseMeetingUrl(dto.meetingUrl) }
              : {}),
          },
          ...(dto.meetingUrl !== undefined &&
          (dto.meetingUrl === null ||
            (typeof dto.meetingUrl === 'string' && dto.meetingUrl.trim() === ''))
            ? { $unset: { meetingUrl: '' } }
            : {}),
        },
        { new: true },
      )
      .lean();

    // Update calendar event
    this.calendar.syncSessionEvent(id).catch((err) => {
      console.error(`Calendar sync update failed for session ${id}: ${err.message}`);
    });

    return {
      ...updated,
      id: updated._id.toString(),
    };
  }

  async cancelSession(id: string, userId: string): Promise<any> {
    const session = await this.sessionModel
      .findById(id)
      .populate({
        path: 'mentorshipId',
        populate: [
          { path: 'studentProfileId' },
          { path: 'mentorProfileId' },
        ],
      })
      .lean();

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    const studentUserIdStr = (session.mentorshipId as any).studentProfileId?.userId?.toString();
    const mentorUserIdStr = (session.mentorshipId as any).mentorProfileId?.userId?.toString();

    if (studentUserIdStr !== userId && mentorUserIdStr !== userId) {
      throw new ForbiddenException('Access denied');
    }

    const updated = await this.sessionModel
      .findByIdAndUpdate(id, { $set: { status: SessionStatus.CANCELLED } }, { new: true })
      .lean();

    // Cancel calendar event
    this.calendar.syncSessionEvent(id).catch((err) => {
      console.error(`Calendar sync cancellation failed for session ${id}: ${err.message}`);
    });

    return {
      ...updated,
      id: updated._id.toString(),
    };
  }
}

export const sessionsService = new SessionsService();
