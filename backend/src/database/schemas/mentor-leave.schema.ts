import { Schema, HydratedDocument, Types } from 'mongoose';

export type MentorLeaveDocument = HydratedDocument<MentorLeave>;

/**
 * Mentor leave (Item 5, 2026-11-20) — a dated exception to a mentor's
 * weekly availability, NOT a weekly slot: leave lives in its own
 * collection so the matching scorer's availability row-count is never
 * polluted by it, and so leave can be enforced at request/session time
 * without touching matching.service.ts (no weight/score change).
 *
 * Dates are stored normalised by MentorsService.addLeave(): startDate at
 * 00:00:00.000 and endDate at 23:59:59.999 local time, so endDate is the
 * LAST day of the leave inclusive — a session on the end date is inside
 * the leave, a session the day after is not. Readers compare against
 * day boundaries (startOfToday / endOfToday), never against midnight.
 */
export interface MentorLeave {
  mentorProfileId: Types.ObjectId;
  startDate: Date;
  endDate: Date; // >= startDate (enforced in MentorsService.addLeave)
  reason?: string; // mentor-written, shown to students verbatim
}

export const MentorLeaveSchema = new Schema<MentorLeave>({
  mentorProfileId: { type: Schema.Types.ObjectId, ref: 'MentorProfile', required: true, index: true },
  startDate: { required: true, type: Date },
  endDate: { required: true, type: Date },
  reason: { type: String, maxlength: 200 },
}, { timestamps: true });
MentorLeaveSchema.index({ mentorProfileId: 1, startDate: 1 });
