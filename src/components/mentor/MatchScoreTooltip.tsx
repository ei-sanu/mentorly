'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import type { MentorMatch } from '@/types';

// ─── Match score tooltip (2026-11-20, Item 1 + match-fix Item 2) ───────────
// The match percentage on a recommendation card is a single number with no
// explanation — both mentors on the dashboard showed 23% and there was no
// way to tell why. Hovering (or focusing) the percentage opens this
// tooltip, which explains the number from real data only:
//
// - The score breakdown from the item's `scoreBreakdown` field
//   ({ semantic, careerGoal, expertise, industry, targetRole, availability,
//   llmAdjustment? } — points contributed, max = weight 35/20/15/10/10/10).
//   When `scoreBreakdown` is absent (old cached shape) the tooltip says
//   the breakdown is unavailable instead of inventing numbers.
// - The student side it was measured against: the student's own career
//   profile (target role, skills, goals, industry) fetched by the page
//   via studentService.getMyProfile(). No career profile → an honest
//   "based on limited profile information" line, never invented goals.
// - The mentor side it matched: the mentor's real expertise, industry
//   and mentoringAreas from the item itself.
// - The LLM adjustment is its own row, only when llmUsed is true. When
//   the LLM did not run, the tooltip says so honestly instead of
//   showing an adjustment.
//
// Restyled 2026-11-20 (match-fix Item 2): the first version was a big plain
// white card with bare text rows. This version keeps the same light minimal
// language (white card, hairline borders, black accents, neutral greys)
// but with a real header ("Why {score}%?" + score pill + X close button),
// each component as label + value + a thin progress bar, the AI row in
// emerald, and divider-separated sections with small-caps labels. No data
// point changed — presentation only; the props interface is untouched, so
// the StudentDashboard / FindMentors wiring stays as it is.
//
// The panel is `position: fixed` (measured from the trigger's bounding
// rect) so it is never clipped by the card's `overflow-hidden` or the
// Find Mentors scroll container. It flips ABOVE the trigger when there is
// no room below, clamps horizontally and vertically to the viewport, and
// caps at ~80vh with an internal scroll, so it never swallows the screen.
// Small screens: width min(340px, calc(100vw − 32px)).
// Plain React state only — no new dependency, no popover primitive exists
// in src/components/ui/.
//
// Open / close: hover opens (leaving closes), focus opens, click toggles
// and PINS the panel open (so the mouse can travel to the X button —
// hover alone would close the panel the moment the pointer left the
// trigger), Escape closes, click-outside closes, close-on-scroll. The X
// button is a real focusable button; tabbing from the trigger into the
// panel does not close it (blur checks where focus is going).

/** The career-profile fields the tooltip reads, as returned flat by GET /students/me. */
export interface TooltipStudentProfile {
  targetRole?: string;
  targetIndustry?: string;
  currentSkills?: string[];
  careerGoals?: string[];
  mentoringNeeds?: string;
}

const BREAKDOWN_ROWS: Array<{
  key: 'semantic' | 'careerGoal' | 'expertise' | 'industry' | 'targetRole' | 'availability';
  label: string;
  max: number;
}> = [
  { key: 'semantic', label: 'Semantic match', max: 35 },
  { key: 'careerGoal', label: 'Career-goal match', max: 20 },
  { key: 'expertise', label: 'Expertise match', max: 15 },
  { key: 'industry', label: 'Industry match', max: 10 },
  { key: 'targetRole', label: 'Target-role match', max: 10 },
  { key: 'availability', label: 'Availability', max: 10 },
];

// The LLM's influence band is ±30 points (llm-ranking.service.ts
// LLM_SCORE_ADJUST_BAND), so an adjustment's bar is scaled against 30.
const LLM_ADJUST_MAX = 30;

