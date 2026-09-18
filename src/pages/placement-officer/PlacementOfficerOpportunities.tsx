'use client';

import { Briefcase, Clock, FileText } from 'lucide-react';
import { useRoleGuard } from '@/lib/use-role-guard';
import { SectionLanding } from '@/components/dashboard/section-landing';
import { PageLoader } from '@/components/dashboard/page-primitives';

export default function PlacementOpportunitiesLanding() {
  const { allowed } = useRoleGuard(['PLACEMENT_OFFICER', 'ADMIN']);
  if (!allowed) return <PageLoader message="Verifying access…" />;

  return (
    <SectionLanding
      title="Opportunities"
      description="Manage active and upcoming opportunities, and review student applications."
      icon={Briefcase}
      children={[
        {
          title: 'Active',
          description: 'View opportunities currently open for applications.',
          href: '/app/placement-officer/opportunities/active',
          icon: Briefcase,
        },
        {
          title: 'Upcoming',
          description: 'See opportunities that are scheduled to open soon.',
          href: '/app/placement-officer/opportunities/upcoming',
          icon: Clock,
        },
        {
          title: 'Applications',
          description: 'Review applications submitted by students across all opportunities.',
          href: '/app/placement-officer/opportunities/applications',
          icon: FileText,
        },
      ]}
    />
  );
}
