'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/lib/mock-auth';
import { dashboardPathFor } from '@/lib/use-role-guard';
import { Card, CardContent } from '@/components/ui/card';
import { ErrorState } from '@/components/dashboard/primitives';
import { AdminView } from '@/components/dashboard/admin-view';

/**
 * Admin dashboard entry point. Officers (Alumni / Placement) are routed
 * to their canonical dashboards at /app/<role>/dashboard so that we have
 * a single source of truth per role. This page renders the AdminView
 * for ADMIN and the admin-only operations.
 */
export default function AdminDashboardPage() {
  const { user } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!user) return;
    if (user.role === 'ALUMNI_OFFICER' || user.role === 'PLACEMENT_OFFICER') {
      router.replace(dashboardPathFor(user.role));
    } else if (user.role !== 'ADMIN') {
      router.replace(dashboardPathFor(user.role));
    }
  }, [user, router]);

  if (!user || user.role !== 'ADMIN') {
    return (
      <Card>
        <CardContent className="pt-6">
          <ErrorState message="Loading your dashboard…" />
        </CardContent>
      </Card>
    );
  }

  return <AdminView />;
}
