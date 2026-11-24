'use client';

import { Sparkles } from 'lucide-react';
import { MentorshipRequest } from '@/types';

// ─── AI-refined request summary (2026-11-20) ─────────────────────────────
// When a student sends a mentorship request, the backend asks the local
// Llama model to rewrite the student's goal + introduction into a clear,
// detailed summary of what they are actually asking for — what they want
// to learn or build, their context, and suggested focus areas. The
// refinement runs in the background after the request is created, so it
// never blocks or fails the send; the mentor sees the summary on their
// next load, WITH the student's original goal + message still shown
// alongside it (the original is always the source of truth).
//
// Honest labelling: the summary section renders only when aiRefined is
// true (the LLM genuinely ran). When aiRefined is false the request is
// either still being refined (no error recorded yet) or the refinement
// failed — a muted one-line note says so, without the technical error
// kind. Requests created before this feature carry no ai fields at all
// and render nothing extra.

export function AiRefinedSummary({ request, compact = false }: { request: MentorshipRequest; compact?: boolean }) {
  if (request.aiRefined === true && request.aiRefinedSummary) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-500">
          <Sparkles className="h-3.5 w-3.5" /> AI-refined summary
        </p>
        <p className={`mt-2 text-sm leading-relaxed text-neutral-800 ${compact ? 'line-clamp-3' : ''}`}>
          {request.aiRefinedSummary}
        </p>
        {!compact && request.aiFocusAreas && request.aiFocusAreas.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Suggested focus</p>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {request.aiFocusAreas.map((area, i) => (
                <li key={i} className="rounded-full border border-neutral-200 bg-white px-2.5 py-0.5 text-xs text-neutral-700">
                  {area}
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="mt-3 text-xs text-neutral-400">
          Refined by Mentorly AI from the request as written. The original goal and message are shown with this request.
        </p>
      </div>
    );
  }

  // Requests created before this feature carry no ai fields at all — nothing to say.
  if (request.aiRefined === undefined) return null;

  // A new request whose refinement has not landed yet (or failed).
  return (
    <p className="text-xs text-neutral-400">
      {request.aiRefineError
        ? 'An AI summary couldn’t be produced for this request.'
        : 'AI summary is being prepared…'}
    </p>
  );
}
