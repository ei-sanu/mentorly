'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Target, RefreshCw, AlertCircle, TrendingUp, Activity, Sparkles, Building2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { adminService } from '@/services/api';
import { useRoleGuard } from '@/lib/use-role-guard';
import { PageHeader, PageLoader, PageEmptyState } from '@/components/dashboard/page-primitives';

const COLORS = ['#f97316', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#f59e0b', '#06b6d4', '#84cc16'];

export default function AdminMatchingOverviewPage() {
  const { allowed } = useRoleGuard(['ADMIN']);
  const [data, setData] = useState<any>(null);
  const [topSkills, setTopSkills] = useState<any>(null);
  const [topIndustries, setTopIndustries] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const [overview, skills, industries] = await Promise.all([
        adminService.getMatchingOverview(),
        adminService.getTopSkills(),
        adminService.getTopIndustries(),
      ]);
      setData(overview);
      setTopSkills(skills);
      setTopIndustries(industries);
    } catch (err: any) {
      setError(err.message || 'Failed to load matching overview.');
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
        title="AI Matching Overview"
        description="Platform-wide health of the mentor–mentee matching engine."
        icon={Target}
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
        <Stat label="Avg Match Score" value={data?.averageMatchScore ? `${data.averageMatchScore}/100` : '—'} icon={Sparkles} color="bg-orange-50 text-orange-600" />
        <Stat label="Recommendations Generated" value={data?.totalRecommendationsGenerated ?? '—'} icon={Activity} color="bg-blue-50 text-blue-600" />
        <Stat label="Successful Matches" value={data?.successfulMatches ?? '—'} icon={TrendingUp} color="bg-emerald-50 text-emerald-600" />
        <Stat label="Active Requests" value={data?.activeRecommendations ?? '—'} icon={Target} color="bg-purple-50 text-purple-600" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top Matching Skills</CardTitle>
            <CardDescription>Skills most frequently aligned in successful matches.</CardDescription>
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
              <PageEmptyState message="No skill data yet" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Industries</CardTitle>
            <CardDescription>Industries most represented across successful matches.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <PageLoader message="Loading…" />
            ) : topIndustries?.successfulIndustries?.length ? (
              <div className="space-y-2">
                {topIndustries.successfulIndustries.slice(0, 8).map((it: any, idx: number) => (
                  <div key={it.industry} className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${COLORS[idx % COLORS.length]}20`, color: COLORS[idx % COLORS.length] }}>
                      <Building2 className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{it.industry}</span>
                        <span className="text-lpu-text-secondary">{it.count}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${(it.count / (topIndustries.successfulIndustries[0]?.count || 1)) * 100}%`, backgroundColor: COLORS[idx % COLORS.length] }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <PageEmptyState message="No industry data yet" />
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
