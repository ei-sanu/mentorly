import { Schema, HydratedDocument, Types } from 'mongoose';

export type CalendarNoteDocument = HydratedDocument<CalendarNote>;

/**
 * Personal calendar note (Item 5, 2026-11-20) — a free-text note pinned
 * to one calendar day, owned by exactly one user. Notes are private:
 * every read/write in CalendarNotesService is scoped to the
 * authenticated user (userId from the auth token, never from the
 * request body), so a note is never shared with mentors, students, or
 * admins, and one user can never read, edit, or delete another user's
 * notes.
 *
 * `date` is a plain "YYYY-MM-DD" string (the Asia/Kolkata day, no time,
 * no timezone): the calendar grid is built from date-only strings end
 * to end, so a note can never land on the wrong day because of a UTC
 * conversion. The service additionally rejects impossible dates
 * ("2026-02-30") that match the shape but are not real days.
 */
export interface CalendarNote {
  userId: Types.ObjectId;
  date: string; // "YYYY-MM-DD"
  title?: string; // optional short label, max 100 chars
  text: string; // the note itself, max 2000 chars
}

export const CalendarNoteSchema = new Schema<CalendarNote>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  date: { type: String, required: true, index: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  title: { type: String, maxlength: 100 },
  text: { type: String, required: true, maxlength: 2000 },
}, { timestamps: true });
CalendarNoteSchema.index({ userId: 1, date: 1 });
