'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Activity, RefreshCw, AlertCircle, TrendingUp, Users, Star } from 'lucide-react';
import { adminService } from '@/services/api';
import { useRoleGuard } from '@/lib/use-role-guard';
import { PageHeader, PageLoader, PageEmptyState } from '@/components/dashboard/page-primitives';

export default function AlumniMentorPerformancePage() {
  const { allowed } = useRoleGuard(['ALUMNI_OFFICER', 'ADMIN']);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const d = await adminService.getMentorUtilization();
      setData(d);
    } catch (err: any) {
      setError(err.message || 'Failed to load performance metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (allowed) load();
  }, [allowed]);

  if (!allowed) return <PageLoader message="Verifying access…" />;

  const mentors = data?.mentors || [];
  const overall = data?.overallPercentage ?? 0;

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Mentor Performance"
        description="Capacity utilization and engagement across the mentor network."
        icon={Activity}
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
        <Stat label="Overall Utilization" value={`${overall}%`} icon={TrendingUp} color="bg-emerald-50 text-emerald-600" />
        <Stat label="Active Mentors" value={mentors.length} icon={Users} color="bg-blue-50 text-blue-600" />
        <Stat label="High Performers" value={mentors.filter((m: any) => m.percentage >= 80).length} icon={Star} color="bg-amber-50 text-amber-600" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Capacity by Mentor</CardTitle>
          <CardDescription>Current mentees / max capacity</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <PageLoader message="Loading performance data…" />
          ) : mentors.length === 0 ? (
            <PageEmptyState message="No performance data" hint="Verified mentors will appear here." icon={Activity} />
          ) : (
            <div className="space-y-2">
              {mentors.map((m: any) => (
                <div key={m.id} className="p-3 border border-gray-100 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">{m.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-lpu-text-secondary font-mono">
                        {m.current} / {m.max}
                      </span>
                      <Badge variant="outline" className={
                        m.percentage >= 90 ? 'bg-red-50 text-red-700 border-red-200' :
                        m.percentage >= 60 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }>
                        {m.percentage}%
                      </Badge>
                    </div>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        m.percentage >= 90 ? 'bg-red-500' :
                        m.percentage >= 60 ? 'bg-amber-500' :
                        'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, m.percentage)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
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
