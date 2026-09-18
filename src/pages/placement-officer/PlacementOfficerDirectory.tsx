'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Users, Search, RefreshCw, AlertCircle, ChevronLeft, ChevronRight,
  GraduationCap, Briefcase, Eye, X, Mail, Phone, Building2,
  Calendar, Target, Sparkles, BookOpen, Heart, MessageSquare,
} from 'lucide-react';
import { placementOfficerService } from '@/services/api';
import { useRoleGuard } from '@/lib/use-role-guard';
import { PageHeader, PageLoader, PageEmptyState } from '@/components/dashboard/page-primitives';

export default function PlacementStudentDirectoryPage() {
  const { allowed } = useRoleGuard(['PLACEMENT_OFFICER', 'ADMIN']);
  const [data, setData] = useState<any>({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const limit = 20;

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await placementOfficerService.getStudents(page, limit, search);
      setData({
        items: res?.data || res?.items || res || [],
        total: res?.total ?? (res?.data || res || []).length,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load students.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (allowed) load();
  }, [allowed, page]);

  const openDetail = async (id: string) => {
    setSelectedId(id);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await placementOfficerService.getStudentById(id);
      setDetail(res?.data || res);
    } catch (err: any) {
      setDetail({ error: err.message || 'Failed to load student details.' });
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setSelectedId(null);
    setDetail(null);
  };

  if (!allowed) return <PageLoader message="Verifying access…" />;

  const totalPages = Math.max(1, Math.ceil(data.total / limit));
  const items = data.items;

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Student Directory"
        description="Browse all registered students and their career profiles."
        icon={Users}
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
            <CardTitle>Students</CardTitle>
            <CardDescription>{data.total} student{data.total === 1 ? '' : 's'} in directory</CardDescription>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); setPage(1); load(); }} className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-lpu-text-muted" />
            <input
              placeholder="Search by name, programme, target role…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10 w-full sm:w-80 rounded-xl border border-lpu-border text-sm focus:ring-2 focus:ring-lpu-orange focus:outline-none"
            />
          </form>
        </CardHeader>
        <CardContent>
          {loading ? (
            <PageLoader message="Loading students…" />
          ) : items.length === 0 ? (
            <PageEmptyState message="No students found" hint="Try clearing your search." icon={Users} />
          ) : (
            <>
              <div className="rounded-2xl border border-lpu-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-lpu-bg text-lpu-text-secondary border-b border-lpu-border">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">Name</th>
                        <th className="px-4 py-3 text-left font-medium">Programme</th>
                        <th className="px-4 py-3 text-left font-medium">Target Role</th>
                        <th className="px-4 py-3 text-left font-medium">Profile</th>
                        <th className="px-4 py-3 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-lpu-border">
                      {items.map((s: any) => {
                        const name = s.studentName || `${s.firstName || ''} ${s.lastName || ''}`.trim() || 'Student';
                        const completion = s.profileCompletion ?? 0;
                        return (
                          <tr key={s._id || s.id} className="hover:bg-gray-50/50">
                            <td className="px-4 py-3 font-medium">
                              <div className="flex items-center gap-2">
                                <div className="h-8 w-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-xs">
                                  {(name[0] || 'S').toUpperCase()}
                                </div>
                                <div>
                                  <div>{name}</div>
                                  <div className="text-xs text-lpu-text-muted">{s.email || '—'}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-lpu-text-secondary">
                              <div className="flex items-center gap-1.5">
                                <GraduationCap className="h-3.5 w-3.5" />
                                {s.programme || '—'}
                              </div>
                              {s.school && <div className="text-xs text-lpu-text-muted ml-5">{s.school}</div>}
                            </td>
                            <td className="px-4 py-3 text-lpu-text-secondary">
                              <div className="flex items-center gap-1.5">
                                <Briefcase className="h-3.5 w-3.5" />
                                {s.targetRole || '—'}
                              </div>
                              {s.targetIndustry && <div className="text-xs text-lpu-text-muted ml-5">{s.targetIndustry}</div>}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                {s.hasProfile ? (
                                  <>
                                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden max-w-[80px]">
                                      <div
                                        className={`h-full rounded-full ${
                                          completion >= 70 ? 'bg-emerald-500' :
                                          completion >= 40 ? 'bg-amber-500' :
                                          'bg-red-500'
                                        }`}
                                        style={{ width: `${completion}%` }}
                                      />
                                    </div>
                                    <span className="text-xs text-lpu-text-secondary font-mono">{completion}%</span>
                                  </>
                                ) : (
                                  <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-200 rounded-full">
                                    No profile yet
                                  </Badge>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openDetail(s._id || s.id)}
                                className="rounded-lg"
                              >
                                <Eye className="h-3.5 w-3.5 mr-1.5" /> View
                              </Button>
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

      {selectedId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={closeDetail}
        >
          <Card
            className="w-full max-w-2xl max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4 border-b">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-lpu-orange" />
                  Student Profile
                </CardTitle>
                <CardDescription>Full details from the database</CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={closeDetail} className="h-8 w-8 rounded-full">
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="pt-6">
              {detailLoading ? (
                <PageLoader message="Loading student details…" />
              ) : detail?.error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {detail.error}
                </div>
              ) : detail ? (
                <div className="space-y-6">
                  <div className="flex items-center gap-4 pb-4 border-b">
                    <div className="h-16 w-16 rounded-full bg-orange-50 border-2 border-orange-100 flex items-center justify-center text-lpu-orange font-bold text-2xl">
                      {(detail.firstName?.[0] || detail.studentName?.[0] || '?').toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-lpu-text-primary">{detail.studentName || '—'}</h3>
                      <div className="flex flex-wrap gap-3 text-sm text-lpu-text-secondary mt-1">
                        {detail.email && (
                          <span className="flex items-center gap-1.5">
                            <Mail className="h-3.5 w-3.5" /> {detail.email}
                          </span>
                        )}
                        {detail.phone && (
                          <span className="flex items-center gap-1.5">
                            <Phone className="h-3.5 w-3.5" /> {detail.phone}
                          </span>
                        )}
                      </div>
                    </div>
                    <CompletionRing value={detail.profileCompletion ?? 0} />
                  </div>

                  <Section title="Academic" icon={GraduationCap}>
                    <Row label="Programme" value={detail.programme} />
                    <Row label="School" value={detail.school} />
                    <Row label="Year of study" value={detail.yearOfStudy} />
                    <Row label="Graduation year" value={detail.graduationYear} />
                  </Section>

                  <Section title="Career targets" icon={Target}>
                    <Row label="Target role" value={detail.targetRole} />
                    <Row label="Target industry" value={detail.targetIndustry} />
                    <Row label="Preferred frequency" value={detail.preferredFrequency} />
                  </Section>

                  {detail.currentSkills?.length > 0 && (
                    <Section title="Current skills" icon={Sparkles}>
                      <div className="flex flex-wrap gap-2">
                        {detail.currentSkills.map((skill: string) => (
                          <Badge key={skill} variant="secondary" className="rounded-full">{skill}</Badge>
                        ))}
                      </div>
                    </Section>
                  )}

                  {detail.careerGoals?.length > 0 && (
                    <Section title="Career goals" icon={BookOpen}>
                      <ul className="list-disc list-inside space-y-1 text-sm text-lpu-text-primary">
                        {detail.careerGoals.map((g: string, i: number) => (
                          <li key={i}>{g}</li>
                        ))}
                      </ul>
                    </Section>
                  )}

                  {detail.interests?.length > 0 && (
                    <Section title="Interests" icon={Heart}>
                      <div className="flex flex-wrap gap-2">
                        {detail.interests.map((interest: string) => (
                          <Badge key={interest} variant="outline" className="rounded-full">{interest}</Badge>
                        ))}
                      </div>
                    </Section>
                  )}

                  <Section title="Mentoring" icon={MessageSquare}>
                    <p className="text-sm text-lpu-text-primary whitespace-pre-wrap">
                      {detail.mentoringNeeds || '—'}
                    </p>
                  </Section>

                  <Section title="Onboarding" icon={Building2}>
                    <Row label="Status" value={detail.userOnboardingStatus} />
                    <Row label="Verification" value={detail.userVerificationStatus} />
                    <Row label="Joined" value={detail.userCreatedAt ? new Date(detail.userCreatedAt).toLocaleDateString() : '—'} />
                    {detail.profileCreatedAt && <Row label="Profile created" value={new Date(detail.profileCreatedAt).toLocaleDateString()} />}
                    {detail.profileUpdatedAt && <Row label="Last updated" value={new Date(detail.profileUpdatedAt).toLocaleDateString()} />}
                  </Section>

                  {!detail.hasProfile && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium">No career profile yet</p>
                        <p className="text-xs text-amber-700 mt-0.5">This student has registered but hasn't completed their career profile onboarding.</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-lpu-text-primary flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-lpu-orange" /> {title}
      </h4>
      <div className="space-y-1.5 pl-6">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex items-baseline gap-3 text-sm">
      <span className="text-lpu-text-muted min-w-[140px]">{label}</span>
      <span className="text-lpu-text-primary font-medium">{value || '—'}</span>
    </div>
  );
}

function CompletionRing({ value }: { value: number }) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const color = value >= 70 ? 'text-emerald-500' : value >= 40 ? 'text-amber-500' : 'text-red-500';
  return (
    <div className="relative h-20 w-20 shrink-0">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={radius} fill="none" stroke="currentColor" strokeWidth="6" className="text-gray-100" />
        <circle
          cx="32" cy="32" r={radius} fill="none" stroke="currentColor" strokeWidth="6"
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          className={color}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-sm font-bold ${color}`}>{value}%</span>
      </div>
    </div>
  );
}
