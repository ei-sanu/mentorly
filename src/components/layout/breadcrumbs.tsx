'use client';

// Shared breadcrumb navigation, rendered by the app shell (AppLayout)
// below the header — never inside header.tsx.
//
// Route labels come from SEGMENT_LABELS below (human labels, never raw
// slugs). Dynamic segments (ids) never render raw: they fall back to a
// generic label for their parent collection ("Mentor", "Mentorship",
// "Conversation"), unless a page that already loaded the real name
// registered it for the current path via registerBreadcrumbLabel() —
// e.g. a mentor profile page can register the mentor's name, and the
// shell picks it up without the page touching the shell.
//
// Hidden (renders nothing) outside /app and when there is only a single
// crumb to show (e.g. bare /app, or the landing page, which never uses
// the app shell at all).

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type BreadcrumbItem = {
  label: string;
  href: string;
  current: boolean;
};

// One human label per known path segment. Add a row here when a new
// /app route lands — an unknown segment falls back to Title Case, never
// to the raw slug.
const SEGMENT_LABELS: Record<string, string> = {
  admin: 'Admin',
  'alumni-officer': 'Alumni Officer',
  'placement-officer': 'Placement Officer',
  student: 'Student',
  mentor: 'Mentor',
  dashboard: 'Dashboard',
  analytics: 'Analytics',
  settings: 'Settings',
  profile: 'Profile',
  calendar: 'Calendar',
  messages: 'Messages',
  requests: 'Requests',
  mentorships: 'Mentorships',
  mentors: 'Mentors',
  mentees: 'My Mentees',
  availability: 'Availability',
  capacity: 'Capacity',
  verification: 'Verification',
  matching: 'AI Matching',
  overview: 'Overview',
  config: 'Configuration',
  users: 'Users',
  all: 'All Users',
  alumni: 'Alumni',
  students: 'Students',
  directory: 'Directory',
  notifications: 'Notifications',
  'audit-logs': 'Audit Logs',
  'ai-insights': 'AI Insights',
  opportunities: 'Opportunities',
  active: 'Active',
  completed: 'Completed',
  applications: 'Applications',
  upcoming: 'Upcoming',
  placements: 'Placements',
  interviews: 'Interviews',
  outcomes: 'Outcomes',
  readiness: 'Readiness',
  'skill-gaps': 'Skill Gaps',
  feedback: 'Feedback',
  'mentor-applications': 'Mentor Applications',
  'mentor-performance': 'Mentor Performance',
};

// Generic label for a dynamic (id) segment, by its parent segment.
const DYNAMIC_LABELS: Record<string, string> = {
  mentors: 'Mentor',
  mentorships: 'Mentorship',
  messages: 'Conversation',
  users: 'User',
};

const DYNAMIC_FALLBACK = 'Details';

// A segment is dynamic when it is not a known label and it looks like
// an id (24-hex Mongo ObjectId, a UUID, or any long id-like token), or
// when it sits under a known collection segment (mentors, mentorships,
// messages, users) — ids there are ids even when short.
function isDynamicSegment(segment: string, parent: string): boolean {
  if (SEGMENT_LABELS[segment]) return false;
  if (DYNAMIC_LABELS[parent]) return true;
  return (
    /^[0-9a-f]{24}$/i.test(segment) ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment) ||
    /^[A-Za-z0-9_-]{16,}$/.test(segment)
  );
}

function humanize(segment: string): string {
  return segment
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Pure path → crumbs. `dynamicLabels` maps a full href to the label a
// page registered for it (e.g. a person's name); it wins over the
// generic dynamic label. Returns [] for anything outside /app.
export function buildBreadcrumbs(
  pathname: string | null | undefined,
  dynamicLabels: Record<string, string> = {},
): BreadcrumbItem[] {
  if (!pathname || !pathname.startsWith('/app')) return [];
  const segments = pathname.split('/').filter(Boolean).slice(1); // drop 'app'
  const crumbs: BreadcrumbItem[] = [{ label: 'Home', href: '/', current: false }];
  let href = '/app';
  segments.forEach((segment, i) => {
    href += `/${segment}`;
    const parent = i === 0 ? 'app' : segments[i - 1];
    const label =
      dynamicLabels[href] ||
      (isDynamicSegment(segment, parent)
        ? DYNAMIC_LABELS[parent] || DYNAMIC_FALLBACK
        : SEGMENT_LABELS[segment] || humanize(segment));
    crumbs.push({ label, href, current: i === segments.length - 1 });
  });
  crumbs[crumbs.length - 1].current = true;
  return crumbs;
}

// --- Dynamic-label registry (person's name when already loaded) --------
// A page that has loaded the entity for the current path calls
// registerBreadcrumbLabel(window.location.pathname, name); the shell
// re-renders with that label. Nothing registers today — the shell falls
// back to the generic labels above — so this is an opt-in hook, not a
// requirement on any page.
const registeredLabels: Record<string, string> = {};
const LABEL_EVENT = 'mentorly:breadcrumb-label';

export function registerBreadcrumbLabel(href: string, label: string): void {
  if (!href || !label) return;
  registeredLabels[href] = label;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(LABEL_EVENT, { detail: { href, label } }));
  }
}

export function clearBreadcrumbLabel(href: string): void {
  delete registeredLabels[href];
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(LABEL_EVENT, { detail: { href, label: '' } }));
  }
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const [, setLabelVersion] = useState(0);

  // Re-render when a page registers (or clears) a label for a path.
  useEffect(() => {
    const onLabel = () => setLabelVersion((v) => v + 1);
    window.addEventListener(LABEL_EVENT, onLabel);
    return () => window.removeEventListener(LABEL_EVENT, onLabel);
  }, []);

  const crumbs = buildBreadcrumbs(pathname, registeredLabels);
  // Nothing to show: outside /app, bare /app, or a single crumb.
  if (crumbs.length < 2) return null;

  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex flex-wrap items-center gap-1.5 text-sm">
        {crumbs.map((crumb, i) => (
          <li key={crumb.href} className="flex items-center gap-1.5">
            {i > 0 && (
              <span aria-hidden="true" className="text-neutral-300">
                /
              </span>
            )}
            {crumb.current ? (
              <span aria-current="page" className="font-medium text-neutral-900">
                {crumb.label}
              </span>
            ) : (
              <Link href={crumb.href} className="text-neutral-500 hover:text-neutral-900">
                {crumb.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export default Breadcrumbs;
