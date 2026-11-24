import { NotFoundException } from '../common/errors';
import { NotificationModel, SessionModel, UserModel } from '../database/models';
import { Types } from 'mongoose';
import { Notification, NotificationDocument } from '../database/schemas/notification.schema';

// (Item 4, 2026-11-20) Notifications now carry proper details. The stored
// rows used to hold only type/title/message/metadata, so the list could show
// a title and a timestamp but never who it was about, what it referred to,
// or where to go. The payload now carries:
//   actorName  — who the notification is from ("Mentorly" for system-sent
//                verification/phone rows; otherwise the actor named in the
//                message sentence, parsed from the exact template the
//                creating service wrote — never guessed, undefined on no match)
//   entityType / entityId — what the notification is about (request,
//                mentorship, session, message, goal, verification), derived
//                from the metadata the callers already store
//   link       — role-aware in-app path to the relevant place, computed at
//                read time in findAll() (the recipient role decides the
//                prefix: /app/student/... vs /app/mentor/...)
//   body       — alias of message, because the frontend Notification type
//                reads `body` and the rows rendered blank before this fix
// Callers are NOT changed: create() derives the new fields from the
// metadata they already pass, and findAll() backfills them for legacy rows
// created before this change. create() also accepts an optional 6th
// `details` argument so a future caller can pass the fields explicitly.
// Enrichment is best-effort throughout: a failed lookup leaves the row
// readable with whatever it has — it never hides the list.

export interface NotificationDetails {
  actorName?: string;
  entityType?: string;
  entityId?: string;
  link?: string;
}

const ENTITY_METADATA_KEYS: { key: string; entityType: string }[] = [
  { key: 'mentorshipId', entityType: 'mentorship' },
  { key: 'requestId', entityType: 'request' },
  { key: 'sessionId', entityType: 'session' },
  { key: 'conversationId', entityType: 'message' },
  { key: 'goalId', entityType: 'goal' },
  { key: 'verificationId', entityType: 'verification' },
  { key: 'applicantId', entityType: 'verification' },
];

/** Entity reference from the metadata a caller already stored, if any. */
export function deriveEntityFromMetadata(metadata: any): { entityType: string; entityId: string } | undefined {
  if (!metadata || typeof metadata !== 'object') return undefined;
  for (const { key, entityType } of ENTITY_METADATA_KEYS) {
    const value = metadata[key];
    if (typeof value === 'string' && value.length > 0) {
      return { entityType, entityId: value };
    }
  }
  return undefined;
}

const SYSTEM_ACTOR_TYPES = new Set([
  'VERIFICATION_APPROVED',
  'VERIFICATION_REJECTED',
  'VERIFICATION_CHANGES_REQUESTED',
  'PHONE_VERIFIED',
]);

