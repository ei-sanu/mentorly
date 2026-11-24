import { Schema, HydratedDocument, Types } from 'mongoose';

export type SessionDocument = HydratedDocument<Session>;

export enum SessionStatus {
  SCHEDULED = 'SCHEDULED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  RESCHEDULED = 'RESCHEDULED',
  NO_SHOW = 'NO_SHOW',
  /**
   * (2026-11-20, workspace slice Item 3) A student-proposed session
   * awaiting the mentor's decision. Only the mentor can move a
   * REQUESTED session to SCHEDULED (approve) or CANCELLED (decline);
   * a REQUESTED session is never shown as a confirmed session (Next
   * Session card, sessions list, chat "Upcoming meetings" strip all
   * filter status === 'SCHEDULED'), never blocks the overlap check,
   * and never syncs to a calendar until approved.
   */
  REQUESTED = 'REQUESTED',
}

export enum CalendarSyncStatus {
  PENDING = 'PENDING',
  FAILED = 'FAILED',
  SYNCED = 'SYNCED',
}

export interface Session {
  mentorshipId: Types.ObjectId;
  title: string;
  startTime: Date;
  endTime: Date;
  timezone: string;
  status: SessionStatus;
  notes?: string;
  meetingUrl?: string;
  createdBy: string; // User ID string representation
  calendarEventId?: string;
  calendarSyncStatus: CalendarSyncStatus;
}

export const SessionSchema = new Schema<Session>({
  mentorshipId: { type: Schema.Types.ObjectId, ref: 'Mentorship', required: true, index: true },
  title: { required: true, type: String },
  startTime: { required: true, type: Date },
  endTime: { required: true, type: Date },
  timezone: { required: true, default: 'Asia/Kolkata', type: String },
  status: { required: true, default: SessionStatus.SCHEDULED, enum: SessionStatus, index: true, type: String },
  notes: { type: String },
  meetingUrl: { type: String },
  createdBy: { required: true, type: String },
  calendarEventId: { type: String },
  calendarSyncStatus: { required: true, default: CalendarSyncStatus.PENDING, enum: CalendarSyncStatus, type: String },
}, { timestamps: true });
SessionSchema.index({ mentorshipId: 1, startTime: 1 });
