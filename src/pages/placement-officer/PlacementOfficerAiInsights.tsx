'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, RefreshCw, AlertCircle, TrendingUp, Target, Building2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { adminService, placementOfficerService } from '@/services/api';
import { useRoleGuard } from '@/lib/use-role-guard';
import { PageHeader, PageLoader, PageEmptyState } from '@/components/dashboard/page-primitives';

const COLORS = ['#f97316', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#f59e0b', '#06b6d4', '#84cc16'];

export default function PlacementAIInsightsPage() {
  const { allowed } = useRoleGuard(['PLACEMENT_OFFICER', 'ADMIN']);
  const [matching, setMatching] = useState<any>(null);
  const [topSkills, setTopSkills] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const [m, s] = await Promise.all([
        adminService.getMatchingOverview(),
        adminService.getTopSkills(),
      ]);
      setMatching(m);
      setTopSkills(s);
    } catch (err: any) {
      setError(err.message || 'Failed to load AI insights.');
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
        title="AI Insights"
        description="AI-driven matching and skill gap intelligence for placements."
        icon={Sparkles}
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

      <div className="grid gap-4 md:grid-cols-3">
        <Stat label="Avg Match Score" value={matching?.averageMatchScore ? `${matching.averageMatchScore}/100` : '—'} icon={Target} color="bg-orange-50 text-orange-600" />
        <Stat label="Recommendations" value={matching?.totalRecommendationsGenerated ?? '—'} icon={Sparkles} color="bg-purple-50 text-purple-600" />
        <Stat label="Successful Matches" value={matching?.successfulMatches ?? '—'} icon={TrendingUp} color="bg-emerald-50 text-emerald-600" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top Matching Skills</CardTitle>
            <CardDescription>Skills most frequently aligned</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <PageLoader message="Loading…" />
            ) : topSkills?.matchedSkills?.length ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topSkills.matchedSkills.slice(0, 8)} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" stroke="#888" fontSize={11} />
                  <YAxis dataKey="skill" type="category" stroke="#888" fontSize={11} width={100} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[0, 8, 8, 0]}>
                    {topSkills.matchedSkills.slice(0, 8).map((_: any, idx: number) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <PageEmptyState message="No skill data" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Industries</CardTitle>
            <CardDescription>Industries with most successful matches</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <PageLoader message="Loading…" />
            ) : matching?.topMatchingIndustries?.length ? (
              <div className="space-y-2">
                {matching.topMatchingIndustries.map((industry: string, idx: number) => (
                  <div key={industry} className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl">
                    <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${COLORS[idx % COLORS.length]}20`, color: COLORS[idx % COLORS.length] }}>
                      <Building2 className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-medium">{industry}</span>
                  </div>
                ))}
              </div>
            ) : (
              <PageEmptyState message="No industry data" />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value, icon: Icon, color }: { label: string; value: any; icon: any; color: string }) {
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
