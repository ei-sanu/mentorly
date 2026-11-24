'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShieldAlert, ExternalLink, Eye, X, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { alumniOfficerService } from '@/services/api';
import { useRoleGuard } from '@/lib/use-role-guard';
import { PageHeader, PageLoader, PageEmptyState } from '@/components/dashboard/page-primitives';

interface VerificationRequest {
  id: string;
  status: string;
  createdAt: string;
  mentorProfileId?: { currentCompany?: string; currentDesignation?: string; programme?: string; graduationYear?: number; userId?: { firstName: string; lastName: string; email: string } };
}

export default function AlumniOfficerVerificationPage() {
  const { allowed } = useRoleGuard(['ALUMNI_OFFICER', 'ADMIN']);
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selected, setSelected] = useState<VerificationRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await alumniOfficerService.getVerifications(1, 50, 'PENDING');
      const items = (res?.data || res?.items || res || []) as VerificationRequest[];
      setRequests(items);
    } catch (err: any) {
      setError(err.message || 'Failed to load verifications.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (allowed) load();
  }, [allowed, load]);

  if (!allowed) return <PageLoader message="Verifying access…" />;

  const handleApprove = async (id: string) => {
    try {
      setActionLoading(id);
      await alumniOfficerService.approveVerification(id);
      setRequests((prev) => prev.filter((r) => r.id !== id));
      if (selected?.id === id) setSelected(null);
    } catch (err: any) {
      setError(err.message || 'Failed to approve.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!selected) return;
    if (!rejectReason.trim()) {
      setError('Rejection reason is required.');
      return;
    }
    try {
      setActionLoading(selected.id);
      await alumniOfficerService.rejectVerification(selected.id, rejectReason);
      setRequests((prev) => prev.filter((r) => r.id !== selected.id));
      setSelected(null);
      setRejectReason('');
    } catch (err: any) {
      setError(err.message || 'Failed to reject.');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Alumni Verification Queue"
        description="Review pending verifications from alumni mentors."
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

      <Card>
        <CardHeader>
          <CardTitle>Pending Verifications</CardTitle>
          <CardDescription>{requests.length} request{requests.length === 1 ? '' : 's'} awaiting your review</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <PageLoader message="Loading verifications…" />
          ) : requests.length === 0 ? (
            <PageEmptyState message="All caught up!" hint="No pending verifications at the moment." icon={CheckCircle2} />
          ) : (
            <div className="space-y-2">
              {requests.map((r) => {
                const mp = (r as any).mentorProfileId;
                const user = mp?.userId;
                const name = user ? `${user.firstName} ${user.lastName}` : 'Alumni';
                return (
                  <div
                    key={r.id}
                    onClick={() => setSelected(r)}
                    className="flex items-center gap-4 p-4 border border-gray-100 rounded-2xl cursor-pointer hover:bg-gray-50/50 transition-colors"
                  >
                    <div className="h-10 w-10 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-900 font-bold">
                      {name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold">{name}</h3>
                      <p className="text-xs text-lpu-text-secondary truncate">
                        {mp?.currentDesignation || '—'} at {mp?.currentCompany || '—'} • {mp?.programme || '—'}
                      </p>
                      <p className="text-xs text-lpu-text-muted mt-0.5">
                        Submitted {new Date(r.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Pending</Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-bold">Review Verification</h2>
              <button onClick={() => setSelected(null)} className="p-1 hover:bg-gray-100 rounded-full">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {(() => {
                const mp = (selected as any).mentorProfileId;
                const user = mp?.userId;
                return (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-lpu-text-secondary">Name</span><span className="font-medium">{user?.firstName} {user?.lastName}</span></div>
                    <div className="flex justify-between"><span className="text-lpu-text-secondary">Email</span><span className="font-medium">{user?.email}</span></div>
                    <div className="flex justify-between"><span className="text-lpu-text-secondary">Programme</span><span className="font-medium">{mp?.programme || '—'}</span></div>
                    <div className="flex justify-between"><span className="text-lpu-text-secondary">Graduation</span><span className="font-medium">{mp?.graduationYear || '—'}</span></div>
                    <div className="flex justify-between"><span className="text-lpu-text-secondary">Current Role</span><span className="font-medium">{mp?.currentDesignation || '—'}</span></div>
                    <div className="flex justify-between"><span className="text-lpu-text-secondary">Company</span><span className="font-medium">{mp?.currentCompany || '—'}</span></div>
                  </div>
                );
              })()}
              <div className="space-y-2">
                <label className="text-sm font-medium">Rejection reason (required to reject)</label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  placeholder="e.g. Unable to verify graduation year from provided documents."
                  className="w-full px-4 py-3 rounded-xl border border-lpu-border text-sm focus:ring-2 focus:ring-neutral-900 focus:outline-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => handleApprove(selected.id)}
                  disabled={actionLoading === selected.id}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" /> Approve
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                  onClick={handleReject}
                  disabled={actionLoading === selected.id}
                >
                  Reject
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
