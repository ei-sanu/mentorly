'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, RefreshCw, AlertCircle, GraduationCap, Briefcase } from 'lucide-react';
import { mentorshipService } from '@/services/api';
import { useRoleGuard } from '@/lib/use-role-guard';
import { PageHeader, PageLoader, PageEmptyState } from '@/components/dashboard/page-primitives';
import Link from 'next/link';

export default function MentorMenteesPage() {
  const { allowed } = useRoleGuard(['MENTOR']);
  const [mentees, setMentees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await mentorshipService.getActiveMentorships();
      setMentees(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load mentees.');
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
        title="My Mentees"
        description="Students currently in active mentorship with you."
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
        <CardHeader>
          <CardTitle>Active Mentees</CardTitle>
          <CardDescription>{mentees.length} active mentorship{mentees.length === 1 ? '' : 's'}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <PageLoader message="Loading mentees…" />
          ) : mentees.length === 0 ? (
            <PageEmptyState
              message="No active mentees"
              hint="Accepted mentorship requests will show up here."
              icon={Users}
            />
          ) : (
            <div className="space-y-2">
              {mentees.map((m: any) => {
                // (2026-11-20, workspace slice Item 2) The backend now
                // attaches the flat `student` display object on the
                // MENTOR branch (firstName/lastName at the top level).
                // The fallback reads the old shape (populated profile
                // doc with the User doc nested under userId) so the
                // page still names the student if the backend has not
                // been restarted yet.
                const student = m.student || {};
                const legacyUser = m.studentProfileId?.userId || {};
                const firstName = student.firstName || legacyUser.firstName || '';
                const lastName = student.lastName || legacyUser.lastName || '';
                const displayName = [firstName, lastName].filter(Boolean).join(' ') || 'Student';
                const programme = student.programme || m.studentProfileId?.programme || '—';
                const school = student.school || m.studentProfileId?.school || '';
                const targetRole = student.targetRole || m.studentProfileId?.targetRole;
                return (
                  <div key={m._id || m.id} className="flex items-center gap-4 p-4 border border-gray-100 rounded-2xl">
                    <div className="h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold">
                      {displayName === 'Student' ? 'S' : displayName.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold truncate">
                        {displayName}
                      </h3>
                      <p className="text-xs text-lpu-text-secondary flex items-center gap-1.5">
                        <GraduationCap className="h-3 w-3" />
                        {programme} • {school}
                      </p>
                      {targetRole && (
                        <p className="text-xs text-lpu-text-muted flex items-center gap-1.5 mt-0.5">
                          <Briefcase className="h-3 w-3" />
                          Targeting {targetRole}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                      {m.status || 'ACTIVE'}
                    </Badge>
                    <Link href={`/app/mentor/mentorships/${m.id}`}>
                      <Button variant="outline" size="sm" className="rounded-xl shrink-0">
                        Open workspace
                      </Button>
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
