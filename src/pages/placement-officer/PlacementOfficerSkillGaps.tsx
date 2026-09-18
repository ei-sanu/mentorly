'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldAlert, RefreshCw, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { placementOfficerService } from '@/services/api';
import { useRoleGuard } from '@/lib/use-role-guard';
import { PageHeader, PageLoader, PageEmptyState } from '@/components/dashboard/page-primitives';

export default function PlacementSkillGapsPage() {
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
      setError(err.message || 'Failed to load skill gap data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (allowed) load();
  }, [allowed]);

  if (!allowed) return <PageLoader message="Verifying access…" />;

  const skillGaps = data?.skillGaps || [];
  const topSkills = data?.topSkills || [];

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Skill Gap Analysis"
        description="Identify which critical skills are missing across the student body."
        icon={ShieldAlert}
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

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Critical Skill Gaps</CardTitle>
            <CardDescription>Students targeting Software Engineer roles missing key skills</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <PageLoader message="Loading…" />
            ) : skillGaps.length === 0 ? (
              <PageEmptyState message="No skill gap data" hint="Tag students with target roles to see gaps." />
            ) : (
              <div className="space-y-3">
                {skillGaps.map((g: any) => (
                  <div key={g.skill} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{g.skill}</span>
                      <span className="text-xs text-lpu-text-secondary">
                        <span className="text-emerald-600 font-semibold">{g.availableCount}</span> have •{' '}
                        <span className="text-red-600 font-semibold">{g.missingCount}</span> missing
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden flex">
                      <div className="bg-emerald-500 h-full" style={{ width: `${(g.availableCount / Math.max(1, g.availableCount + g.missingCount)) * 100}%` }} />
                      <div className="bg-red-400 h-full flex-1" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Student Skills</CardTitle>
            <CardDescription>Most common skills across all student profiles</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <PageLoader message="Loading…" />
            ) : topSkills.length === 0 ? (
              <PageEmptyState message="No skill data" />
            ) : (
              <div className="space-y-2">
                {topSkills.slice(0, 12).map((s: any) => (
                  <div key={s.skill} className="flex items-center justify-between p-2 border border-gray-100 rounded-lg">
                    <span className="text-sm font-medium">{s.skill}</span>
                    <span className="text-xs text-lpu-text-secondary font-mono">{s.count} students</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
