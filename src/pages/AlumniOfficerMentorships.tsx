'use client';

import { CheckCircle, Clock, MessageSquare } from 'lucide-react';
import { useRoleGuard } from '@/lib/use-role-guard';
import { SectionLanding } from '@/components/dashboard/section-landing';
import { PageLoader } from '@/components/dashboard/page-primitives';

export default function AlumniMentorshipLanding() {
  const { allowed } = useRoleGuard(['ALUMNI_OFFICER', 'ADMIN']);
  if (!allowed) return <PageLoader message="Verifying access…" />;

  return (
    <SectionLanding
      title="Mentorship"
      description="Oversee active mentorships, new requests, and session feedback."
      icon={CheckCircle}
      children={[
        {
          title: 'Active',
          description: 'Mentorships that are currently in progress.',
          href: '/app/alumni-officer/mentorships/active',
          icon: CheckCircle,
        },
        {
          title: 'Requests',
          description: 'New mentorship requests awaiting review.',
          href: '/app/alumni-officer/mentorships/requests',
          icon: Clock,
        },
        {
          title: 'Feedback',
          description: 'Review session feedback from mentees and mentors.',
          href: '/app/alumni-officer/mentorships/feedback',
          icon: MessageSquare,
        },
      ]}
    />
  );
}
