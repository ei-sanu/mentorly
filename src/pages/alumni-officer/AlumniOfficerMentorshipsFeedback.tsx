'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageSquare, RefreshCw, AlertCircle, Star } from 'lucide-react';
import { alumniOfficerService } from '@/services/api';
import { useRoleGuard } from '@/lib/use-role-guard';
import { PageHeader, PageLoader, PageEmptyState } from '@/components/dashboard/page-primitives';

export default function AlumniMentorshipFeedbackPage() {
  const { allowed } = useRoleGuard(['ALUMNI_OFFICER', 'ADMIN']);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const d = await alumniOfficerService.getDashboard();
      setData(d);
    } catch (err: any) {
      setError(err.message || 'Failed to load feedback.');
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
        title="Mentorship Feedback"
        description="Platform-wide satisfaction signals from completed mentorships."
        icon={MessageSquare}
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
        <CardContent className="pt-6">
          {loading ? (
            <PageLoader message="Loading feedback…" />
          ) : (
            <div className="text-center py-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50 border border-amber-200 mb-3">
                <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                <span className="text-2xl font-bold text-amber-700">{data?.averageSatisfaction ?? '—'}</span>
                <span className="text-sm text-lpu-text-secondary">/ 5.0</span>
              </div>
              <p className="text-sm text-lpu-text-secondary mt-2">Average satisfaction across the alumni mentorship network</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
