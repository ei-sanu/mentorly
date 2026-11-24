'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, RefreshCw, AlertCircle, CheckCircle2, X, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import { alumniOfficerService } from '@/services/api';
import { useRoleGuard } from '@/lib/use-role-guard';
import { PageHeader, PageLoader, PageEmptyState } from '@/components/dashboard/page-primitives';

interface VerificationRequest {
  id: string;
  status: string;
  createdAt: string;
  mentorProfileId?: any;
}

export default function AlumniMentorApplicationsPage() {
  const { allowed } = useRoleGuard(['ALUMNI_OFFICER', 'ADMIN']);
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await alumniOfficerService.getVerifications(page, limit, 'PENDING');
      const items = (res?.data || res?.items || res || []) as VerificationRequest[];
      setRequests(items);
      setTotal(res?.total ?? items.length);
    } catch (err: any) {
      setError(err.message || 'Failed to load applications.');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    if (allowed) load();
  }, [allowed, load]);

  if (!allowed) return <PageLoader message="Verifying access…" />;

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const handleApprove = async (id: string) => {
    try {
      setActionLoading(id);
      await alumniOfficerService.approveVerification(id);
      setRequests((prev) => prev.filter((r) => r.id !== id));
    } catch (err: any) {
      setError(err.message || 'Failed to approve.');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Mentor Applications"
        description="Pending mentor applications awaiting review."
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
          <CardTitle>Pending Applications</CardTitle>
          <CardDescription>{total} application{total === 1 ? '' : 's'} awaiting review</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <PageLoader message="Loading applications…" />
          ) : requests.length === 0 ? (
            <PageEmptyState message="No pending applications" hint="All caught up!" icon={CheckCircle2} />
          ) : (
            <>
              <div className="space-y-2">
                {requests.map((r) => (
                  <div key={r.id} className="flex items-center gap-4 p-4 border border-gray-100 rounded-2xl">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">Application #{r.id.slice(-6)}</p>
                      <p className="text-xs text-lpu-text-secondary">Submitted {new Date(r.createdAt).toLocaleString()}</p>
                    </div>
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => handleApprove(r.id)}
                      disabled={actionLoading === r.id}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve
                    </Button>
                    <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50">
                      Reject
                    </Button>
                  </div>
                ))}
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-xs text-lpu-text-secondary">Page {page} of {totalPages}</p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-xl">
                      <ChevronLeft className="h-4 w-4" /> Previous
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="rounded-xl">
                      Next <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
