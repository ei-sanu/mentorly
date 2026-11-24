'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { requestService, mentorService } from '@/services/api';
import type { MentorLeave } from '@/types';
import { MentorPublicProfile } from '@/types';

// ─── Request mentorship dialog (2026-11-12) ────────────────────────────────
// The "Request Mentorship" buttons on the student dashboard and Find Mentors
// page were no-ops (no onClick at all). This shared dialog is the missing
// wiring: it collects the two fields POST /requests requires — goal
// (max 200 chars) and message (max 1000 chars) — and sends the request
// through requestService.createRequest, whose mentorId is the mentor
// profile id (MentorMatch.id). The backend enforces the rest (career
// profile complete, max 3 pending, verified/accepting/capacity, no
// duplicates) and its exact reason is shown inline on failure — never a
// silent no-op, never a browser dialog. Styling mirrors the themed-alert
// dialog shell: white card, hairline border, black pill buttons.

export function RequestMentorshipDialog({
  open,
  mentor,
  onClose,
  onSent,
}: {
  open: boolean;
  mentor: MentorPublicProfile | null;
  onClose: () => void;
  onSent?: (mentorId: string) => void;
}) {
  const router = useRouter();
  const [goal, setGoal] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const goalRef = useRef<HTMLInputElement>(null);
  // Mentor leave (Item 5): fetched on open. A leave covering today shows
  // an amber notice and disables Send (the backend also rejects the
  // request as a backstop); a future leave shows as info only.
  const [leaves, setLeaves] = useState<MentorLeave[]>([]);

  // Fresh empty form every time the dialog opens (or opens for a new mentor).
  useEffect(() => {
    if (!open) return;
    setGoal('');
    setMessage('');
    setSending(false);
    setError(null);
    setSent(false);
    const t = setTimeout(() => goalRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open, mentor?.id]);

  useEffect(() => {
    if (!open || !mentor) return;
    let cancelled = false;
    mentorService
      .getMentorLeaves(mentor.id)
      .then((data) => {
        if (!cancelled) setLeaves(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setLeaves([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, mentor?.id]);

  // Escape closes, except while the request is in flight.
  useEffect(() => {
    if (!open || sending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, sending, onClose]);

  if (!open || !mentor) return null;

  const trimmedGoal = goal.trim();
  const trimmedMessage = message.trim();
  // A current leave disables Send entirely (Item 5); the backend rejects
  // the request too, so the dialog never lets the student hit that error.
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const currentLeave = leaves.find(
    (l) => String(l.startDate).slice(0, 10) <= todayStr && todayStr <= String(l.endDate).slice(0, 10),
  );
  const futureLeave = !currentLeave
    ? leaves
        .filter((l) => String(l.startDate).slice(0, 10) > todayStr)
        .sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)))[0]
    : undefined;
  const formatLeaveDate = (iso: string) =>
    new Date(String(iso).slice(0, 10)).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
  const canSubmit = !sending && !currentLeave && trimmedGoal.length > 0 && trimmedMessage.length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSending(true);
    setError(null);
    try {
      await requestService.createRequest(mentor.id, trimmedMessage, trimmedGoal);
      setSent(true);
      onSent?.(mentor.id);
    } catch (err: any) {
      // apiFetch throws the backend's own message (e.g. capacity,
      // duplicate request, 3-pending limit). Raw technical text can
      // never reach this banner: apiFetch rewrites it to a plain
      // sentence before throwing (see toUserFriendlyErrorMessage in
      // src/services/api.ts), and the backend guards malformed ids.
      setError(err?.message || 'Could not send the request. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleBackdropClick = () => {
    if (!sending) onClose();
  };

  const mentorName = `${mentor.firstName} ${mentor.lastName}`.trim();

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="request-mentorship-title"
    >
      <div aria-hidden="true" className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleBackdropClick} />
      <div className="relative w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-5 shadow-xl outline-none">
        {sent ? (
          <div>
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600" aria-hidden="true">
                <CheckCircle2 className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 id="request-mentorship-title" className="text-base font-bold text-neutral-900">
                  Request sent
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-neutral-600">
                  Your mentorship request is on its way to {mentorName}. You can track its status under My Requests.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="shrink-0 rounded-full p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={onClose}
                className="rounded-full border-neutral-300 bg-white px-5 text-neutral-900 hover:bg-neutral-100"
              >
                Done
              </Button>
              <Button
                onClick={() => {
                  onClose();
                  router.push('/app/student/requests');
                }}
                className="rounded-full bg-neutral-900 px-6 text-white hover:bg-neutral-800"
              >
                View my requests
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="request-mentorship-title" className="text-base font-bold text-neutral-900">
                  Request mentorship
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-neutral-600">
                  {mentorName} · {mentor.title} at {mentor.company}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={sending}
                aria-label="Close"
                className="shrink-0 rounded-full p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {error && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {currentLeave && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700" role="alert">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  On leave until {formatLeaveDate(currentLeave.endDate)}
                  {currentLeave.reason ? ` — ${currentLeave.reason}` : ''}. Requests are
                  paused while they&rsquo;re away.
                </span>
              </div>
            )}

            {!currentLeave && futureLeave && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  Note: {mentor.firstName} has leave planned {formatLeaveDate(futureLeave.startDate)}
                  {' – '}
                  {formatLeaveDate(futureLeave.endDate)}
                  {futureLeave.reason ? ` (${futureLeave.reason})` : ''}.
                </span>
              </div>
            )}

            <label className="mt-4 block text-sm font-medium text-neutral-900" htmlFor="request-goal">
              What do you want to work on?
            </label>
            <input
              ref={goalRef}
              id="request-goal"
              type="text"
              value={goal}
              maxLength={200}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g. Build a backend portfolio for SDE roles"
              className="mt-1.5 h-10 w-full rounded-xl border border-neutral-300 bg-white px-4 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/20"
            />
            <p className="mt-1 text-right text-xs text-neutral-400">{goal.length}/200</p>

            <label className="mt-2 block text-sm font-medium text-neutral-900" htmlFor="request-message">
              Introduce yourself
            </label>
            <textarea
              id="request-message"
              value={message}
              maxLength={1000}
              rows={4}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={`Hi ${mentor.firstName}, I'm working on… and would love your guidance on…`}
              className="mt-1.5 w-full resize-none rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/20"
            />
            <p className="mt-1 text-right text-xs text-neutral-400">{message.length}/1000</p>

            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={sending}
                className="rounded-full border-neutral-300 bg-white px-5 text-neutral-900 hover:bg-neutral-100"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="rounded-full bg-neutral-900 px-6 text-white hover:bg-neutral-800 disabled:opacity-50"
              >
                {sending ? 'Sending…' : 'Send Request'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
