'use client';

import { FileText, Calendar, CheckCircle } from 'lucide-react';
import { useRoleGuard } from '@/lib/use-role-guard';
import { SectionLanding } from '@/components/dashboard/section-landing';
import { PageLoader } from '@/components/dashboard/page-primitives';

export default function PlacementPlacementsLanding() {
  const { allowed } = useRoleGuard(['PLACEMENT_OFFICER', 'ADMIN']);
  if (!allowed) return <PageLoader message="Verifying access…" />;

  return (
    <SectionLanding
      title="Placements"
      description="Track student placement applications, interviews, and final outcomes."
      icon={FileText}
      children={[
        {
          title: 'Applications',
          description: 'See all placement applications across companies and roles.',
          href: '/app/placement-officer/placements/applications',
          icon: FileText,
        },
        {
          title: 'Interviews',
          description: 'Schedule and review upcoming and past student interviews.',
          href: '/app/placement-officer/placements/interviews',
          icon: Calendar,
        },
        {
          title: 'Outcomes',
          description: 'Track final placement outcomes, offers, and conversions.',
          href: '/app/placement-officer/placements/outcomes',
          icon: CheckCircle,
        },
      ]}
    />
  );
}
