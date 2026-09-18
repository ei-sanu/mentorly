'use client';

import { Users, CheckSquare, ShieldAlert } from 'lucide-react';
import { useRoleGuard } from '@/lib/use-role-guard';
import { SectionLanding } from '@/components/dashboard/section-landing';
import { PageLoader } from '@/components/dashboard/page-primitives';

export default function PlacementStudentsLanding() {
  const { allowed } = useRoleGuard(['PLACEMENT_OFFICER', 'ADMIN']);
  if (!allowed) return <PageLoader message="Verifying access…" />;

  return (
    <SectionLanding
      title="Students"
      description="Explore student profiles, track career readiness, and identify skill gaps."
      icon={Users}
      children={[
        {
          title: 'Directory',
          description: 'Browse all registered students and their career profiles.',
          href: '/app/placement-officer/directory',
          icon: Users,
        },
        {
          title: 'Career Readiness',
          description: 'Assess each student\u2019s readiness for placements and interviews.',
          href: '/app/placement-officer/readiness',
          icon: CheckSquare,
        },
        {
          title: 'Skill Gaps',
          description: 'Identify skills students are missing for target roles.',
          href: '/app/placement-officer/skill-gaps',
          icon: ShieldAlert,
        },
      ]}
    />
  );
}
