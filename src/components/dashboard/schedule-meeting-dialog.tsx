'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { mentorshipService } from '@/services/api';
import type { MentorLeave, Session } from '@/types';

// ─── Schedule a meeting from chat (2026-11-20, Item 3) ─────────────────────
// The mentor schedules a meeting from the thread: date + start/end time
// and an OPTIONAL meeting link. Saving POSTs a real session via the
// existing mentorshipService.createSession (POST /mentorships/:id/sessions
// — the Item 6 session route), so the meeting is a real record both sides
// read back with GET /mentorships/:id/sessions; the page renders it as an
// "Upcoming meetings" card in the thread. No chat message is posted for
// it — a fake announcement message as the mentor would be invented
// content, and a session row is exactly-once by construction (one row =
// one card, keyed by session id; re-fetching after save cannot duplicate
// it). The meeting link is user-pasted only, http/https validated — never
// generated (the Item 6 fake mock-link rule). The schedule action is
// mentor-only: the page renders this dialog only for the mentor side
// (students see the meeting card, never this button).
//
// Pure helpers below are exported for the mocked unit checks
// (tests/run-meeting-leave-checks.mjs): future-only date/time validation
// and the Item 5 "leave covers today" test, both with the bundle's
// local-day semantics (a leave runs startDate 00:00 to endDate 23:59
// local; the end date is the last day inclusive).

