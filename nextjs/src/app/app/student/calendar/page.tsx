'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, RefreshCw, AlertCircle, Trash2, Pencil, StickyNote } from 'lucide-react';
import { calendarNotesService } from '@/services/api';
import type { CalendarNote } from '@/types';
import { useRoleGuard } from '@/lib/use-role-guard';
import { PageHeader, PageLoader, PageEmptyState, PageError } from '@/components/dashboard/page-primitives';
import { getIndianHoliday, getIndianHolidaysForMonth, type IndianHoliday } from '@/lib/indian-holidays-2026';
import {
  buildMonthGrid,
  monthKey,
  todayKey,
  parseDayKey,
  formatDayLabel,
  formatMonthTitle,
  formatShortDate,
  addMonths,
  type CalendarDayCell,
} from '@/lib/calendar-utils';

// ─── Calendar (Item 5, 2026-11-20) ──────────────────────────────────────────
// A real working calendar for BOTH roles (student + mentor — same page,
// same route shape under each role). Month view with prev/next + "Today",
// click a day to see/add notes for that day. Notes are personal: the
// backend scopes every read/write to the signed-in user, so a note is
// never shared and deleting one removes it for real.
//
// Holidays are the Indian gazetted holidays for 2026 (see
// src/lib/indian-holidays-2026.ts for the verified source). The three
// national holidays carry a "National Holiday" label; the other
// gazetted days are "Public Holiday". Leave is NOT shown here —
// leave → calendar sync was deliberately left out of the Nov 20 bundle.

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function holidayLabel(holiday: IndianHoliday): string {
  return holiday.kind === 'national' ? 'National Holiday' : 'Public Holiday';
}

