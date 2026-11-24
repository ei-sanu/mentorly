'use client';

import { Users, GraduationCap, User, Award } from 'lucide-react';
import { useRoleGuard } from '@/lib/use-role-guard';
import { SectionLanding } from '@/components/dashboard/section-landing';
import { PageLoader } from '@/components/dashboard/page-primitives';

export default function AdminUsersLanding() {
  const { allowed } = useRoleGuard(['ADMIN']);
  if (!allowed) return <PageLoader message="Verifying access…" />;

  return (
    <SectionLanding
      title="Users"
      description="Browse and manage every user on the platform by role."
      icon={Users}
      children={[
        {
          title: 'All Users',
          description: 'View every registered user in one consolidated list.',
          href: '/app/admin/users/all',
          icon: Users,
        },
        {
          title: 'Students',
          description: 'Manage student profiles, status, and access.',
          href: '/app/admin/users/students',
          icon: GraduationCap,
        },
        {
          title: 'Alumni',
          description: 'View and manage alumni accounts and profiles.',
          href: '/app/admin/users/alumni',
          icon: User,
        },
        {
          title: 'Mentors',
          description: 'Manage mentor accounts, capacity, and availability.',
          href: '/app/admin/users/mentors',
          icon: Award,
        },
      ]}
    />
  );
}
