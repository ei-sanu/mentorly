'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, RefreshCw, AlertCircle, TrendingUp, Users, Award, Briefcase } from 'lucide-react';
import { placementOfficerService } from '@/services/api';
import { useRoleGuard } from '@/lib/use-role-guard';
import { PageHeader, PageLoader, PageEmptyState } from '@/components/dashboard/page-primitives';

export default function PlacementOutcomesPage() {
  const { allowed } = useRoleGuard(['PLACEMENT_OFFICER', 'ADMIN']);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const d = await placementOfficerService.getDashboard();
      setData(d);
    } catch (err: any) {
      setError(err.message || 'Failed to load outcomes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (allowed) load();
  }, [allowed]);

  if (!allowed) return <PageLoader message="Verifying access…" />;

  const opp = data?.opportunities || {};
  const placementRate = opp.placementRate ?? 0;

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Placement Outcomes"
        description="Final placement statistics and rate."
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Stat label="Placement Rate" value={`${placementRate}%`} icon={TrendingUp} color="bg-emerald-50 text-emerald-600" />
        <Stat label="Placements" value={opp.placements ?? '—'} icon={Award} color="bg-amber-50 text-amber-600" />
        <Stat label="Interviews" value={opp.interviews ?? '—'} icon={Users} color="bg-purple-50 text-purple-600" />
        <Stat label="Applications" value={opp.applications ?? '—'} icon={Briefcase} color="bg-blue-50 text-blue-600" />
      </div>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <PageLoader message="Loading outcomes…" />
          ) : (
            <PageEmptyState
              message={`${placementRate}% placement rate across ${opp.applications ?? 0} applications`}
              hint="Drill into the Analytics dashboard for trends over time."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, icon: Icon, color }: { label: string; value: any; icon: any; color: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-lpu-text-secondary">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
          </div>
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
