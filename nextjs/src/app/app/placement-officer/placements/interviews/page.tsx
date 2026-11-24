'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, RefreshCw, AlertCircle, User, Briefcase, Clock } from 'lucide-react';
import { placementOfficerService } from '@/services/api';
import { useRoleGuard } from '@/lib/use-role-guard';
import { PageHeader, PageLoader, PageEmptyState } from '@/components/dashboard/page-primitives';

export default function PlacementInterviewsPage() {
  const { allowed } = useRoleGuard(['PLACEMENT_OFFICER', 'ADMIN']);
  const [data, setData] = useState<any>({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const limit = 20;

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await placementOfficerService.getApplications(page, limit);
      const items = (res?.data || res?.items || res || []).filter((a: any) => a.status === 'INTERVIEW_SCHEDULED');
      setData({ items, total: items.length });
    } catch (err: any) {
      setError(err.message || 'Failed to load interviews.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (allowed) load();
  }, [allowed, page]);

  if (!allowed) return <PageLoader message="Verifying access…" />;

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Scheduled Interviews"
        description="All interviews scheduled across the placement cycle."
        icon={Calendar}
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
          <CardTitle>Interviews</CardTitle>
          <CardDescription>{data.total} scheduled</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <PageLoader message="Loading interviews…" />
          ) : data.items.length === 0 ? (
            <PageEmptyState message="No interviews scheduled" hint="Schedule interviews from the applications page." icon={Clock} />
          ) : (
            <div className="space-y-2">
              {data.items.map((a: any, idx: number) => {
                const user = a.userId || a.student || {};
                const opp = a.opportunityId || a.opportunity || {};
                const name = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Student';
                return (
                  <div key={a._id || a.id || idx} className="flex items-center gap-3 p-3 border border-purple-200 bg-purple-50/30 rounded-xl">
                    <Calendar className="h-4 w-4 text-purple-600" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{name}</p>
                      <p className="text-xs text-lpu-text-secondary truncate flex items-center gap-1.5">
                        <Briefcase className="h-3 w-3" />
                        {opp.title || '—'}
                      </p>
                    </div>
                    <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                      INTERVIEW
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
