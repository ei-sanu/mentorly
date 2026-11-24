'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ClipboardList, RefreshCw, AlertCircle, Search, User, Activity, ShieldCheck } from 'lucide-react';
import { adminService } from '@/services/api';
import { useRoleGuard } from '@/lib/use-role-guard';
import { PageHeader, PageLoader, PageEmptyState } from '@/components/dashboard/page-primitives';

const ACTION_COLORS: Record<string, string> = {
  SEND_REQUEST: 'bg-blue-50 text-blue-600',
  ACCEPT_REQUEST: 'bg-emerald-50 text-emerald-600',
  DECLINE_REQUEST: 'bg-red-50 text-red-600',
  CANCEL_REQUEST: 'bg-amber-50 text-amber-600',
  CREATE_USER: 'bg-indigo-50 text-indigo-600',
  UPDATE_USER: 'bg-indigo-50 text-indigo-600',
  APPROVE_VERIFICATION: 'bg-emerald-50 text-emerald-600',
  REJECT_VERIFICATION: 'bg-red-50 text-red-600',
};

export default function AdminAuditLogsPage() {
  const { allowed } = useRoleGuard(['ADMIN']);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(100);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminService.getAuditLogs(limit);
      setLogs(Array.isArray(data) ? data : data?.logs || data?.items || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load audit logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (allowed) load();
  }, [allowed, limit]);

  if (!allowed) return <PageLoader message="Verifying access…" />;

  const filtered = logs.filter((l) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (l.action || '').toLowerCase().includes(q) ||
      (l.entityType || l.resource || '').toLowerCase().includes(q) ||
      (l.userId || l.actorId || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Audit Logs"
        description="A complete record of administrative actions across the platform."
        icon={ClipboardList}
        actions={
          <>
            <select
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value, 10))}
              className="h-9 px-3 rounded-xl border border-lpu-border text-sm focus:ring-2 focus:ring-neutral-900 focus:outline-none"
            >
              <option value={50}>Last 50</option>
              <option value={100}>Last 100</option>
              <option value={250}>Last 250</option>
              <option value={500}>Last 500</option>
            </select>
            <Button variant="outline" onClick={load} size="sm" className="rounded-xl">
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>
          </>
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
        <CardHeader className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0">
          <div>
            <CardTitle>Event Stream</CardTitle>
            <CardDescription>Showing {filtered.length} of {logs.length} entries</CardDescription>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-lpu-text-muted" />
            <Input
              placeholder="Search by action, entity, user…"
              className="pl-9 w-full sm:w-64"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <PageLoader message="Loading audit logs…" />
          ) : filtered.length === 0 ? (
            <PageEmptyState
              message={search ? 'No matching entries' : 'No audit entries yet'}
              hint={search ? 'Try a different search term.' : 'Activity will appear here as it happens.'}
            />
          ) : (
            <div className="rounded-2xl border border-lpu-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-lpu-bg text-lpu-text-secondary border-b border-lpu-border">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Action</th>
                      <th className="px-4 py-3 text-left font-medium">Entity</th>
                      <th className="px-4 py-3 text-left font-medium">Actor</th>
                      <th className="px-4 py-3 text-left font-medium">When</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-lpu-border">
                    {filtered.map((log: any, idx: number) => {
                      const color = ACTION_COLORS[log.action] || 'bg-gray-50 text-gray-600';
                      return (
                        <tr key={log.id || idx} className="hover:bg-gray-50/50">
                          <td className="px-4 py-3">
                            <Badge variant="outline" className={`${color} border-0`}>
                              {log.action || '—'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-lpu-text-secondary">
                            {log.entityType || log.resource || '—'}
                            {log.entityId || log.resourceId ? (
                              <span className="ml-1 text-lpu-text-muted">#{String(log.entityId || log.resourceId).slice(-6)}</span>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 text-lpu-text-secondary">
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              <span className="font-mono text-xs">{log.userId || log.actorId || '—'}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-lpu-text-secondary">
                            {log.createdAt ? new Date(log.createdAt).toLocaleString() : '—'}
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
