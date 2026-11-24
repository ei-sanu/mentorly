'use client';

import { Users, ShieldAlert, BarChart3 } from 'lucide-react';
import { useRoleGuard } from '@/lib/use-role-guard';
import { SectionLanding } from '@/components/dashboard/section-landing';
import { PageLoader } from '@/components/dashboard/page-primitives';

export default function AlumniAlumniLanding() {
  const { allowed } = useRoleGuard(['ALUMNI_OFFICER', 'ADMIN']);
  if (!allowed) return <PageLoader message="Verifying access…" />;

  return (
    <SectionLanding
      title="Alumni"
      description="Browse the alumni directory, review verifications, and analyze engagement."
      icon={Users}
      children={[
        {
          title: 'Directory',
          description: 'Browse all registered alumni and their profiles.',
          href: '/app/alumni-officer/directory',
          icon: Users,
        },
        {
          title: 'Verification',
          description: 'Review and approve alumni verification requests.',
          href: '/app/alumni-officer/verification',
          icon: ShieldAlert,
        },
        {
          title: 'Analytics',
          description: 'View analytics on alumni engagement and activity.',
          href: '/app/alumni-officer/analytics',
          icon: BarChart3,
        },
      ]}
    />
  );
}
