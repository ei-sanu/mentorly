'use client';

// Mentor mentorship workspace (2026-11-20, workspace slice Item 1):
// thin wrapper over the shared role-aware workspace component, mentor
// side — overview, sessions, goals, feedback, Message + Schedule, with
// the student in the header and Accept / Decline on session requests.
// Mentor-only: a student landing here is sent to their own dashboard
// by useRoleGuard (same guard MyMentees uses).
import { useRoleGuard } from '@/lib/use-role-guard';
import { MentorshipWorkspace } from '@/components/mentor/MentorshipWorkspace';
import { PageLoader } from '@/components/dashboard/page-primitives';

export default function MentorMentorshipDetail() {
  const { allowed } = useRoleGuard(['MENTOR']);
  if (!allowed) return <PageLoader message="Verifying access…" />;
  return <MentorshipWorkspace role="mentor" />;
}