// The creating services write the actor into the message sentence with a
// fixed template. These anchored patterns recover the name from exactly
// those templates; anything else returns undefined rather than a guess.
const ACTOR_PATTERNS: { type: string; pattern: RegExp }[] = [
  { type: 'NEW_REQUEST', pattern: /^(.+?) requested you as a mentor for: / },
  { type: 'REQUEST_ACCEPTED', pattern: /^Mentor (.+?) has accepted your request\.$/ },
  { type: 'REQUEST_DECLINED', pattern: /^Mentor (.+?) has declined your request\.$/ },
  { type: 'SESSION_SCHEDULED', pattern: /^(.+?) scheduled a session: "/ },
  // (2026-11-20, workspace slice Item 3) Session request / decision
  // rows, written by sessions.service in the same sentence templates.
  { type: 'SESSION_REQUESTED', pattern: /^(.+?) requested a session: "/ },
  { type: 'SESSION_APPROVED', pattern: /^(.+?) approved your session request: "/ },
  { type: 'SESSION_DECLINED', pattern: /^(.+?) declined your session request: "/ },
  { type: 'GOAL_CREATED', pattern: /^(.+?) added a new goal: "/ },
  { type: 'NEW_ONBOARDING', pattern: /^New (?:student|alumni mentor) verification submitted by (.+?) \([^)]*\)$/ },
];

// Session rows store only a sessionId; findAll() resolves each one to
// its mentorship so the link lands on the workspace. (2026-11-20,
// workspace slice Item 3) The request/decision rows join
// SESSION_SCHEDULED here.
const SESSION_LINK_TYPES = new Set([
  'SESSION_SCHEDULED',
  'SESSION_REQUESTED',
  'SESSION_APPROVED',
  'SESSION_DECLINED',
]);

export function parseActorName(type: string, message: string): string | undefined {
  if (typeof message !== 'string' || message.length === 0) return undefined;
  if (SYSTEM_ACTOR_TYPES.has(type)) return 'Mentorly';
  for (const { type: t, pattern } of ACTOR_PATTERNS) {
    if (t !== type) continue;
    const match = pattern.exec(message);
    if (match && match[1] && match[1].trim().length > 0) return match[1].trim();
    return undefined;
  }
  return undefined;
}

export function roleSlugForNotifications(role: string | undefined): string | undefined {
  switch (role) {
    case 'STUDENT': return 'student';
    case 'MENTOR': return 'mentor';
    case 'ADMIN': return 'admin';
    case 'ALUMNI_OFFICER': return 'alumni-officer';
    case 'PLACEMENT_OFFICER': return 'placement-officer';
    default: return undefined;
  }
}

export interface NotificationLinkInput {
  type: string;
  metadata?: any;
  entityType?: string;
  entityId?: string;
  role?: string;
  mentorshipId?: string;
}

/**
 * Role-aware in-app path for a notification, or undefined when there is no
 * real destination (a link to a list that does not exist is worse than none).
 * Only routes that exist in both apps are returned.
 */
export function deriveNotificationLink(input: NotificationLinkInput): string | undefined {
  const { type, metadata } = input;
  const role = input.role;
  const slug = roleSlugForNotifications(role);
  const mentorshipId = input.mentorshipId || (metadata && typeof metadata.mentorshipId === 'string' ? metadata.mentorshipId : undefined);

  const mentorshipPath = (id: string): string | undefined => {
    if (role === 'STUDENT') return `/app/student/mentorships/${id}`;
    // (2026-11-20, workspace slice Item 1) Mentors now have their own
    // workspace page; session/goal links land there, not the mentees list.
    if (role === 'MENTOR') return `/app/mentor/mentorships/${id}`;
    if (role === 'ADMIN') return '/app/admin/mentorships';
    if (role === 'ALUMNI_OFFICER') return '/app/alumni-officer/mentorships';
    return undefined;
  };
  const requestsPath = slug ? `/app/${slug}/requests` : undefined;

  switch (type) {
    case 'NEW_REQUEST':
    case 'MENTORSHIP_REQUEST_CREATED':
      return '/app/mentor/requests';
    case 'REQUEST_ACCEPTED':
    case 'MENTORSHIP_REQUEST_ACCEPTED':
      if (mentorshipId) return mentorshipPath(mentorshipId);
      return role === 'STUDENT' ? '/app/student/mentorships' : undefined;
    case 'REQUEST_DECLINED':
    case 'REQUEST_CANCELLED':
    case 'MENTORSHIP_REQUEST_DECLINED':
    case 'MENTORSHIP_REQUEST_CANCELLED':
      return requestsPath;
    case 'SESSION_SCHEDULED':
      if (mentorshipId) return mentorshipPath(mentorshipId);
      return slug ? `/app/${slug}/calendar` : undefined;
    // (2026-11-20, workspace slice Item 3) Session request + decision
    // rows land on the same workspace as a scheduled session.
    case 'SESSION_REQUESTED':
    case 'SESSION_APPROVED':
    case 'SESSION_DECLINED':
      if (mentorshipId) return mentorshipPath(mentorshipId);
      return slug ? `/app/${slug}/calendar` : undefined;
    case 'GOAL_CREATED':
      if (mentorshipId) return mentorshipPath(mentorshipId);
      if (role === 'STUDENT') return '/app/student/mentorships';
      if (role === 'MENTOR') return '/app/mentor/mentees';
      return undefined;
    case 'NEW_MESSAGE':
      return slug ? `/app/${slug}/messages` : undefined;
    case 'VERIFICATION_APPROVED':
    case 'VERIFICATION_REJECTED':
    case 'VERIFICATION_CHANGES_REQUESTED':
      // Student onboarding rows carry onboardingStatus; mentor alumni rows
      // carry verificationId. Both land where the outcome is visible.
      if (metadata && typeof metadata === 'object' && metadata.onboardingStatus) return '/onboarding/status';
      if (metadata && typeof metadata === 'object' && metadata.verificationId) return '/app/mentor/profile';
      return '/onboarding/status';
    case 'PHONE_VERIFIED':
      return '/onboarding/status';
    case 'NEW_ONBOARDING':
      return '/app/admin/verification';
    case 'OPPORTUNITY':
      return '/app/placement-officer/opportunities';
    default:
      return undefined;
  }
}

export class NotificationsService {
  private readonly notificationModel = NotificationModel;
  private readonly userModel = UserModel;
  private readonly sessionModel = SessionModel;

  async create(userId: string, type: string, title: string, message: string, metadata?: any, details?: NotificationDetails): Promise<any> {
    const entity = details && details.entityType && details.entityId
      ? { entityType: details.entityType, entityId: details.entityId }
      : deriveEntityFromMetadata(metadata);
    const actorName = details && details.actorName ? details.actorName : parseActorName(type, message);
    const notification = new this.notificationModel({
      userId: new Types.ObjectId(userId),
      type,
      title,
      message,
      read: false,
      metadata,
      actorName,
      entityType: entity ? entity.entityType : undefined,
      entityId: entity ? entity.entityId : undefined,
      // A caller-passed link wins; otherwise the link is computed at read
      // time in findAll(), where the recipient role is known.
      link: details && details.link ? details.link : undefined,
    });
    await notification.save();

    return {
      ...notification.toObject(),
      id: notification._id.toString(),
      body: message,
    };
  }

  async findAll(userId: string): Promise<any[]> {
    const list = await this.notificationModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .lean();

    // Recipient role decides the link prefix. Best-effort: without it the
    // role-independent links still resolve and the rest stay link-less.
    let role: string | undefined;
    try {
      const recipient = await this.userModel.findById(new Types.ObjectId(userId)).select('role').lean();
      role = recipient ? (recipient as any).role : undefined;
    } catch {
      role = undefined;
    }

    // SESSION_SCHEDULED rows store only a sessionId; resolve each session to
    // its mentorship in one batched query so the link lands on the
    // mentorship instead of a generic page.
    const sessionIds: string[] = Array.from(new Set(
      list
        .filter((n: any) => SESSION_LINK_TYPES.has(n.type))
        .map((n: any) => (n.metadata && typeof n.metadata === 'object' ? n.metadata.sessionId : undefined))
        .filter((id: any): id is string => typeof id === 'string' && Types.ObjectId.isValid(id)),
    ));
    const sessionMentorship = new Map<string, string>();
    if (sessionIds.length > 0) {
      try {
        const sessions = await this.sessionModel
          .find({ _id: { $in: sessionIds.map((id) => new Types.ObjectId(id)) } })
          .select('mentorshipId')
          .lean();
        for (const s of sessions as any[]) {
          const mentorshipId = s.mentorshipId ? s.mentorshipId.toString() : '';
          if (mentorshipId) sessionMentorship.set(s._id.toString(), mentorshipId);
        }
      } catch {
        // Leave the map empty; session links fall back to the calendar.
      }
    }

    return list.map((n: any) => {
      const metadata = n.metadata && typeof n.metadata === 'object' ? n.metadata : {};
      const entity = (n.entityType && n.entityId)
        ? { entityType: n.entityType, entityId: n.entityId }
        : deriveEntityFromMetadata(metadata);
      const mentorshipId = (typeof metadata.mentorshipId === 'string' && metadata.mentorshipId.length > 0)
        ? metadata.mentorshipId
        : (SESSION_LINK_TYPES.has(n.type) && typeof metadata.sessionId === 'string'
          ? sessionMentorship.get(metadata.sessionId)
          : undefined);
      return {
        ...n,
        id: n._id.toString(),
        // The frontend Notification type reads `body`; keep `message` too.
        body: n.message,
        actorName: n.actorName || parseActorName(n.type, n.message),
        entityType: entity ? entity.entityType : undefined,
        entityId: entity ? entity.entityId : undefined,
        link: n.link || deriveNotificationLink({
          type: n.type,
          metadata,
          entityType: entity ? entity.entityType : undefined,
          entityId: entity ? entity.entityId : undefined,
          role,
          mentorshipId,
        }),
      };
    });
  }

  async markAsRead(id: string, userId: string): Promise<any> {
    const updated = await this.notificationModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId) },
        { $set: { read: true } },
        { new: true },
      )
      .lean();

    if (!updated) {
      throw new NotFoundException(`Notification not found or access denied.`);
    }

    return {
      ...updated,
      id: updated._id.toString(),
      body: (updated as any).message,
    };
  }

  async markAllAsRead(userId: string): Promise<any> {
    await this.notificationModel.updateMany(
      { userId: new Types.ObjectId(userId), read: false },
      { $set: { read: true } },
    );
    return { success: true };
  }
}

export const notificationsService = new NotificationsService();
