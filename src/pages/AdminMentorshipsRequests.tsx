'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Briefcase, Clock, CheckCircle2, Sparkles, AlertCircle, RefreshCw, Inbox, User } from 'lucide-react';
import { adminService } from '@/services/api';
import { useRoleGuard } from '@/lib/use-role-guard';
import { PageHeader, PageLoader, PageEmptyState, SectionCard } from '@/components/dashboard/page-primitives';

type Status = 'PENDING' | 'ACCEPTED' | 'COMPLETED' | 'CANCELLED' | 'DECLINED' | 'EXPIRED' | 'AT_RISK' | 'PAUSED' | 'INACTIVE' | 'ACTIVE';

interface RequestItem {
  id: string;
  studentId?: string;
  mentorId?: string;
  status: string;
  goal?: string;
  message?: string;
  createdAt?: string;
  student?: { firstName: string; lastName: string; email: string };
  mentor?: { currentCompany?: string; currentDesignation?: string; user?: { firstName: string; lastName: string } };
}

export default function AdminMentorshipsRequestsPage() {
  const { allowed } = useRoleGuard(['ADMIN']);
  const [items, setItems] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminService.getMentorshipOverview();
      setItems(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load mentorship overview.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (allowed) load();
  }, [allowed]);

  if (!allowed) return <PageLoader message="Verifying access…" />;

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Mentorship Requests"
        description="Monitor incoming mentorship requests across the platform."
        icon={Briefcase}
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatTile icon={Briefcase} label="Total Requests" value={items?.total ?? '—'} color="bg-blue-50 text-blue-600" />
        <StatTile icon={Clock} label="Pending" value={items?.pendingRequests ?? '—'} color="bg-amber-50 text-amber-600" />
        <StatTile icon={CheckCircle2} label="Active" value={items?.active ?? '—'} color="bg-emerald-50 text-emerald-600" />
        <StatTile icon={Sparkles} label="Completed" value={items?.completed ?? '—'} color="bg-purple-50 text-purple-600" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Request Pipeline</CardTitle>
          <CardDescription>Snapshot of the mentorship funnel — full table view is available on the Analytics page.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <PageLoader message="Loading overview…" />
          ) : (
            <PageEmptyState
              message="Detailed request list coming soon"
              hint="The mentorship overview is aggregated above. For request-level details, use the Analytics dashboard."
              icon={Inbox}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatTile({ icon: Icon, label, value, color }: { icon: any; label: string; value: any; color: string }) {
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
