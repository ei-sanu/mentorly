import { BadRequestException, NotFoundException } from '../common/errors';
import { CalendarNoteModel } from '../database/models';
import { Types } from 'mongoose';
import { CreateCalendarNoteDto } from './dto/create-calendar-note.dto';
import { UpdateCalendarNoteDto } from './dto/update-calendar-note.dto';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * True only for a REAL calendar day in "YYYY-MM-DD" form. The shape
 * regex alone accepts "2026-02-30"; the round-trip through the Date
 * constructor rejects it (30 Feb becomes 2 Mar, so the components no
 * longer match). Built from local date parts (no UTC conversion), so
 * the check is timezone-proof for a date-only value.
 */
export function isRealDateString(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

/**
 * The inclusive start and exclusive end of a "YYYY-MM" month, as
 * date-only strings, so a month list is one string-range query:
 * `date >= start && date < end`. December rolls into January of the
 * next year.
 */
export function monthRange(month: string): { start: string; end: string } {
  const [y, m] = month.split('-').map(Number);
  const nextYear = m === 12 ? y + 1 : y;
  const nextMonth = m === 12 ? 1 : m + 1;
  return {
    start: `${month}-01`,
    end: `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`,
  };
}

/** "YYYY-MM" for the current month, server-local time. */
export function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function mapNote(note: any): any {
  const { _id, __v, ...rest } = note;
  return { ...rest, id: _id.toString() };
}

export class CalendarNotesService {
  private readonly noteModel = CalendarNoteModel;

  /**
   * The signed-in user's notes for one month ("YYYY-MM"; defaults to
   * the current month when omitted). Sorted by day, then by creation
   * time within a day. Scoped by userId — another user's notes are
   * never in the result, by construction of the query.
   */
  async listForMonth(userId: string, month?: string): Promise<any[]> {
    const key = month || currentMonthKey();
    if (!MONTH_RE.test(key)) {
      throw new BadRequestException('month must be a valid month in YYYY-MM format');
    }
    const { start, end } = monthRange(key);
    const notes = await this.noteModel
      .find({ userId: new Types.ObjectId(userId), date: { $gte: start, $lt: end } })
      .sort({ date: 1, createdAt: 1 })
      .lean();
    return notes.map(mapNote);
  }

  /** Create a note on one day for the signed-in user. */
  async create(userId: string, dto: CreateCalendarNoteDto): Promise<any> {
    if (!isRealDateString(dto.date)) {
      throw new BadRequestException('That date does not exist. Please pick a real calendar day.');
    }
    const text = (dto.text || '').trim();
    if (!text) {
      throw new BadRequestException('Write something for the note first.');
    }
    const title = (dto.title || '').trim();
    const note = new this.noteModel({
      userId: new Types.ObjectId(userId),
      date: dto.date,
      ...(title ? { title } : {}),
      text,
    });
    await note.save();
    return mapNote(note.toObject());
  }

  /**
   * Update one of the signed-in user's notes. The lookup itself is
   * scoped to the user, so a note that belongs to someone else (or
   * does not exist) is the same 404 — ownership is never leaked.
   */
  async update(userId: string, id: string, dto: UpdateCalendarNoteDto): Promise<any> {
    const existing = await this.noteModel
      .findOne({ _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId) })
      .lean();
    if (!existing) {
      throw new NotFoundException("We couldn't find that note. It may have been removed.");
    }
    const data: any = {};
    if (dto.date !== undefined) {
      if (!isRealDateString(dto.date)) {
        throw new BadRequestException('That date does not exist. Please pick a real calendar day.');
      }
      data.date = dto.date;
    }
    if (dto.title !== undefined) {
      // An explicitly empty title clears the label.
      data.title = (dto.title || '').trim();
    }
    if (dto.text !== undefined) {
      const text = (dto.text || '').trim();
      if (!text) {
        throw new BadRequestException('Write something for the note first.');
      }
      data.text = text;
    }
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Nothing to update.');
    }
    const updated = await this.noteModel
      .findByIdAndUpdate(id, { $set: data }, { new: true })
      .lean();
    return mapNote(updated);
  }

  /**
   * Delete one of the signed-in user's notes, for real. Same
   * owner-scoped lookup as update: another user's note is a 404, and
   * a second delete of the same id is a 404, not a silent success.
   */
  async delete(userId: string, id: string): Promise<any> {
    const existing = await this.noteModel
      .findOne({ _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId) })
      .lean();
    if (!existing) {
      throw new NotFoundException("We couldn't find that note. It may have been removed.");
    }
    await this.noteModel.findByIdAndDelete(id);
    return { success: true, message: 'Note deleted.' };
  }
}

export const calendarNotesService = new CalendarNotesService();
