'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@/lib/mock-auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GraduationCap, Calendar, CheckSquare, Clock, ArrowRight, Star } from 'lucide-react';
import { mentorService, mentorshipService, requestService, studentService } from '@/services/api';
import { MentorMatch, Mentorship, Session, Goal } from '@/types';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { RequestMentorshipDialog } from '@/components/mentor/RequestMentorshipDialog';
import { MatchScoreTooltip, type TooltipStudentProfile } from '@/components/mentor/MatchScoreTooltip';
import { MentorlyAiLoader } from '@/components/mentor/MentorlyAiLoader';
import { useMentorRequestStatus, markRequestSent } from '@/lib/request-status';

// A meeting link is real only when it is a non-empty http(s) URL — never a
// generated or placeholder link (2026-11-20, Item 6).
function isMeetingUrl(u?: string | null): boolean {
  return !!u && /^https?:\/\//i.test(u.trim());
}

export default function StudentDashboard() {
  const { user } = useUser();
  const router = useRouter();
  const [mentors, setMentors] = useState<MentorMatch[]>([]);
  const [mentorships, setMentorships] = useState<Mentorship[]>([]);
  const [loading, setLoading] = useState(true);
  // The student's own career profile, for the match-score tooltip (Item 1):
  // the score is explained against the student's real goals/skills/target
  // role. getMyProfile returns null when there is no profile — the tooltip
  // then says the match is based on limited information, never invents it.
  const [studentProfile, setStudentProfile] = useState<TooltipStudentProfile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  // The real next session for the first active mentorship (Item 6) — the
  // old card was hardcoded text ("Resume Review / Aug 26 / 11:00 AM").
  const [nextSession, setNextSession] = useState<Session | null>(null);
  // Mentor the request dialog is open for, if any (2026-11-12: the
  // Request Mentorship / View Profile buttons were no-ops with no
  // onClick at all — the dialog + profile route are the missing wiring).
  const [requestMentor, setRequestMentor] = useState<MentorMatch | null>(null);
  // Shared request state: mentors with a pending/accepted request show
  // it on the card on every visit, and flip the moment a send, cancel,
  // or mentor decision lands (see src/lib/request-status.ts). Only
  // students have own requests — other roles see plain cards.
  const requestStatus = useMentorRequestStatus(user?.role === 'STUDENT');

  useEffect(() => {
    async function loadData() {
      const [recommended, activeMentorships, profile] = await Promise.all([
        mentorService.getRecommendedMentors(),
        mentorshipService.getActiveMentorships(),
        studentService.getMyProfile(),
      ]);
      setMentors(recommended);
      setMentorships(activeMentorships);
      setStudentProfile(profile);
      setProfileLoaded(true);
      // Real next session: earliest future SCHEDULED session of the first
      // active mentorship. A sessions failure must never break the dashboard.
      if (activeMentorships.length > 0) {
        try {
          const sess = await mentorshipService.getSessions(activeMentorships[0].id);
          const now = new Date();
          const upcoming = (sess || [])
            .filter((s) => s.status === 'SCHEDULED' && new Date(s.startTime) > now)
            .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
          setNextSession(upcoming[0] ?? null);
        } catch {
          setNextSession(null);
        }
      }
      setLoading(false);
    }
    loadData();
  }, []);

  if (!user) return null;

  // Item 1 subline, computed from the SHOWN slice only (mentors.slice(0, 2))
  // so the text never describes mentors the user cannot see. Honest per
  // state: AI wording only when a shown item was genuinely LLM-ranked.
  const shownMentors = mentors.slice(0, 2);
  const recommendationSubline =
    mentors.length === 0
      ? null
      : shownMentors.some((m) => m.llmUsed === true)
        ? 'Ranked by AI for your profile'
        : 'Top verified mentors accepting new mentees';

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-lpu-text-primary">
          Good morning, {user.firstName}
        </h1>
        <p className="text-lpu-text-secondary mt-1">
          Continue building your career with guidance from the LPU alumni network.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Mentorships</CardTitle>
            <GraduationCap className="h-4 w-4 text-lpu-text-muted" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mentorships.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Sessions</CardTitle>
            <Calendar className="h-4 w-4 text-lpu-text-muted" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Goals in Progress</CardTitle>
            <CheckSquare className="h-4 w-4 text-lpu-text-muted" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
            <Clock className="h-4 w-4 text-lpu-text-muted" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Finding the best mentor for your requirements</h2>
              {recommendationSubline && (
                <p className="mt-1 text-sm text-lpu-text-secondary">{recommendationSubline}</p>
              )}
            </div>
            <Link href="/app/student/mentors">
              <Button variant="ghost" size="sm" className="text-neutral-900">
                View all <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>
          
          {loading ? (
            <MentorlyAiLoader />
          ) : (
            <div className="space-y-4">
              {mentors.slice(0, 2).map((mentor) => {
                const state = requestStatus[mentor.id];
                const requested = state !== undefined;
                return (
                <Card key={mentor.id} className="overflow-hidden">
                  <div className="bg-blue-50/50 p-4 border-b border-lpu-border flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-neutral-900 fill-neutral-900" />
                      <MatchScoreTooltip mentor={mentor} studentProfile={studentProfile} profileLoaded={profileLoaded}>
                        <span className="font-semibold text-neutral-900 text-sm">{mentor.matchScore}% Match</span>
                      </MatchScoreTooltip>
                    </div>
                    <Badge variant="outline" className="bg-white">
                      {Math.max(0, mentor.capacity.max - mentor.capacity.current)} slots left
                    </Badge>
                  </div>
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <img src={mentor.imageUrl} alt={mentor.firstName} className="h-16 w-16 rounded-full object-cover border border-gray-100" />
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">{mentor.firstName} {mentor.lastName}</h3>
                        <p className="text-lpu-text-secondary text-sm">{mentor.title} at {mentor.company}</p>
                        <p className="text-lpu-text-muted text-xs mt-1">{mentor.programme} • Class of {mentor.graduationYear}</p>
                        
                        <div className="mt-4 space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-wider text-lpu-text-muted">Why this mentor?</p>
                          <ul className="text-sm space-y-1 text-lpu-text-secondary">
                            {mentor.matchReasons.slice(0, 3).map((reason, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                                <span>{reason}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        
                        <div className="mt-6 flex items-center gap-3">
                          <Button
                            className={state === 'pending' ? 'w-full sm:w-auto border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50 disabled:opacity-100' : 'w-full sm:w-auto'}
                            onClick={() => setRequestMentor(mentor)}
                            disabled={requested}
                          >
                            {state === 'pending' ? (
                              <><CheckCircle2 className="mr-2 h-4 w-4" /> Request Sent</>
                            ) : state === 'accepted' ? 'Mentorship Active' : 'Request Mentorship'}
                          </Button>
                          <Button
                            variant="outline"
                            className="w-full sm:w-auto"
                            onClick={() => router.push(`/app/student/mentors/${mentor.id}`)}
                          >
                            View Profile
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">Active Mentorship</h2>
          {loading ? (
             <Card className="animate-pulse bg-gray-50">
               <CardContent className="h-64" />
             </Card>
          ) : mentorships.length > 0 ? (
            <Card>
              <CardHeader className="bg-gray-50/50 border-b border-lpu-border">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Mentorship with {mentorships[0].mentor?.firstName}</CardTitle>
                    <CardDescription>Started {new Date(mentorships[0].startDate).toLocaleDateString()}</CardDescription>
                  </div>
                  <Badge variant="success" className="bg-emerald-50 text-emerald-700 border-emerald-200">Active</Badge>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div>
                  <h4 className="text-sm font-medium mb-2">Next Session</h4>
                  {nextSession ? (
                    <div className="flex items-center justify-between p-3 rounded-lg border border-lpu-border bg-gray-50">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded bg-white border border-gray-200 flex flex-col items-center justify-center">
                          <span className="text-xs text-lpu-text-muted uppercase">{new Date(nextSession.startTime).toLocaleDateString('en-US', { month: 'short' })}</span>
                          <span className="font-bold text-sm leading-none">{new Date(nextSession.startTime).getDate()}</span>
                        </div>
                        <div>
                          <p className="font-medium text-sm">{nextSession.title}</p>
                          <p className="text-xs text-lpu-text-secondary">
                            {new Date(nextSession.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            {' – '}
                            {new Date(nextSession.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                      {isMeetingUrl(nextSession.meetingUrl) ? (
                        <a
                          href={nextSession.meetingUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-9 items-center rounded-md border border-lpu-border bg-white px-3 text-sm font-medium text-neutral-900 hover:bg-gray-50"
                        >
                          Join meeting
                        </a>
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-sm text-lpu-text-muted">No upcoming sessions.</p>
                  )}
                </div>
                
                <div>
                  <h4 className="text-sm font-medium mb-2">Current Goal Focus</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-lpu-text-secondary">Build Backend API Portfolio</span>
                      <span className="text-lpu-text-muted">50%</span>
                    </div>
                    <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-neutral-900 rounded-full" style={{ width: '50%' }} />
                    </div>
                  </div>
                </div>
                
                <Button variant="ghost" className="w-full text-neutral-900" onClick={() => router.push(`/app/student/mentorships/${mentorships[0].id}`)}>Go to Workspace</Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center text-neutral-900 mb-4">
                <GraduationCap className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-medium">No active mentorships</h3>
              <p className="text-lpu-text-secondary mt-1 max-w-xs mb-6">
                Send a request to a recommended mentor to start your journey.
              </p>
              <Button onClick={() => router.push('/app/student/mentors')}>Find Mentors</Button>
            </Card>
          )}
        </div>
      </div>

      <RequestMentorshipDialog
        open={requestMentor !== null}
        mentor={requestMentor}
        onClose={() => setRequestMentor(null)}
        onSent={markRequestSent}
      />
    </div>
  );
}

// Ensure CheckCircle2 is imported if missing
import { CheckCircle2 } from 'lucide-react';
