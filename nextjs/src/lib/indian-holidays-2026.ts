// Indian holidays, 2026 — gazetted (central government) holidays.
//
// SOURCE (verified 2026-11-20, do not rely on memory): the Government of
// India DoPT office memorandum No. 12/2/2023-JCA dated 3 July 2025,
// which notifies 17 gazetted holidays for 2026. Cross-checked the same
// day against the News18, JagranJosh (sourcing india.gov.in), and
// Economic Times listings of that list — all three agree on every date
// below — and every weekday was verified with `date -d` (e.g.
// 2026-01-26 is a Monday, 2026-10-02 is a Friday). One outlier listing
// (Moneycontrol) gave different dates for several festivals and was
// NOT used.
//
// `kind: 'national'` marks the three national holidays — Republic Day,
// Independence Day, Mahatma Gandhi Jayanti — which the calendar renders
// with a "National Holiday" label; the other fourteen are gazetted
// public holidays, rendered as "Public Holiday".
//
// `tentative: true` marks the four dates that depend on the sighting
// of the moon (Id-ul-Fitr, Id-ul-Zuha, Muharram, Id-e-Milad): the
// government announces a change close to the date, so these may move
// by a day. The calendar says so next to them.
//
// TO UPDATE FOR A NEW YEAR: replace this list (and the year in the
// file name / comments) with the new DoPT list. Nothing else in the
// app hardcodes a holiday date.

export interface IndianHoliday {
  /** "YYYY-MM-DD" — matches the date-only strings the calendar grid uses. */
  date: string;
  name: string;
  /** 'national' = one of the three national holidays; 'gazetted' = the other central-govt holidays. */
  kind: 'national' | 'gazetted';
  /** Moon-sighting date: may move by a day on government notification. */
  tentative?: boolean;
}

export const INDIAN_HOLIDAYS_2026: IndianHoliday[] = [
  { date: '2026-01-26', name: 'Republic Day', kind: 'national' },
  { date: '2026-03-04', name: 'Holi', kind: 'gazetted' },
  { date: '2026-03-21', name: 'Id-ul-Fitr', kind: 'gazetted', tentative: true },
  { date: '2026-03-26', name: 'Ram Navami', kind: 'gazetted' },
  { date: '2026-03-31', name: 'Mahavir Jayanti', kind: 'gazetted' },
  { date: '2026-04-03', name: 'Good Friday', kind: 'gazetted' },
  { date: '2026-05-01', name: 'Buddha Purnima', kind: 'gazetted' },
  { date: '2026-05-27', name: 'Id-ul-Zuha (Bakrid)', kind: 'gazetted', tentative: true },
  { date: '2026-06-26', name: 'Muharram', kind: 'gazetted', tentative: true },
  { date: '2026-08-15', name: 'Independence Day', kind: 'national' },
  { date: '2026-08-26', name: 'Id-e-Milad', kind: 'gazetted', tentative: true },
  { date: '2026-09-04', name: 'Janmashtami', kind: 'gazetted' },
  { date: '2026-10-02', name: 'Mahatma Gandhi Jayanti', kind: 'national' },
  { date: '2026-10-20', name: 'Dussehra', kind: 'gazetted' },
  { date: '2026-11-08', name: 'Diwali', kind: 'gazetted' },
  { date: '2026-11-24', name: 'Guru Nanak Jayanti', kind: 'gazetted' },
  { date: '2026-12-25', name: 'Christmas Day', kind: 'gazetted' },
];

export const INDIAN_HOLIDAYS_2026_BY_DATE: Record<string, IndianHoliday> = Object.fromEntries(
  INDIAN_HOLIDAYS_2026.map((holiday) => [holiday.date, holiday]),
);

/** The holiday on one "YYYY-MM-DD" day, if 2026 has one there. */
export function getIndianHoliday(date: string): IndianHoliday | undefined {
  return INDIAN_HOLIDAYS_2026_BY_DATE[date];
}

/** All 2026 holidays inside one "YYYY-MM" month, in date order. */
export function getIndianHolidaysForMonth(month: string): IndianHoliday[] {
  return INDIAN_HOLIDAYS_2026.filter((holiday) => holiday.date.startsWith(`${month}-`));
}
