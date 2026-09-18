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

export default function PlacementOpportunityApplicationsPage() {
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

  const items = data.items;

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Opportunity Applications"
        description="All student applications to posted opportunities."
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
          <CardTitle>Applications</CardTitle>
          <CardDescription>{data.total} total</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <PageLoader message="Loading applications…" />
          ) : items.length === 0 ? (
            <PageEmptyState message="No applications yet" />
          ) : (
            <div className="rounded-2xl border border-lpu-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-lpu-bg text-lpu-text-secondary border-b border-lpu-border">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Student</th>
                      <th className="px-4 py-3 text-left font-medium">Opportunity</th>
                      <th className="px-4 py-3 text-left font-medium">Status</th>
                      <th className="px-4 py-3 text-left font-medium">Applied</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-lpu-border">
                    {items.map((a: any, idx: number) => {
                      const user = a.userId || a.student || {};
                      const opp = a.opportunityId || a.opportunity || {};
                      const name = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Student';
                      return (
                        <tr key={a._id || a.id || idx} className="hover:bg-gray-50/50">
                          <td className="px-4 py-3 font-medium">
                            <div className="flex items-center gap-2">
                              <User className="h-3.5 w-3.5 text-lpu-text-muted" />
                              {name}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-lpu-text-secondary">
                            <div className="flex items-center gap-1.5">
                              <Briefcase className="h-3.5 w-3.5" />
                              {opp.title || '—'}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className={STATUS_COLORS[a.status] || 'bg-gray-50'}>
                              {a.status || 'APPLIED'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-lpu-text-secondary text-xs">
                            {a.createdAt ? new Date(a.createdAt).toLocaleDateString() : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
