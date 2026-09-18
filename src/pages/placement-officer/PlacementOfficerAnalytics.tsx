'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart3, RefreshCw, AlertCircle, Users, Briefcase, CheckCircle2, Target, Award } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, Cell } from 'recharts';
import { placementOfficerService } from '@/services/api';
import { useRoleGuard } from '@/lib/use-role-guard';
import { PageHeader, PageLoader, PageEmptyState } from '@/components/dashboard/page-primitives';

const COLORS = ['#f97316', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#f59e0b', '#06b6d4', '#84cc16'];

export default function PlacementAnalyticsPage() {
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
      setError(err.message || 'Failed to load analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (allowed) load();
  }, [allowed]);

  if (!allowed) return <PageLoader message="Loading…" />;

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Placement Analytics"
        description="Comprehensive placement funnel and student career health."
        icon={BarChart3}
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

      {loading || !data ? (
        <PageLoader message="Loading analytics…" />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Stat label="Total Students" value={data.overview?.totalStudents} icon={Users} color="bg-blue-50 text-blue-600" />
            <Stat label="Active Mentorships" value={data.overview?.activeMentorshipsCount} icon={Briefcase} color="bg-emerald-50 text-emerald-600" />
            <Stat label="Sessions This Week" value={data.overview?.upcomingSessionsThisWeek} icon={CheckCircle2} color="bg-purple-50 text-purple-600" />
            <Stat label="Goal Completion" value={`${data.overview?.goalCompletionRate ?? 0}%`} icon={Target} color="bg-amber-50 text-amber-600" />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Mentorship Pipeline</CardTitle>
                <CardDescription>Last 6 months</CardDescription>
              </CardHeader>
              <CardContent>
                {data.monthlySeries?.length ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={data.monthlySeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" stroke="#888" fontSize={11} />
                      <YAxis stroke="#888" fontSize={11} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="requests" stroke="#3b82f6" strokeWidth={2} />
                      <Line type="monotone" dataKey="accepted" stroke="#10b981" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <PageEmptyState message="No data yet" />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Target Roles</CardTitle>
                <CardDescription>Most common student career goals</CardDescription>
              </CardHeader>
              <CardContent>
                {data.topRoles?.length ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data.topRoles}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="role" stroke="#888" fontSize={10} angle={-20} textAnchor="end" height={60} />
                      <YAxis stroke="#888" fontSize={11} />
                      <Tooltip />
                      <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                        {data.topRoles.map((_: any, i: number) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <PageEmptyState message="No data yet" />
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
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
            <p className="text-2xl font-bold mt-1">{value ?? '—'}</p>
          </div>
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
