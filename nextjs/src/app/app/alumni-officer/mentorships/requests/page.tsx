'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, RefreshCw, AlertCircle, Briefcase } from 'lucide-react';
import { adminService } from '@/services/api';
import { useRoleGuard } from '@/lib/use-role-guard';
import { PageHeader, PageLoader, PageEmptyState } from '@/components/dashboard/page-primitives';

export default function AlumniMentorshipRequestsPage() {
  const { allowed } = useRoleGuard(['ALUMNI_OFFICER', 'ADMIN']);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const d = await adminService.getMentorshipOverview();
      setData(d);
    } catch (err: any) {
      setError(err.message || 'Failed to load mentorship requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (allowed) load();
  }, [allowed]);

  if (!allowed) return <PageLoader message="Verifying access…" />;

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Mentorship Requests"
        description="Live request pipeline across the platform."
        icon={Clock}
        actions={
          <Button variant="outline" onClick={load} size="sm" className="rounded-xl">
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
        }
      />

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Request Funnel</CardTitle>
          <CardDescription>Snapshot of pending and recent requests</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <PageLoader message="Loading…" />
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              <div className="p-6 border border-amber-200 rounded-2xl bg-amber-50/30 text-center">
                <p className="text-xs text-lpu-text-secondary uppercase tracking-wide">Pending</p>
                <p className="text-4xl font-bold mt-2 text-amber-600">{data?.pendingRequests ?? '—'}</p>
              </div>
              <div className="p-6 border border-emerald-200 rounded-2xl bg-emerald-50/30 text-center">
                <p className="text-xs text-lpu-text-secondary uppercase tracking-wide">Active</p>
                <p className="text-4xl font-bold mt-2 text-emerald-600">{data?.active ?? '—'}</p>
              </div>
              <div className="p-6 border border-purple-200 rounded-2xl bg-purple-50/30 text-center">
                <p className="text-xs text-lpu-text-secondary uppercase tracking-wide">Completed</p>
                <p className="text-4xl font-bold mt-2 text-purple-600">{data?.completed ?? '—'}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
