'use client';

// Student mentorship workspace (2026-11-20, workspace slice Item 1):
// thin wrapper over the shared role-aware workspace component — the
// mentor side lives in src/pages/MentorMentorshipDetail.tsx (React) /
// app/mentor/mentorships/[mentorshipId]/page.tsx (Next). All workspace
// behaviour lives in the shared component; this file only picks the role.
import { MentorshipWorkspace } from '@/components/mentor/MentorshipWorkspace';

export default function MentorshipDetail() {
  return <MentorshipWorkspace role="student" />;
}