export default function CalendarPage() {
  const { allowed } = useRoleGuard(['STUDENT', 'MENTOR']);

  const today = todayKey();
  const todayParts = parseDayKey(today) ?? { year: 2026, month: 10, day: 20 };
  const [year, setYear] = useState(todayParts.year);
  const [month, setMonth] = useState(todayParts.month); // 0-based
  const [notes, setNotes] = useState<CalendarNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // The day the side panel is showing (defaults to today).
  const [selectedDate, setSelectedDate] = useState(today);

  // Add/edit form for the selected day.
  const [noteTitle, setNoteTitle] = useState('');
  const [noteText, setNoteText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async (loadYear: number, loadMonth: number) => {
    setLoading(true);
    setError(null);
    try {
      const monthNotes = await calendarNotesService.getNotes(monthKey(loadYear, loadMonth));
      setNotes(Array.isArray(monthNotes) ? monthNotes : []);
    } catch (err: any) {
      setError(err.message || 'Could not load your notes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (allowed) load(year, month);
  }, [allowed, year, month, load]);

  const grid = buildMonthGrid(year, month);
  const monthHolidays = getIndianHolidaysForMonth(monthKey(year, month));
  const selectedHoliday = getIndianHoliday(selectedDate);

  const notesByDate = useMemo(() => {
    const grouped: Record<string, CalendarNote[]> = {};
    for (const note of notes) {
      (grouped[note.date] ??= []).push(note);
    }
    return grouped;
  }, [notes]);

  const selectedNotes = notesByDate[selectedDate] ?? [];

  const showMonth = (nextYear: number, nextMonth: number, selectDate: string) => {
    setYear(nextYear);
    setMonth(nextMonth);
    setSelectedDate(selectDate);
  };

  const goToPreviousMonth = () => {
    const { year: nextYear, month: nextMonth } = addMonths(year, month, -1);
    showMonth(nextYear, nextMonth, monthKey(nextYear, nextMonth) + '-01');
  };

  const goToNextMonth = () => {
    const { year: nextYear, month: nextMonth } = addMonths(year, month, 1);
    showMonth(nextYear, nextMonth, monthKey(nextYear, nextMonth) + '-01');
  };

  const goToToday = () => {
    const parts = parseDayKey(todayKey());
    if (!parts) return;
    showMonth(parts.year, parts.month, todayKey());
  };

  const selectDay = (cell: CalendarDayCell) => {
    const parts = parseDayKey(cell.date);
    if (!parts) return;
    // Clicking a borrowed day from the next/previous month jumps there.
    showMonth(parts.year, parts.month, cell.date);
  };

  const resetForm = () => {
    setNoteTitle('');
    setNoteText('');
    setEditingId(null);
    setFormError(null);
  };

  const startEdit = (note: CalendarNote) => {
    setEditingId(note.id);
    setNoteTitle(note.title || '');
    setNoteText(note.text);
    setFormError(null);
  };

  const handleSaveNote = async () => {
    if (!noteText.trim()) {
      setFormError('Write something for the note first.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      if (editingId) {
        await calendarNotesService.updateNote(editingId, {
          title: noteTitle.trim(),
          text: noteText.trim(),
        });
      } else {
        await calendarNotesService.createNote({
          date: selectedDate,
          ...(noteTitle.trim() ? { title: noteTitle.trim() } : {}),
          text: noteText.trim(),
        });
      }
      resetForm();
      await load(year, month);
    } catch (err: any) {
      setFormError(err.message || 'Could not save this note.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    setDeletingId(noteId);
    try {
      await calendarNotesService.deleteNote(noteId);
      if (editingId === noteId) resetForm();
      await load(year, month);
    } catch (err: any) {
      setFormError(err.message || 'Could not delete this note.');
    } finally {
      setDeletingId(null);
    }
  };

  // After every hook above: the guard renders its loader instead of the page.
  if (!allowed) return <PageLoader message="Verifying access…" />;

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Calendar"
        description="Your personal notes, month by month. Indian national and gazetted holidays for 2026 are marked."
        icon={CalendarIcon}
        actions={
          <>
            <Button variant="outline" onClick={goToToday} size="sm" className="rounded-xl">
              Today
            </Button>
            <Button variant="outline" onClick={() => load(year, month)} size="sm" className="rounded-xl">
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>
          </>
        }
      />

      {error && (
        <PageError message={error} onRetry={() => load(year, month)} />
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between gap-2">
                <Button variant="ghost" size="sm" onClick={goToPreviousMonth} aria-label="Previous month" className="rounded-xl">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <CardTitle className="text-center text-lg">{formatMonthTitle(year, month)}</CardTitle>
                <Button variant="ghost" size="sm" onClick={goToNextMonth} aria-label="Next month" className="rounded-xl">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <PageLoader message="Loading your notes…" />
              ) : (
                <>
                  <div className="grid grid-cols-7 gap-1" role="row">
                    {WEEKDAY_NAMES.map((name) => (
                      <div key={name} className="pb-1 text-center text-[11px] font-medium uppercase tracking-wider text-neutral-400">
                        {name}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {grid.map((cell) => {
                      const holiday = cell.inMonth ? getIndianHoliday(cell.date) : undefined;
                      const dayNotes = cell.inMonth ? notesByDate[cell.date] ?? [] : [];
                      const isToday = cell.date === today;
                      const isSelected = cell.date === selectedDate;
                      return (
                        <button
                          key={cell.date}
                          type="button"
                          onClick={() => selectDay(cell)}
                          aria-label={`${formatDayLabel(cell.date)}${holiday ? `, ${holiday.name}` : ''}${dayNotes.length > 0 ? `, ${dayNotes.length} note${dayNotes.length === 1 ? '' : 's'}` : ''}`}
                          aria-pressed={isSelected}
                          className={
                            'flex min-h-[64px] flex-col items-start gap-0.5 rounded-lg border p-1.5 text-left sm:min-h-[76px] sm:p-2 ' +
                            (isSelected
                              ? 'border-neutral-900 bg-neutral-900 text-white'
                              : 'border-gray-100 bg-white text-neutral-900 hover:border-neutral-300') +
                            (isToday && !isSelected ? ' ring-2 ring-neutral-900' : '') +
                            (!cell.inMonth ? ' opacity-40' : '')
                          }
                        >
                          <span className="text-sm font-medium leading-none">{cell.day}</span>
                          {holiday && (
                            <span className="mt-1 flex min-w-0 items-center gap-1">
                              <span
                                className={'h-1.5 w-1.5 shrink-0 rounded-full ' + (holiday.kind === 'national' ? 'bg-amber-500' : 'bg-blue-500')}
                                aria-hidden="true"
                              />
                              <span
                                className={
                                  'hidden min-w-0 truncate text-[10px] leading-tight sm:block ' +
                                  (isSelected ? 'text-white' : holiday.kind === 'national' ? 'text-amber-700' : 'text-blue-700')
                                }
                              >
                                {holiday.name}
                              </span>
                            </span>
                          )}
                          {dayNotes.length > 0 && (
                            <span className="mt-auto flex min-w-0 items-center gap-1 pt-1">
                              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
                              <span className={'hidden min-w-0 truncate text-[10px] leading-tight sm:block ' + (isSelected ? 'text-emerald-300' : 'text-emerald-700')}>
                                {dayNotes.length} note{dayNotes.length === 1 ? '' : 's'}
                              </span>
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-gray-100 pt-3 text-xs text-lpu-text-secondary">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" /> National holiday
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-blue-500" aria-hidden="true" /> Public holiday
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" /> Your note
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full ring-2 ring-neutral-900" aria-hidden="true" /> Today
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {monthHolidays.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Holidays in {formatMonthTitle(year, month)}</CardTitle>
                <CardDescription>Indian national and gazetted holidays, 2026.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {monthHolidays.map((holiday) => (
                    <button
                      key={holiday.date}
                      type="button"
                      onClick={() => {
                        const parts = parseDayKey(holiday.date);
                        if (parts) showMonth(parts.year, parts.month, holiday.date);
                      }}
                      className="flex w-full items-center gap-3 rounded-xl border border-gray-100 p-3 text-left hover:border-neutral-300"
                    >
                      <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-gray-50">
                        <span className="text-[10px] uppercase text-lpu-text-muted">
                          {new Date(holiday.date + 'T00:00:00').toLocaleDateString([], { month: 'short' })}
                        </span>
                        <span className="text-sm font-bold leading-none">{holiday.date.slice(8, 10)}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{holiday.name}</p>
                        <p className="text-xs text-lpu-text-secondary">
                          {formatShortDate(holiday.date)}
                          {holiday.tentative ? ' · date may move (moon sighting)' : ''}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={holiday.kind === 'national' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-blue-50 text-blue-700 border-blue-200'}
                      >
                        {holidayLabel(holiday)}
                      </Badge>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <Card className="h-fit lg:sticky lg:top-20">
          <CardHeader>
            <CardTitle className="text-base">{formatDayLabel(selectedDate)}</CardTitle>
            <CardDescription>
              {selectedNotes.length} note{selectedNotes.length === 1 ? '' : 's'} on this day
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedHoliday && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <StickyNote className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  <strong>{holidayLabel(selectedHoliday)}:</strong> {selectedHoliday.name}
                  {selectedHoliday.tentative ? ' (date may move — moon sighting)' : ''}
                </span>
              </div>
            )}

            {loading ? (
              <PageLoader message="Loading notes…" />
            ) : selectedNotes.length === 0 ? (
              <PageEmptyState
                message="No notes for this day"
                hint="Add one below — it stays private to you."
                icon={StickyNote}
              />
            ) : (
              <div className="space-y-2">
                {selectedNotes.map((note) => (
                  <div key={note.id} className="rounded-xl border border-gray-100 p-3">
                    {note.title && <p className="text-sm font-medium">{note.title}</p>}
                    <p className="whitespace-pre-wrap text-sm text-lpu-text-secondary">{note.text}</p>
                    <div className="mt-2 flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => startEdit(note)} className="gap-1.5">
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteNote(note.id)}
                        disabled={deletingId === note.id}
                        className="gap-1.5"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {deletingId === note.id ? 'Deleting…' : 'Delete'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t border-gray-100 pt-4">
              <h4 className="mb-3 text-sm font-medium">{editingId ? 'Edit note' : 'Add a note'}</h4>
              {formError && (
                <div className="mb-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-lpu-text-muted">Title (optional)</span>
                <input
                  type="text"
                  value={noteTitle}
                  maxLength={100}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  placeholder="e.g. Mentorship prep"
                  className="h-10 w-full rounded-xl border border-lpu-border bg-white px-3 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                />
              </label>
              <label className="mt-3 block">
                <span className="mb-1 block text-xs font-medium text-lpu-text-muted">Note</span>
                <textarea
                  value={noteText}
                  maxLength={2000}
                  rows={3}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Write a note for this day…"
                  className="w-full rounded-xl border border-lpu-border bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                />
              </label>
              <div className="mt-3 flex gap-2">
                <Button onClick={handleSaveNote} disabled={saving} className="flex-1">
                  {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add note'}
                </Button>
                {editingId && (
                  <Button variant="outline" onClick={resetForm} disabled={saving}>
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
