'use client';

import { UserCheck, FileText, Activity } from 'lucide-react';
import { useRoleGuard } from '@/lib/use-role-guard';
import { SectionLanding } from '@/components/dashboard/section-landing';
import { PageLoader } from '@/components/dashboard/page-primitives';

export default function AlumniMentorsLanding() {
  const { allowed } = useRoleGuard(['ALUMNI_OFFICER', 'ADMIN']);
  if (!allowed) return <PageLoader message="Verifying access…" />;

  return (
    <SectionLanding
      title="Mentors"
      description="Review mentor applications, manage active mentors, and track performance."
      icon={UserCheck}
      children={[
        {
          title: 'Applications',
          description: 'Review pending mentor applications.',
          href: '/app/alumni-officer/mentor-applications',
          icon: FileText,
        },
        {
          title: 'Active Mentors',
          description: 'Browse currently active mentors on the platform.',
          href: '/app/alumni-officer/mentors/active',
          icon: UserCheck,
        },
        {
          title: 'Performance',
          description: 'See how mentors are performing across sessions and ratings.',
          href: '/app/alumni-officer/mentor-performance',
          icon: Activity,
        },
      ]}
    />
  );
}
