'use client';

// Mentorly AI loader (2026-11-20, workspace slice Item 6): shown while
// recommendations are genuinely loading / the AI is ranking — on Find
// Mentors and on the student dashboard, and while a refresh re-runs the
// ranking — instead of a blank list or a bare spinner. Light minimal
// style, same language as the rest of the app: white card, hairline
// border, three pulsing dots, the exact line below. It renders ONLY
// while loading; the caller swaps it for the results (or the honest
// fallback/empty state) the moment loading ends.
export function MentorlyAiLoader() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-lpu-border bg-white px-6 py-12 text-center"
    >
      <span className="flex items-center gap-1.5" aria-hidden="true">
        <span className="h-2 w-2 animate-bounce rounded-full bg-neutral-900 [animation-delay:-0.3s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-neutral-900 [animation-delay:-0.15s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-neutral-900" />
      </span>
      <p className="text-sm font-medium text-neutral-900">
        Mentorly AI is currently finding the best mentor for you
      </p>
    </div>
  );
}
