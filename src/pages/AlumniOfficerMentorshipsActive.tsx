'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, RefreshCw, AlertCircle, Users } from 'lucide-react';
import { adminService } from '@/services/api';
import { useRoleGuard } from '@/lib/use-role-guard';
import { PageHeader, PageLoader, PageEmptyState } from '@/components/dashboard/page-primitives';

export default function AlumniActiveMentorshipsPage() {
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
      setError(err.message || 'Failed to load active mentorships.');
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
        title="Active Mentorships"
        description="Currently in-progress mentorships in the network."
        icon={CheckCircle}
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

      <div className="grid gap-4 md:grid-cols-4">
        <Tile label="Active" value={data?.active ?? '—'} color="bg-emerald-50 text-emerald-600" />
        <Tile label="Pending Requests" value={data?.pendingRequests ?? '—'} color="bg-amber-50 text-amber-600" />
        <Tile label="Completed" value={data?.completed ?? '—'} color="bg-purple-50 text-purple-600" />
        <Tile label="Cancelled" value={data?.cancelled ?? '—'} color="bg-gray-50 text-gray-600" />
      </div>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <PageLoader message="Loading…" />
          ) : (
            <PageEmptyState
              message="Aggregate counts shown above"
              hint="Drill into individual mentorships from the dashboard."
              icon={Users}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Tile({ label, value, color }: { label: string; value: any; color: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs text-lpu-text-secondary">{label}</p>
        <p className="text-3xl font-bold mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}
