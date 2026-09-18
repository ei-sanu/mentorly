'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Briefcase, RefreshCw, AlertCircle, Building2, MapPin, Calendar, PlusCircle, X, CheckCircle2 } from 'lucide-react';
import { placementOfficerService } from '@/services/api';
import { useRoleGuard } from '@/lib/use-role-guard';
import { PageHeader, PageLoader, PageEmptyState } from '@/components/dashboard/page-primitives';

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  UPCOMING: 'bg-blue-50 text-blue-700 border-blue-200',
  CLOSED: 'bg-gray-50 text-gray-700 border-gray-200',
};

interface FormState {
  title: string;
  company: string;
  description: string;
  location: string;
  type: 'FULL_TIME' | 'PART_TIME' | 'INTERNSHIP';
  salaryRange: string;
}

const EMPTY_FORM: FormState = {
  title: '',
  company: '',
  description: '',
  location: '',
  type: 'FULL_TIME',
  salaryRange: '',
};

export default function PlacementActiveOpportunitiesPage() {
  const { allowed } = useRoleGuard(['PLACEMENT_OFFICER', 'ADMIN']);
  const [data, setData] = useState<any>({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page] = useState(1);
  const limit = 20;

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string } | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await placementOfficerService.getOpportunities(page, limit, 'ACTIVE');
      setData({
        items: res?.data || res?.items || res || [],
        total: res?.total ?? (res?.data || res || []).length,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load opportunities.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (allowed) load();
  }, [allowed, page]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowCreate(true);
  };

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.company.trim()) {
      setFormError('Title and company are required.');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await placementOfficerService.createOpportunity({
        ...form,
        status: 'ACTIVE',
      });
      setShowCreate(false);
      setToast({ message: `Posted "${form.title}" at ${form.company}.` });
      await load();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create opportunity.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!allowed) return <PageLoader message="Verifying access…" />;

  const items = data.items;

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Active Opportunities"
        description="Open positions currently accepting applications."
        icon={Briefcase}
        actions={
          <>
            <Button onClick={openCreate} size="sm" className="rounded-xl">
              <PlusCircle className="h-4 w-4 mr-2" /> Post Opportunity
            </Button>
            <Button variant="outline" onClick={load} size="sm" className="rounded-xl">
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>
          </>
        }
      />

      {toast && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" /> {toast.message}
        </div>
      )}

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

      {loading ? (
        <PageLoader message="Loading opportunities…" />
      ) : items.length === 0 ? (
        <PageEmptyState message="No active opportunities" hint="Post a new opportunity to get started." icon={Briefcase} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((o: any) => (
            <Card key={o._id || o.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-lg">{o.title || 'Untitled'}</h3>
                    <p className="text-sm text-lpu-text-secondary flex items-center gap-1.5 mt-1">
                      <Building2 className="h-3.5 w-3.5" />
                      {o.company || '—'}
                    </p>
                  </div>
                  <Badge variant="outline" className={STATUS_COLORS[o.status] || 'bg-gray-50 text-gray-700'}>
                    {o.status}
                  </Badge>
                </div>
                <p className="text-sm text-lpu-text-secondary line-clamp-2">{o.description || ''}</p>
                <div className="flex items-center gap-3 text-xs text-lpu-text-muted pt-2 border-t">
                  <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{o.location || '—'}</span>
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{o.type || '—'}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => !submitting && setShowCreate(false)}>
          <Card className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Post a new opportunity</CardTitle>
                <CardDescription>Visible to all students immediately.</CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowCreate(false)} disabled={submitting} className="h-8 w-8 rounded-full">
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <form onSubmit={submitCreate} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Job title <span className="text-red-500">*</span></label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Software Engineer Intern" required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Company <span className="text-red-500">*</span></label>
                  <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="e.g. Microsoft" required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={3}
                    placeholder="Role responsibilities, requirements, perks…"
                    className="w-full rounded-xl border border-lpu-border bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-lpu-orange focus:outline-none resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Location</label>
                    <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Bangalore" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Type</label>
                    <select
                      value={form.type}
                      onChange={(e) => setForm({ ...form, type: e.target.value as FormState['type'] })}
                      className="h-10 w-full rounded-xl border border-lpu-border bg-white px-3 text-sm focus:ring-2 focus:ring-lpu-orange focus:outline-none"
                    >
                      <option value="FULL_TIME">Full-time</option>
                      <option value="PART_TIME">Part-time</option>
                      <option value="INTERNSHIP">Internship</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Salary range (optional)</label>
                  <Input value={form.salaryRange} onChange={(e) => setForm({ ...form, salaryRange: e.target.value })} placeholder="e.g. ₹8-12 LPA" />
                </div>
                {formError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {formError}
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setShowCreate(false)} disabled={submitting} className="rounded-xl">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting} className="rounded-xl">
                    {submitting ? 'Posting…' : 'Post Opportunity'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
