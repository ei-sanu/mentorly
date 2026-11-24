// Pure calendar math for the Calendar page (Item 5, 2026-11-20).
// No React, no network, no timezone: every date here is a plain
// "YYYY-MM-DD" day string, built from local date parts, so a day can
// never shift because of a UTC conversion. Months are 0-based
// (0 = January), matching the Date constructor.

export interface CalendarDayCell {
  /** "YYYY-MM-DD" — the same string the notes API and the holidays file use. */
  date: string;
  /** Day of the month (1–31). */
  day: number;
  /** False for the leading/trailing days borrowed from adjacent months. */
  inMonth: boolean;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** "YYYY-MM" for a 0-based month. */
export function monthKey(year: number, month: number): string {
  return `${year}-${pad(month + 1)}`;
}

/** "YYYY-MM-DD" for one local calendar day. */
export function dayKey(year: number, month: number, day: number): string {
  return `${monthKey(year, month)}-${pad(day)}`;
}

/** Parse a "YYYY-MM" key; null when it is not a real month. */
export function parseMonthKey(key: string): { year: number; month: number } | null {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(key);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]) - 1 };
}

/** Parse a "YYYY-MM-DD" key; null when it is not a real calendar day. */
export function parseDayKey(key: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(0[1-9]|1[0-2])-(\d{2})$/.exec(key);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const dt = new Date(year, month, day);
  if (dt.getFullYear() !== year || dt.getMonth() !== month || dt.getDate() !== day) return null;
  return { year, month, day };
}

/** "YYYY-MM-DD" for today, local time. */
export function todayKey(): string {
  const now = new Date();
  return dayKey(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * The month grid: Sunday-first weeks, 35 or 42 cells, with the
 * leading/trailing days borrowed from the adjacent months so every
 * week is complete. A month that starts on a Sunday has no leading
 * days; February 2026 (28 days, starts on a Sunday) is exactly 28
 * cells — 4 full weeks, no trailing days.
 */
export function buildMonthGrid(year: number, month: number): CalendarDayCell[] {
  const firstWeekday = new Date(year, month, 1).getDay(); // 0 = Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
  const cells: CalendarDayCell[] = [];
  for (let i = 0; i < totalCells; i += 1) {
    const dayNumber = i - firstWeekday + 1;
    if (dayNumber < 1) {
      // Leading day from the previous month.
      const prevMonth = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      cells.push({
        date: dayKey(prevYear, prevMonth, daysInPrevMonth + dayNumber),
        day: daysInPrevMonth + dayNumber,
        inMonth: false,
      });
    } else if (dayNumber > daysInMonth) {
      // Trailing day from the next month.
      const nextMonth = month === 11 ? 0 : month + 1;
      const nextYear = month === 11 ? year + 1 : year;
      cells.push({
        date: dayKey(nextYear, nextMonth, dayNumber - daysInMonth),
        day: dayNumber - daysInMonth,
        inMonth: false,
      });
    } else {
      cells.push({ date: dayKey(year, month, dayNumber), day: dayNumber, inMonth: true });
    }
  }
  return cells;
}

/** Shift a 0-based month by `delta` months (negative goes backwards). */
export function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const total = year * 12 + month + delta;
  return { year: Math.floor(total / 12), month: total % 12 };
}

/** Long label for one day, e.g. "Thursday, 26 November 2026". */
export function formatDayLabel(date: string): string {
  const parsed = parseDayKey(date);
  if (!parsed) return date;
  return new Date(parsed.year, parsed.month, parsed.day).toLocaleDateString([], {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Month title, e.g. "November 2026". */
export function formatMonthTitle(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString([], { month: 'long', year: 'numeric' });
}

/** Short label for one day in a list, e.g. "26 Nov 2026". */
export function formatShortDate(date: string): string {
  const parsed = parseDayKey(date);
  if (!parsed) return date;
  return new Date(parsed.year, parsed.month, parsed.day).toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
