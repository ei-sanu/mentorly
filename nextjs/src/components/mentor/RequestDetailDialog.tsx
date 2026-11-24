'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { InitialsAvatar } from '@/components/ui/initials-avatar';
import { AiRefinedSummary } from '@/components/mentor/AiRefinedSummary';
import { MentorshipRequest } from '@/types';

// ─── Request detail dialog (2026-11-20, Item 3) ───────────────────────────
// Mentor-side detail view for a pending (or past) mentorship request.
// Dialog shell copied from RequestMentorshipDialog.tsx (fixed inset-0
// overlay, backdrop-click close, white rounded-2xl card, X close,
// Escape-to-close with cleanup, role="dialog" aria-modal="true",
// focus-on-open) — widened to max-w-lg because detail content is
// longer than the request form. No new modal system.
//
// The dialog opens instantly from the already-loaded list item: goal,
// message, AI summary and student are already in the list response.
// The parent refreshes through requestService.getRequestById in the
// background (a refinement lands ~10s after the request is created).
//
// Honesty rules (same as the pages): the batch line renders real
// studentProfile fields only — each absent/empty field is
// "Not provided", never "LPU Student", never a guessed year. The AI
// section is the AiRefinedSummary component as-is; when aiRefined is
// false it shows the component's own neutral note and nothing else.
// No new AI copy, no invented advice.

// The backend used to leak the populated student User document into
// `studentId`, so calling .slice() on it threw and crashed the mentor
// pages (2026-11-20). Same shape as the helper in MentorDashboard /
// MentorRequests: the name comes from the populated `student` object,
// with a safe fallback that can never throw even if the id arrives in
// an unexpected shape. Exported so the pages can import the one copy.
export function studentDisplayName(req: MentorshipRequest): string {
  const name = [req.student?.firstName, req.student?.lastName].filter(Boolean).join(' ').trim();
  if (name) return name;
  const idText = typeof req.studentId === 'string' ? req.studentId : String(req.studentId ?? '');
  return idText ? `Student ${idText.slice(0, 6)}` : 'Student';
}

function textField(value?: string): string {
  return value && value.trim() ? value.trim() : 'Not provided';
}

function yearField(value: unknown, label: string): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${label} ${value}` : 'Not provided';
}

// Current batch line from the real studentProfile — programme · school
// · Year <yearOfStudy> · Batch of <graduationYear>. Each absent/empty
// field renders "Not provided"; nothing is guessed.
function batchLine(request: MentorshipRequest): string {
  const p = request.studentProfile;
  return [
    textField(p?.programme),
    textField(p?.school),
    yearField(p?.yearOfStudy, 'Year'),
    yearField(p?.graduationYear, 'Batch of'),
  ].join(' · ');
}

export interface RequestDetailDialogProps {
  request: MentorshipRequest | null;
  open: boolean;
  onClose: () => void;
  onAccept?: (id: string) => void;
  onDecline?: (id: string) => void;
}

export function RequestDetailDialog({ request, open, onClose, onAccept, onDecline }: RequestDetailDialogProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  // Focus the card when the dialog opens.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => cardRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open, request?.id]);

  // Escape closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !request) return null;

  const isPending = request.status === 'PENDING';
  const received = new Date(request.createdAt);
  const receivedText = Number.isNaN(received.getTime()) ? 'Not provided' : received.toLocaleDateString();

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="request-detail-title"
    >
      <div aria-hidden="true" className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={cardRef}
        tabIndex={-1}
        className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-5 shadow-xl outline-none"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <InitialsAvatar
              firstName={request.student?.firstName}
              lastName={request.student?.lastName}
              email={request.student?.email}
              className="h-11 w-11 text-base"
            />
            <div className="min-w-0">
              <h2 id="request-detail-title" className="text-base font-bold text-neutral-900">
                {studentDisplayName(request)}
              </h2>
              {request.student?.email && (
                <p className="mt-0.5 truncate text-sm text-neutral-600">{request.student.email}</p>
              )}
            </div>
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

        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Current batch</p>
          <p className="mt-1 text-sm leading-relaxed text-neutral-900">{batchLine(request)}</p>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-neutral-600">
          <span>Received {receivedText}</span>
          {request.status === 'PENDING' ? (
            <Badge variant="warning" className="text-xs">
              Pending
            </Badge>
          ) : request.status === 'ACCEPTED' ? (
            <Badge className="border-emerald-200 bg-emerald-50 text-xs text-emerald-700">Accepted</Badge>
          ) : (
            <Badge className="border-neutral-200 bg-neutral-100 text-xs text-neutral-600">
              {request.status.charAt(0) + request.status.slice(1).toLowerCase()}
            </Badge>
          )}
        </div>

        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Target Goal</p>
          <p className="mt-1 text-sm leading-relaxed text-neutral-900">{request.goal}</p>
        </div>

        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Message</p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-neutral-900">{request.message}</p>
        </div>

        {request.aiRefined !== undefined && (
          <div className="mt-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              What would be better for the student
            </p>
            <p className="mt-0.5 text-xs text-neutral-400">AI-generated</p>
            <div className="mt-2">
              <AiRefinedSummary request={request} compact={false} />
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          {isPending ? (
            <>
              {onDecline && (
                <Button
                  variant="outline"
                  onClick={() => onDecline(request.id)}
                  className="rounded-full border-neutral-300 bg-white px-5 text-neutral-900 hover:bg-neutral-100"
                >
                  Decline
                </Button>
              )}
              {onAccept && (
                <Button
                  onClick={() => onAccept(request.id)}
                  className="rounded-full bg-neutral-900 px-6 text-white hover:bg-neutral-800"
                >
                  Accept
                </Button>
              )}
            </>
          ) : (
            <Button
              variant="outline"
              onClick={onClose}
              className="rounded-full border-neutral-300 bg-white px-5 text-neutral-900 hover:bg-neutral-100"
            >
              Close
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