function formatSigned(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

export function MatchScoreTooltip({
  mentor,
  studentProfile,
  profileLoaded,
  children,
}: {
  mentor: MentorMatch;
  studentProfile: TooltipStudentProfile | null;
  profileLoaded: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  // Pinned = opened by click/tap: hover-leave and trigger blur must not
  // close it, or the X button could never be reached.
  const [pinned, setPinned] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRectRef = useRef<DOMRect | null>(null);

  const panelWidth = () =>
    Math.min(340, typeof window !== 'undefined' ? window.innerWidth - 32 : 340);

  const show = () => {
    const el = triggerRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      triggerRectRef.current = rect;
      const width = panelWidth();
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
      setPosition({ top: rect.bottom + 8, left });
    }
    setOpen(true);
  };
  const hide = () => {
    setOpen(false);
    setPinned(false);
  };

  // After the panel mounts, measure its real height and correct the
  // position: flip ABOVE the trigger when there is no room below, and
  // clamp vertically so it never runs off the top or bottom of the
  // viewport. A plain useEffect (not useLayoutEffect — the codebase uses
  // no useLayoutEffect, and this is a client component rendered by Next
  // on the server too): the correction lands one frame after the panel
  // appears. Runs once per open (dep is `open` only) so the setPosition
  // below cannot loop.
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    const triggerRect = triggerRectRef.current;
    let top = position.top;
    if (rect.bottom > window.innerHeight - 8) {
      const above = triggerRect ? triggerRect.top - 8 - rect.height : -1;
      top =
        above >= 8
          ? above
          : Math.max(8, window.innerHeight - rect.height - 8);
    }
    if (top < 8) top = 8;
    const width = panelWidth();
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    if (top !== position.top || left !== position.left) {
      setPosition({ top, left });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Close on scroll — the fixed panel would otherwise float away from its trigger.
  useEffect(() => {
    if (!open) return;
    const onScroll = () => setOpen(false);
    window.addEventListener('scroll', onScroll, true);
    return () => window.removeEventListener('scroll', onScroll, true);
  }, [open ]);

  // Escape closes from anywhere while the panel is open (trigger keydown
  // alone would miss focus sitting on the X button inside the panel).
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hide();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open ]);

  // Click-outside closes. Clicks inside the wrapper (trigger) or the
  // panel itself are ignored — the trigger's own click toggles instead.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (panelRef.current?.contains(target)) return;
      if (wrapperRef.current?.contains(target)) return;
      hide();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open ]);

  const breakdown = mentor.scoreBreakdown;
  const llmUsed = mentor.llmUsed === true;
  const hasBreakdown =
    !!breakdown && BREAKDOWN_ROWS.some((row) => typeof breakdown[row.key] === 'number');

  // Student side: only real profile fields, never invented goals/skills.
  const studentBits: string[] = [];
  if (studentProfile?.targetRole) studentBits.push(`Target role: ${studentProfile.targetRole}`);
  if (studentProfile?.targetIndustry) studentBits.push(`Industry: ${studentProfile.targetIndustry}`);
  if (Array.isArray(studentProfile?.currentSkills) && studentProfile.currentSkills.length > 0) {
    studentBits.push(`Your skills: ${studentProfile.currentSkills.join(', ')}`);
  }
  if (Array.isArray(studentProfile?.careerGoals) && studentProfile.careerGoals.length > 0) {
    studentBits.push(`Your career goals: ${studentProfile.careerGoals.join(', ')}`);
  }
  if (studentProfile?.mentoringNeeds) {
    studentBits.push(`What you asked for help with: ${studentProfile.mentoringNeeds}`);
  }
  const hasStudentProfile = studentBits.length > 0;

  const mentorBits: string[] = [];
  if (mentor.industry) mentorBits.push(`Industry: ${mentor.industry}`);
  if (Array.isArray(mentor.expertise) && mentor.expertise.length > 0) {
    mentorBits.push(`Expertise: ${mentor.expertise.join(', ')}`);
  }
  if (Array.isArray(mentor.mentoringAreas) && mentor.mentoringAreas.length > 0) {
    mentorBits.push(`Mentoring areas: ${mentor.mentoringAreas.join(', ')}`);
  }

  return (
    <span
      ref={wrapperRef}
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={() => {
        if (!pinned) hide();
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Why ${mentor.matchScore}%? Show score breakdown`}
        aria-expanded={open}
        onFocus={show}
        onBlur={(e) => {
          // Tabbing into the panel (e.g. onto the X button) must not
          // close it; focus leaving the tooltip entirely does.
          const next = e.relatedTarget as Node | null;
          if (!pinned && !(next && panelRef.current?.contains(next))) hide();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') hide();
        }}
        onClick={(e) => {
          // Touch / click toggles — hover alone never fires on touch screens.
          // A click also pins the panel open so the X button is reachable.
          e.preventDefault();
          if (open && pinned) hide();
          else {
            show();
            setPinned(true);
          }
        }}
        className="inline-flex cursor-help items-center gap-2 rounded outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/40"
      >
        {children}
      </button>
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label={`Why ${mentor.matchScore}%? Score breakdown`}
          style={{
            top: position.top,
            left: position.left,
            width: 'min(340px, calc(100vw - 32px))',
          }}
          className="fixed z-50 max-h-[80vh] overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-4 text-left shadow-xl"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <p className="truncate text-sm font-semibold text-neutral-900">
                Why {mentor.matchScore}%?
              </p>
              <span className="shrink-0 rounded-full bg-neutral-900 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-white">
                {mentor.matchScore}%
              </span>
            </div>
            <button
              type="button"
              aria-label="Close score breakdown"
              // mousedown preventDefault keeps focus on the trigger so the
              // trigger's blur handler cannot unmount the panel before
              // this click lands.
              onMouseDown={(e) => e.preventDefault()}
              onClick={hide}
              className="shrink-0 rounded-md p-1 text-neutral-400 outline-none hover:bg-neutral-100 hover:text-neutral-900 focus-visible:ring-2 focus-visible:ring-neutral-900/40"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {hasBreakdown && breakdown ? (
            <div className="mt-3 space-y-2.5">
              {BREAKDOWN_ROWS.map((row) => {
                const value = breakdown[row.key];
                const pct =
                  typeof value === 'number' ? clampPct((value / row.max) * 100) : 0;
                return (
                  <div key={row.key}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-neutral-600">{row.label}</span>
                      <span className="font-medium tabular-nums text-neutral-900">
                        {typeof value === 'number' ? `${value}/${row.max}` : `—/${row.max}`}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-100">
                      <div
                        className="h-full rounded-full bg-neutral-900"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {llmUsed && typeof breakdown.llmAdjustment === 'number' && (
                <div className="rounded-lg bg-emerald-50 px-2 py-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-emerald-700">AI adjustment</span>
                    <span className="font-semibold tabular-nums text-emerald-700">
                      {formatSigned(breakdown.llmAdjustment)}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-emerald-100">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{
                        width: `${clampPct(
                          (Math.abs(breakdown.llmAdjustment) / LLM_ADJUST_MAX) * 100,
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              )}
              <div className="border-t border-neutral-100 pt-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-neutral-900">Total</span>
                  <span className="font-semibold tabular-nums text-neutral-900">
                    {mentor.matchScore}/100
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-neutral-100">
                  <div
                    className="h-full rounded-full bg-neutral-900"
                    style={{ width: `${clampPct(mentor.matchScore)}%` }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-xs leading-relaxed text-neutral-600">
              A score breakdown is unavailable for this recommendation.
            </p>
          )}

          {llmUsed ? (
            <p className="mt-3 flex items-center gap-1.5 text-xs leading-relaxed text-emerald-700">
              <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
              Ranked by AI for your profile.
            </p>
          ) : (
            <p className="mt-3 text-xs leading-relaxed text-neutral-600">
              AI re-ranking did not run for this recommendation.
            </p>
          )}

          <div className="mt-3 border-t border-neutral-100 pt-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
              Measured against your profile
            </p>
            {!profileLoaded ? (
              <p className="mt-1 text-xs leading-relaxed text-neutral-600">
                Loading your profile…
              </p>
            ) : hasStudentProfile ? (
              <ul className="mt-1 space-y-1 text-xs leading-relaxed text-neutral-600">
                {studentBits.map((bit) => (
                  <li key={bit}>{bit}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-xs leading-relaxed text-neutral-600">
                Based on limited profile information — your career profile is
                empty, so this match could not be measured against your goals,
                skills, or target role.
              </p>
            )}
          </div>

          {mentorBits.length > 0 && (
            <div className="mt-3 border-t border-neutral-100 pt-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                Matched mentor
              </p>
              <ul className="mt-1 space-y-1 text-xs leading-relaxed text-neutral-600">
                {mentorBits.map((bit) => (
                  <li key={bit}>{bit}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </span>
  );
}
