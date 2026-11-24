'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckSquare, RefreshCw, AlertCircle, TrendingUp, Users, Target } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { placementOfficerService } from '@/services/api';
import { useRoleGuard } from '@/lib/use-role-guard';
import { PageHeader, PageLoader, PageEmptyState } from '@/components/dashboard/page-primitives';

const COLORS: Record<string, string> = {
  'Ready': '#10b981',
  'Almost Ready': '#3b82f6',
  'Needs Improvement': '#f59e0b',
  'Not Started': '#ef4444',
};

export default function PlacementReadinessPage() {
  const { allowed } = useRoleGuard(['PLACEMENT_OFFICER', 'ADMIN']);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const d = await placementOfficerService.getDashboard();
      setData(d);
    } catch (err: any) {
      setError(err.message || 'Failed to load readiness data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (allowed) load();
  }, [allowed]);

  if (!allowed) return <PageLoader message="Verifying access…" />;

  const readiness = data?.careerReadiness || {};
  const chartData = Object.entries(readiness).map(([k, v]) => ({ name: k, count: v }));
  const ready = readiness['Ready'] || 0;
  const almost = readiness['Almost Ready'] || 0;
  const needs = readiness['Needs Improvement'] || 0;
  const none = readiness['Not Started'] || 0;
  const total = ready + almost + needs + none;
  const readyPct = total > 0 ? Math.round((ready / total) * 100) : 0;

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Career Readiness"
        description="How prepared students are for the placement cycle."
        icon={CheckSquare}
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

      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Ready" value={ready} color={COLORS['Ready']} />
        <Stat label="Almost Ready" value={almost} color={COLORS['Almost Ready']} />
        <Stat label="Needs Improvement" value={needs} color={COLORS['Needs Improvement']} />
        <Stat label="Not Started" value={none} color={COLORS['Not Started']} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Readiness Distribution</CardTitle>
          <CardDescription>{readyPct}% of students are placement-ready</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <PageLoader message="Loading…" />
          ) : total === 0 ? (
            <PageEmptyState message="No readiness data yet" />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" stroke="#888" fontSize={11} />
                <YAxis stroke="#888" fontSize={11} />
                <Tooltip />
                <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                  {chartData.map((d, i) => (
                    <Cell key={i} fill={COLORS[d.name] || '#888'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: any; color: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-lpu-text-secondary">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
          </div>
          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
        </div>
      </CardContent>
    </Card>
  );
}
