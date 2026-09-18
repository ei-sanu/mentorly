'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckSquare, RefreshCw, AlertCircle, Users, TrendingUp } from 'lucide-react';
import { mentorService, mentorshipService } from '@/services/api';
import { useRoleGuard } from '@/lib/use-role-guard';
import { PageHeader, PageLoader, PageEmptyState } from '@/components/dashboard/page-primitives';

export default function MentorCapacityPage() {
  const { allowed } = useRoleGuard(['MENTOR']);
  const [profile, setProfile] = useState<any>(null);
  const [mentees, setMentees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const [me, active] = await Promise.all([
        mentorService.getMyProfile(),
        mentorshipService.getActiveMentorships(),
      ]);
      setProfile(me);
      setMentees(active || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load capacity data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (allowed) load();
  }, [allowed]);

  if (!allowed) return <PageLoader message="Verifying access…" />;

  const max = profile?.maxCapacity ?? 3;
  const current = mentees.length;
  const pct = max > 0 ? Math.round((current / max) * 100) : 0;
  const remaining = Math.max(0, max - current);

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Mentee Capacity"
        description="Track how many mentees you can take and your current load."
        icon={CheckSquare}
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
        <Stat label="Current Mentees" value={current} icon={Users} color="bg-blue-50 text-blue-600" />
        <Stat label="Max Capacity" value={max} icon={CheckSquare} color="bg-purple-50 text-purple-600" />
        <Stat label="Remaining Slots" value={remaining} icon={TrendingUp} color="bg-emerald-50 text-emerald-600" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Utilization</CardTitle>
          <CardDescription>{pct}% of your capacity is in use</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <PageLoader message="Loading…" />
          ) : (
            <div className="space-y-3">
              <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    pct >= 90 ? 'bg-red-500' : pct >= 60 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-lpu-text-secondary">
                  {current} of {max} slots used
                </span>
                <Badge variant="outline" className={
                  pct >= 90 ? 'bg-red-50 text-red-700 border-red-200' :
                  pct >= 60 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                  'bg-emerald-50 text-emerald-700 border-emerald-200'
                }>
                  {pct >= 90 ? 'Near capacity' : pct >= 60 ? 'Healthy load' : 'Open for mentees'}
                </Badge>
              </div>
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
