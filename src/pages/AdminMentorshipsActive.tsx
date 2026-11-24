'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, RefreshCw, AlertCircle } from 'lucide-react';
import { adminService } from '@/services/api';
import { useRoleGuard } from '@/lib/use-role-guard';
import { PageHeader, PageLoader, PageEmptyState } from '@/components/dashboard/page-primitives';

export default function AdminActiveMentorshipsPage() {
  const { allowed } = useRoleGuard(['ADMIN']);
  const [items, setItems] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminService.getMentorshipOverview();
      setItems(data);
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
        description="Mentorships currently in progress across the platform."
        icon={CheckCircle2}
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

      <div className="grid gap-4 md:grid-cols-3">
        <Tile label="Active" value={items?.active ?? '—'} color="bg-emerald-50 text-emerald-600" />
        <Tile label="Paused" value={items?.paused ?? '—'} color="bg-amber-50 text-amber-600" />
        <Tile label="At-Risk" value="—" color="bg-red-50 text-red-600" />
      </div>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <PageLoader message="Loading active mentorships…" />
          ) : (
            <PageEmptyState
              message="Active mentorship list aggregated above"
              hint="Drill into the Analytics dashboard for per-mentorship details."
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
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-lpu-text-secondary">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
          </div>
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${color}`}>
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
