'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, RefreshCw, AlertCircle, Building2, Calendar } from 'lucide-react';
import { placementOfficerService } from '@/services/api';
import { useRoleGuard } from '@/lib/use-role-guard';
import { PageHeader, PageLoader, PageEmptyState } from '@/components/dashboard/page-primitives';

export default function PlacementUpcomingOpportunitiesPage() {
  const { allowed } = useRoleGuard(['PLACEMENT_OFFICER', 'ADMIN']);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await placementOfficerService.getOpportunities(1, 50, 'UPCOMING');
      setItems(res?.data || res?.items || res || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load upcoming opportunities.');
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
        title="Upcoming Opportunities"
        description="Opportunities that will open for applications soon."
        icon={Clock}
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

      {loading ? (
        <PageLoader message="Loading…" />
      ) : items.length === 0 ? (
        <PageEmptyState message="No upcoming opportunities" hint="Schedule new opportunities to populate this list." icon={Clock} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((o: any) => (
            <Card key={o._id || o.id}>
              <CardContent className="pt-6 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-lg">{o.title || 'Untitled'}</h3>
                    <p className="text-sm text-lpu-text-secondary flex items-center gap-1.5 mt-1">
                      <Building2 className="h-3.5 w-3.5" />
                      {o.company || '—'}
                    </p>
                  </div>
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">UPCOMING</Badge>
                </div>
                <p className="text-sm text-lpu-text-secondary line-clamp-2">{o.description || ''}</p>
                <div className="flex items-center gap-3 text-xs text-lpu-text-muted pt-2 border-t">
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />Opens {o.openingDate ? new Date(o.openingDate).toLocaleDateString() : '—'}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
