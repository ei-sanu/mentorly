'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart3, RefreshCw, AlertCircle, Users, UserCheck, CheckCircle2, Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line, Legend } from 'recharts';
import { alumniOfficerService } from '@/services/api';
import { useRoleGuard } from '@/lib/use-role-guard';
import { PageHeader, PageLoader, PageEmptyState } from '@/components/dashboard/page-primitives';

const COLORS = ['#f97316', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#f59e0b', '#06b6d4', '#84cc16'];

export default function AlumniAnalyticsPage() {
  const { allowed } = useRoleGuard(['ALUMNI_OFFICER']);
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
      setError(err.message || 'Failed to load analytics.');
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
        title="Alumni Analytics"
        description="Engagement, verification, and mentorship health across the alumni network."
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
            <Stat label="Total Alumni" value={data.overview?.totalAlumniMentors} icon={Users} color="bg-blue-50 text-blue-600" />
            <Stat label="Verified" value={data.overview?.verifiedMentors} icon={UserCheck} color="bg-emerald-50 text-emerald-600" />
            <Stat label="Accepting Mentees" value={data.overview?.acceptingMentors} icon={CheckCircle2} color="bg-purple-50 text-purple-600" />
            <Stat label="Avg Satisfaction" value={data.averageSatisfaction ? `${data.averageSatisfaction}/5` : '—'} icon={Activity} color="bg-orange-50 text-orange-600" />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Mentors by Industry</CardTitle>
                <CardDescription>Verified mentor distribution</CardDescription>
              </CardHeader>
              <CardContent>
                {data.mentorsByIndustry?.length ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data.mentorsByIndustry}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="industry" stroke="#888" fontSize={10} angle={-20} textAnchor="end" height={60} />
                      <YAxis stroke="#888" fontSize={11} />
                      <Tooltip />
                      <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                        {data.mentorsByIndustry.map((_: any, i: number) => (
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

            <Card>
              <CardHeader>
                <CardTitle>Alumni Signups</CardTitle>
                <CardDescription>New alumni mentors over the last 6 months</CardDescription>
              </CardHeader>
              <CardContent>
                {data.signupSeries?.length ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={data.signupSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" stroke="#888" fontSize={11} />
                      <YAxis stroke="#888" fontSize={11} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="signups" stroke="#f97316" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <PageEmptyState message="No data yet" />
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Top Companies</CardTitle>
                <CardDescription>Companies with the most active alumni mentors</CardDescription>
              </CardHeader>
              <CardContent>
                {data.topCompanies?.length ? (
                  <div className="space-y-2">
                    {data.topCompanies.map((c: any, idx: number) => (
                      <div key={c.company} className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl">
                        <div className="h-9 w-9 rounded-lg flex items-center justify-center text-sm font-bold" style={{ backgroundColor: `${COLORS[idx % COLORS.length]}20`, color: COLORS[idx % COLORS.length] }}>
                          {idx + 1}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{c.company}</p>
                          <p className="text-xs text-lpu-text-secondary">{c.mentees} active mentees</p>
                        </div>
                        <span className="text-sm font-semibold">{c.mentors} mentors</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <PageEmptyState message="No company data yet" />
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
