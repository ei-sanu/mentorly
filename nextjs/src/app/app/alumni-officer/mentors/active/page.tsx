'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { UserCheck, Search, RefreshCw, AlertCircle, ChevronLeft, ChevronRight, Mail, Briefcase } from 'lucide-react';
import { alumniOfficerService } from '@/services/api';
import { useRoleGuard } from '@/lib/use-role-guard';
import { PageHeader, PageLoader, PageEmptyState } from '@/components/dashboard/page-primitives';

export default function AlumniActiveMentorsPage() {
  const { allowed } = useRoleGuard(['ALUMNI_OFFICER', 'ADMIN']);
  const [data, setData] = useState<any>({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const limit = 20;

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await alumniOfficerService.getMentors(page, limit, search);
      setData({
        items: res?.data || res?.items || res || [],
        total: res?.total ?? (res?.data || res || []).length,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load mentors.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (allowed) load();
  }, [allowed, page]);

  if (!allowed) return <PageLoader message="Verifying access…" />;

  const totalPages = Math.max(1, Math.ceil(data.total / limit));
  const items = data.items;

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Active Mentors"
        description="Currently active alumni mentors available to take on mentees."
        icon={UserCheck}
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
        <CardHeader className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0">
          <div>
            <CardTitle>Verified Mentors</CardTitle>
            <CardDescription>{data.total} mentor{data.total === 1 ? '' : 's'} available</CardDescription>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); setPage(1); load(); }} className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-lpu-text-muted" />
            <Input
              placeholder="Search by name, company, industry…"
              className="pl-9 w-full sm:w-80"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </form>
        </CardHeader>
        <CardContent>
          {loading ? (
            <PageLoader message="Loading mentors…" />
          ) : items.length === 0 ? (
            <PageEmptyState message="No active mentors" hint="Try clearing your search." icon={UserCheck} />
          ) : (
            <>
              <div className="rounded-2xl border border-lpu-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-lpu-bg text-lpu-text-secondary border-b border-lpu-border">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">Name</th>
                        <th className="px-4 py-3 text-left font-medium">Role & Company</th>
                        <th className="px-4 py-3 text-left font-medium">Industry</th>
                        <th className="px-4 py-3 text-left font-medium">Capacity</th>
                        <th className="px-4 py-3 text-left font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-lpu-border">
                      {items.map((m: any) => {
                        const user = m.userId || m.user || {};
                        const name = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Alumni';
                        return (
                          <tr key={m._id || m.id} className="hover:bg-gray-50/50">
                            <td className="px-4 py-3 font-medium">
                              <div className="flex items-center gap-2">
                                <div className="h-8 w-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-700 font-bold text-xs">
                                  {name.charAt(0)}
                                </div>
                                <div>
                                  <div>{name}</div>
                                  <div className="text-xs text-lpu-text-muted flex items-center gap-1">
                                    <Mail className="h-3 w-3" />{user.email || '—'}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-lpu-text-secondary">
                              <div className="flex items-center gap-1.5">
                                <Briefcase className="h-3.5 w-3.5" />
                                {m.currentDesignation || '—'} <span className="text-lpu-text-muted">@</span> {m.currentCompany || '—'}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-lpu-text-secondary">{m.industry || '—'}</td>
                            <td className="px-4 py-3">
                              <span className="font-mono text-xs">
                                {m.currentMenteesCount ?? 0} / {m.maxCapacity ?? 3}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant="outline" className={
                                m.acceptingMentees
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-gray-50 text-gray-700 border-gray-200'
                              }>
                                {m.acceptingMentees ? 'Accepting' : 'Paused'}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
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
