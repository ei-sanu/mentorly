'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Briefcase, CheckCircle2, GraduationCap, Users } from 'lucide-react';
import { mentorService, userService } from '@/services/api';
import { MentorPublicProfile } from '@/types';
import { useUser } from '@/lib/mock-auth';
import { RequestMentorshipDialog } from '@/components/mentor/RequestMentorshipDialog';
import { useMentorRequestStatus, markRequestSent } from '@/lib/request-status';

// ─── Mentor profile view (2026-11-12) ──────────────────────────────────────
// The "View Profile" buttons on the student dashboard and Find Mentors page
// were no-ops, and no mentor profile route or page existed at all —
// App.tsx only had the student/mentors list. This page is the missing
// target: GET /mentors/:id through mentorService.getMentorById (the id is
// the mentor profile id, the same id the recommendation cards carry), with
// loading, not-found, and backend-unreachable states, and the shared
// Request Mentorship dialog. Only fields the backend actually returns are
// shown — no invented bio, ratings, or stats.

export default function MentorProfileView() {
  const params = useParams();
  const router = useRouter();
  const { user } = useUser();
  const mentorId = typeof params.mentorId === 'string' ? params.mentorId : '';

  const [mentor, setMentor] = useState<MentorPublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  // "On leave until <date>" badge (Item 5): a current leave covering today,
  // from GET /mentors/:id/leaves. Null when no leave covers today.
  const [onLeaveUntil, setOnLeaveUntil] = useState<string | null>(null);
  // Shared request state (see src/lib/request-status.ts): a request sent
  // in an earlier visit — or decided by the mentor in another session —
  // shows here without a refresh, not just sends from this page load.
  const requestStatus = useMentorRequestStatus(user?.role === 'STUDENT');
  const state = mentorId ? requestStatus[mentorId] : undefined;
  const requested = state !== undefined;

  useEffect(() => {
    let cancelled = false;

    async function loadMentor() {
      setLoading(true);
      setError(null);
      if (!mentorId) {
        if (!cancelled) {
          setError('No mentor was selected.');
          setLoading(false);
        }
        return;
      }
      // getMentorById returns null on any failure (404, backend down) —
      // tell the two apart so the message is accurate.
      const profile = await mentorService.getMentorById(mentorId);
      if (cancelled) return;
      if (profile) {
        setMentor(profile);
        // Leave badge: only a leave covering today counts. Date strings
        // compare lexicographically (YYYY-MM-DD); a leaves failure must
        // never block the profile.
        try {
          const leaves = await mentorService.getMentorLeaves(mentorId);
          const today = new Date();
          const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
          const current = (Array.isArray(leaves) ? leaves : []).find(
            (l) => String(l.startDate).slice(0, 10) <= todayStr && todayStr <= String(l.endDate).slice(0, 10),
          );
          if (!cancelled) {
            setOnLeaveUntil(
              current
                ? new Date(String(current.endDate).slice(0, 10)).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })
                : null,
            );
          }
        } catch {
          if (!cancelled) setOnLeaveUntil(null);
        }
      } else {
        const reachable = await userService.isBackendReachable();
        if (cancelled) return;
        setError(
          reachable
            ? 'This mentor’s profile couldn’t be found. They may no longer be on Mentorly.'
            : 'Could not reach the Mentorly server. Start the backend first and try again.'
        );
      }
      setLoading(false);
    }

    loadMentor();
    return () => {
      cancelled = true;
    };
  }, [mentorId]);

  const backToMentors = () => router.push('/app/student/mentors');

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="h-5 w-40 animate-pulse rounded bg-gray-100" />
        <Card className="animate-pulse bg-gray-50">
          <CardContent className="h-72" />
        </Card>
      </div>
    );
  }

  if (error || !mentor) {
    return (
      <div className="space-y-8">
        <button
          type="button"
          onClick={backToMentors}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-900"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Find Mentors
        </button>
        <Card className="flex flex-col items-center justify-center py-12 text-center">
          <h3 className="text-lg font-medium">Mentor not found</h3>
          <p className="mt-1 max-w-sm text-sm text-lpu-text-secondary">{error}</p>
          <div className="mt-6 flex gap-2">
            <Button variant="outline" onClick={backToMentors}>
              Back to Find Mentors
            </Button>
            <Button onClick={() => window.location.reload()}>Retry</Button>
          </div>
        </Card>
      </div>
    );
  }

  const expertise = mentor.expertise || [];
  const slotsLeft = Math.max(0, (mentor.capacity?.max ?? 0) - (mentor.capacity?.current ?? 0));
  const metaParts = [
    mentor.experienceYears > 0 ? `${mentor.experienceYears}y experience` : null,
    mentor.programme || null,
    mentor.graduationYear ? `Class of ${mentor.graduationYear}` : null,
  ].filter(Boolean);

  return (
    <div className="space-y-8">
      <RequestMentorshipDialog
        open={requestOpen}
        mentor={mentor}
        onClose={() => setRequestOpen(false)}
        onSent={markRequestSent}
      />

      <button
        type="button"
        onClick={backToMentors}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-900"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Find Mentors
      </button>

      <Card className="overflow-hidden">
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <img
              src={mentor.imageUrl}
              alt={`${mentor.firstName} ${mentor.lastName}`}
              className="h-24 w-24 shrink-0 rounded-full border border-gray-100 object-cover"
            />
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold tracking-tight text-lpu-text-primary">
                {mentor.firstName} {mentor.lastName}
              </h1>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-lpu-text-secondary">
                <Briefcase className="h-4 w-4 shrink-0" />
                {mentor.title} at {mentor.company}
              </p>
              {metaParts.length > 0 && (
                <p className="mt-1 flex items-center gap-1.5 text-sm text-lpu-text-muted">
                  <GraduationCap className="h-4 w-4 shrink-0" />
                  {metaParts.join(' • ')}
                </p>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {mentor.industry && (
                  <Badge variant="secondary">{mentor.industry}</Badge>
                )}
                {mentor.acceptingMentees ? (
                  <Badge variant="outline" className="flex items-center gap-1 border-emerald-200 bg-emerald-50 text-emerald-700">
                    <CheckCircle2 className="h-3 w-3" /> Accepting mentees
                  </Badge>
                ) : (
                  <Badge variant="outline">Not accepting new mentees</Badge>
                )}
                {onLeaveUntil && (
                  <Badge variant="outline" className="flex items-center gap-1 border-amber-200 bg-amber-50 text-amber-700">
                    On leave until {onLeaveUntil}
                  </Badge>
                )}
                <Badge variant="outline" className="flex items-center gap-1 bg-white">
                  <Users className="h-3 w-3" /> {slotsLeft} {slotsLeft === 1 ? 'slot' : 'slots'} left
                </Badge>
              </div>
            </div>
          </div>

          {expertise.length > 0 && (
            <div className="mt-8">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-lpu-text-muted">
                Expertise
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {expertise.map((skill) => (
                  <Badge key={skill} variant="secondary">
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8 flex flex-col gap-3 border-t border-lpu-border pt-6 sm:flex-row sm:items-center">
            <Button
              onClick={() => setRequestOpen(true)}
              disabled={requested || !mentor.acceptingMentees}
              className={state === 'pending' ? 'w-full sm:w-auto border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50 disabled:opacity-100' : 'w-full sm:w-auto'}
            >
              {state === 'pending' ? (
                <><CheckCircle2 className="mr-2 h-4 w-4" /> Request Sent</>
              ) : state === 'accepted' ? 'Mentorship Active' : 'Request Mentorship'}
            </Button>
            {state === 'pending' && (
              <Button
                variant="outline"
                onClick={() => router.push('/app/student/requests')}
                className="w-full sm:w-auto"
              >
                View my requests
              </Button>
            )}
            {!requested && !mentor.acceptingMentees && (
              <p className="text-sm text-lpu-text-muted">
                This mentor isn’t accepting new mentees right now.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
