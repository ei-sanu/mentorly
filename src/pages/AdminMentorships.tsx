'use client';

import { FileText, CheckCircle, Sparkles } from 'lucide-react';
import { useRoleGuard } from '@/lib/use-role-guard';
import { SectionLanding } from '@/components/dashboard/section-landing';
import { PageLoader } from '@/components/dashboard/page-primitives';

export default function AdminMentorshipLanding() {
  const { allowed } = useRoleGuard(['ADMIN']);
  if (!allowed) return <PageLoader message="Verifying access…" />;

  return (
    <SectionLanding
      title="Mentorship"
      description="Review mentorship requests, active engagements, and completed sessions."
      icon={FileText}
      children={[
        {
          title: 'Requests',
          description: 'Pending mentorship requests awaiting admin review.',
          href: '/app/admin/mentorships/requests',
          icon: FileText,
        },
        {
          title: 'Active',
          description: 'Mentorships that are currently in progress.',
          href: '/app/admin/mentorships/active',
          icon: CheckCircle,
        },
        {
          title: 'Completed',
          description: 'Mentorships that have been completed successfully.',
          href: '/app/admin/mentorships/completed',
          icon: Sparkles,
        },
      ]}
    />
  );
}
