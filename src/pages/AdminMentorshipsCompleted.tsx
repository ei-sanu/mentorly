'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, RefreshCw, AlertCircle } from 'lucide-react';
import { adminService } from '@/services/api';
import { useRoleGuard } from '@/lib/use-role-guard';
import { PageHeader, PageLoader, PageEmptyState } from '@/components/dashboard/page-primitives';

export default function AdminCompletedMentorshipsPage() {
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
      setError(err.message || 'Failed to load completed mentorships.');
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
        title="Completed Mentorships"
        description="Mentorships that have wrapped up across the platform."
        icon={Sparkles}
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
        <CardContent className="pt-6">
          {loading ? (
            <PageLoader message="Loading…" />
          ) : (
            <div className="space-y-3">
              <Tile label="Completed" value={items?.completed ?? '—'} color="bg-purple-50 text-purple-600" />
              <Tile label="Cancelled" value={items?.cancelled ?? '—'} color="bg-gray-50 text-gray-600" />
              <PageEmptyState
                message="Aggregated counts shown above"
                hint="Use the Analytics dashboard for completion rate trends and per-mentor performance."
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Tile({ label, value, color }: { label: string; value: any; color: string }) {
  return (
    <div className="flex items-center justify-between p-4 border border-gray-100 rounded-xl">
      <div>
        <p className="text-xs text-lpu-text-secondary">{label}</p>
        <p className="text-2xl font-bold mt-1">{value}</p>
      </div>
      <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${color}`}>
        <Sparkles className="h-5 w-5" />
      </div>
    </div>
  );
}
