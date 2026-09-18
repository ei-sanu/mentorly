'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, RefreshCw, AlertCircle, User, Briefcase } from 'lucide-react';
import { placementOfficerService } from '@/services/api';
import { useRoleGuard } from '@/lib/use-role-guard';
import { PageHeader, PageLoader, PageEmptyState } from '@/components/dashboard/page-primitives';

const STATUS_COLORS: Record<string, string> = {
  APPLIED: 'bg-blue-50 text-blue-700 border-blue-200',
  UNDER_REVIEW: 'bg-amber-50 text-amber-700 border-amber-200',
  INTERVIEW_SCHEDULED: 'bg-purple-50 text-purple-700 border-purple-200',
  OFFERED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
  PLACED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  WITHDRAWN: 'bg-gray-50 text-gray-700 border-gray-200',
};

export default function PlacementApplicationsPage() {
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
      setData({
        items: res?.data || res?.items || res || [],
        total: res?.total ?? (res?.data || res || []).length,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load applications.');
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
        title="Placements — Applications"
        description="Manage the full applications pipeline for the placement cycle."
        icon={FileText}
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
          <CardTitle>All Applications</CardTitle>
          <CardDescription>{data.total} total</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <PageLoader message="Loading…" />
          ) : data.items.length === 0 ? (
            <PageEmptyState message="No applications" />
          ) : (
            <div className="space-y-2">
              {data.items.map((a: any, idx: number) => {
                const user = a.userId || a.student || {};
                const opp = a.opportunityId || a.opportunity || {};
                const name = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Student';
                return (
                  <div key={a._id || a.id || idx} className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl">
                    <User className="h-4 w-4 text-lpu-text-muted" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{name}</p>
                      <p className="text-xs text-lpu-text-secondary truncate flex items-center gap-1.5">
                        <Briefcase className="h-3 w-3" />
                        {opp.title || '—'}
                      </p>
                    </div>
                    <Badge variant="outline" className={STATUS_COLORS[a.status] || 'bg-gray-50'}>
                      {a.status || 'APPLIED'}
                    </Badge>
                    <span className="text-xs text-lpu-text-muted">
                      {a.createdAt ? new Date(a.createdAt).toLocaleDateString() : ''}
                    </span>
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
