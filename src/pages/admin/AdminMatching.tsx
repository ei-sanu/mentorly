'use client';

import { Target, Sliders } from 'lucide-react';
import { useRoleGuard } from '@/lib/use-role-guard';
import { SectionLanding } from '@/components/dashboard/section-landing';
import { PageLoader } from '@/components/dashboard/page-primitives';

export default function AdminMatchingLanding() {
  const { allowed } = useRoleGuard(['ADMIN']);
  if (!allowed) return <PageLoader message="Verifying access…" />;

  return (
    <SectionLanding
      title="AI Matching"
      description="Monitor and configure the AI-powered mentorship matching system."
      icon={Target}
      children={[
        {
          title: 'Overview',
          description: 'See how the matching engine is performing across cohorts.',
          href: '/app/admin/matching/overview',
          icon: Target,
        },
        {
          title: 'Configuration',
          description: 'Tune weights, rules, and signals used by the matching algorithm.',
          href: '/app/admin/matching/config',
          icon: Sliders,
        },
      ]}
    />
  );
}
