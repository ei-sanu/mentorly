'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/lib/mock-auth';
import { dashboardPathFor } from '@/lib/use-role-guard';
import { Card, CardContent } from '@/components/ui/card';
import { ErrorState } from '@/components/dashboard/primitives';
import { PlacementOfficerView } from '@/components/dashboard/placement-officer-view';

/**
 * Placement Officer dashboard entry point. Renders the PlacementOfficerView
 * which is a clean read-only overview: key stats, charts, and a students
 * table. Heavy CRUD (creating opportunities, updating application status,
 * student detail modals) lives on the dedicated sub-pages:
 *   - /app/placement-officer/students
 *   - /app/placement-officer/opportunities
 *   - /app/placement-officer/placements
 */
export default function PlacementOfficerDashboardPage() {
  const { user } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!user) return;
    if (user.role !== 'PLACEMENT_OFFICER') {
      router.replace(dashboardPathFor(user.role));
    }
  }, [user, router]);

  if (!user || user.role !== 'PLACEMENT_OFFICER') {
    return (
      <Card>
        <CardContent className="pt-6">
          <ErrorState message="Loading your dashboard…" />
        </CardContent>
      </Card>
    );
  }

  return <PlacementOfficerView />;
}