/** A real meeting link only: a non-empty http(s) URL — never generated. */
export function isValidMeetingUrl(value?: string | null): boolean {
  if (typeof value !== 'string' || value.trim() === '') return false;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Local "YYYY-MM-DD" for a Date (same day-string comparison the Item 5
 *  request dialog uses — never a UTC slice, which shifts the day). */
export function localDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

export interface MeetingFormInput {
  date: string;
  startTime: string;
  endTime: string;
  meetingUrl?: string;
}

export type MeetingValidation =
  | { ok: true; start: Date; end: Date }
  | { ok: false; errors: { date?: string; time?: string; meetingUrl?: string } };

/**
 * Validate a meeting date/time. Rules: date required; start and end times
 * required; end must be after start; the start must be in the future
 * (empty and past are both rejected — a past start can never be saved);
 * an optional meeting link must be a real http(s) URL when supplied.
 * `now` is injectable so the mocked checks can pin "today".
 */
export function validateMeetingInput(
  input: MeetingFormInput,
  now: Date = new Date(),
): MeetingValidation {
  const errors: { date?: string; time?: string; meetingUrl?: string } = {};
  if (!input.date) errors.date = 'Choose a date.';
  if (!input.startTime || !input.endTime) {
    errors.time = 'Choose a start and end time.';
  }
  if (input.meetingUrl && input.meetingUrl.trim() !== '' && !isValidMeetingUrl(input.meetingUrl)) {
    errors.meetingUrl = 'Meeting link must be a valid http(s) URL.';
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const start = new Date(`${input.date}T${input.startTime}:00`);
  const end = new Date(`${input.date}T${input.endTime}:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { ok: false, errors: { date: 'Choose a valid date and time.' } };
  }
  if (start >= end) {
    return { ok: false, errors: { time: 'End time must be after start time.' } };
  }
  if (start <= now) {
    return { ok: false, errors: { date: 'Choose a future date and time.' } };
  }
  return { ok: true, start, end };
}

/** True when the leave's window covers today (local days, end inclusive). */
export function leaveCoversToday(
  leave: Pick<MentorLeave, 'startDate' | 'endDate'>,
  now: Date = new Date(),
): boolean {
  const today = localDateString(now);
  return (
    String(leave.startDate).slice(0, 10) <= today &&
    today <= String(leave.endDate).slice(0, 10)
  );
}

/** First leave covering today, if any — the one the chat header shows. */
export function findLeaveCoveringToday<T extends Pick<MentorLeave, 'startDate' | 'endDate'>>(
  leaves: T[],
  now: Date = new Date(),
): T | undefined {
  return (leaves || []).find((l) => leaveCoversToday(l, now));
}

/** "30 Nov 2026" — the same human date the Item 5 badge/dialog use. */
export function formatLeaveEndDate(iso: string): string {
  return new Date(String(iso).slice(0, 10)).toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const inputClass =
  'mt-1.5 h-10 w-full rounded-xl border border-neutral-300 bg-white px-4 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/20';

export function ScheduleMeetingDialog({
  open,
  mentorshipId,
  onClose,
  onScheduled,
}: {
  open: boolean;
  mentorshipId: string | null;
  onClose: () => void;
  onScheduled: (session: Session) => void;
}) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [meetingUrl, setMeetingUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ date?: string; time?: string; meetingUrl?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  // Fresh empty form every time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setTitle('');
    setDate('');
    setStartTime('');
    setEndTime('');
    setMeetingUrl('');
    setSaving(false);
    setErrors({});
    setError(null);
    const t = setTimeout(() => titleRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open]);

  // Escape closes, except while saving.
  useEffect(() => {
    if (!open || saving) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, saving, onClose]);

  if (!open) return null;

  // Convenience, not a default that can be saved blindly: picking a start
  // time pre-fills the end one hour later while the end is still empty.
  const handleStartChange = (value: string) => {
    setStartTime(value);
    if (!endTime && /^\d{2}:\d{2}$/.test(value)) {
      const [h, m] = value.split(':').map(Number);
      const end = new Date(2000, 0, 1, h + 1, m);
      setEndTime(
        `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`,
      );
    }
  };

  const handleSave = async () => {
    if (!mentorshipId || saving) return;
    const validation = validateMeetingInput({ date, startTime, endTime, meetingUrl });
    if (!validation.ok) {
      setErrors(validation.errors);
      return;
    }
    setErrors({});
    setSaving(true);
    setError(null);
    try {
      const session = await mentorshipService.createSession(mentorshipId, {
        title: title.trim() || 'Mentorship session',
        startTime: validation.start.toISOString(),
        endTime: validation.end.toISOString(),
        timezone: 'Asia/Kolkata',
        ...(meetingUrl.trim() ? { meetingUrl: meetingUrl.trim() } : {}),
      });
      onScheduled(session);
      onClose();
    } catch (err: any) {
      // The backend's own message (past/conflict/leave/validation) —
      // apiFetch already rewrites raw technical text to a plain sentence.
      setError(err?.message || 'Could not schedule the meeting. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const firstError = errors.date || errors.time || errors.meetingUrl;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="schedule-meeting-title"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => {
          if (!saving) onClose();
        }}
      />
      <div className="relative w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-5 shadow-xl outline-none">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="schedule-meeting-title" className="text-base font-bold text-neutral-900">
              Schedule a meeting
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-neutral-600">
              Pick a date and time — the student sees it in this conversation.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="shrink-0 rounded-full p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {(error || firstError) && (
          <div
            className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            role="alert"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error || firstError}</span>
          </div>
        )}

        <label className="mt-4 block text-sm font-medium text-neutral-900" htmlFor="meeting-title">
          Title
        </label>
        <input
          ref={titleRef}
          id="meeting-title"
          type="text"
          value={title}
          maxLength={120}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Mentorship session"
          className={inputClass}
        />

        <label className="mt-4 block text-sm font-medium text-neutral-900" htmlFor="meeting-date">
          Date
        </label>
        <input
          id="meeting-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={inputClass}
        />

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label
              className="block text-sm font-medium text-neutral-900"
              htmlFor="meeting-start"
            >
              Start time
            </label>
            <input
              id="meeting-start"
              type="time"
              value={startTime}
              onChange={(e) => handleStartChange(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-900" htmlFor="meeting-end">
              End time
            </label>
            <input
              id="meeting-end"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <label
          className="mt-4 block text-sm font-medium text-neutral-900"
          htmlFor="meeting-link"
        >
          Meeting link <span className="font-normal text-neutral-400">(optional)</span>
        </label>
        <input
          id="meeting-link"
          type="url"
          value={meetingUrl}
          onChange={(e) => setMeetingUrl(e.target.value)}
          placeholder="https://meet.google.com/…"
          className={inputClass}
        />
        <p className="mt-1 text-xs text-neutral-400">
          Paste your own meeting link — one is never generated for you.
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={saving}
            className="rounded-full border-neutral-300 bg-white px-5 text-neutral-900 hover:bg-neutral-100"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !mentorshipId}
            className="rounded-full bg-neutral-900 px-6 text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {saving ? 'Scheduling…' : 'Schedule meeting'}
          </Button>
        </div>
      </div>
    </div>
  );
}
