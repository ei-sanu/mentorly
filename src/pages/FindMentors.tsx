'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Filter, Star, CheckCircle2, RefreshCw } from 'lucide-react';
import { mentorService, studentService } from '@/services/api';
import { MentorMatch, MentorPublicProfile } from '@/types';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUser } from '@/lib/mock-auth';
import { RequestMentorshipDialog } from '@/components/mentor/RequestMentorshipDialog';
import { MatchScoreTooltip, type TooltipStudentProfile } from '@/components/mentor/MatchScoreTooltip';
import { MentorlyAiLoader } from '@/components/mentor/MentorlyAiLoader';
import { useMentorRequestStatus, markRequestSent } from '@/lib/request-status';

export default function MentorDiscovery() {
  const router = useRouter();
  const { user } = useUser();
  const [mentors, setMentors] = useState<MentorMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  // Refresh (2026-11-20, workspace slice Item 5): re-runs the AI
  // ranking on fresh data. While a refresh is in flight the loader
  // (Item 6) shows in place of the list — the old results are stale
  // until the fresh ones arrive. A failed refresh keeps the old list
  // and says so inline instead of blanking it.
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  // The student's own career profile, for the match-score tooltip (Item 1):
  // see StudentDashboard.tsx — same honest rules, no invented goals/skills.
  const [studentProfile, setStudentProfile] = useState<TooltipStudentProfile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  // Mentor the request dialog is open for, if any (2026-11-12: the
  // "View & Request" button was a no-op with no onClick at all — split
  // into the two working actions, dialog + profile route).
  const [requestMentor, setRequestMentor] = useState<MentorMatch | null>(null);
  // Shared request state: mentors with a pending/accepted request show
  // it on the card on every visit, and flip the moment a send, cancel,
  // or mentor decision lands (see src/lib/request-status.ts). Only
  // students have own requests — other roles see plain cards.
  const requestStatus = useMentorRequestStatus(user?.role === 'STUDENT');

  useEffect(() => {
    async function loadMentors() {
      const [data, profile] = await Promise.all([
        mentorService.getRecommendedMentors(),
        studentService.getMyProfile(),
      ]);
      setMentors(data);
      setStudentProfile(profile);
      setProfileLoaded(true);
      setLoading(false);
    }
    loadMentors();
  }, []);

  // Item 5 — refresh recommendations: bust the 1h cache server-side
  // (POST /recommendations/recalculate) and then re-fetch, so the
  // student gets freshly ranked results — a re-render of the stale
  // list is not a refresh.
  const handleRefresh = async () => {
    if (refreshing || loading) return;
    setRefreshing(true);
    setRefreshError(null);
    try {
      await mentorService.recalculateRecommendations();
      const data = await mentorService.getRecommendedMentors();
      setMentors(data);
    } catch (err: any) {
      setRefreshError(err?.message || 'Could not refresh recommendations. Showing the previous results.');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="space-y-8 flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-lpu-text-primary">
            Find Mentors
          </h1>
          <p className="text-lpu-text-secondary mt-1">
            Connect with alumni who have walked your path.
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-lpu-text-muted" />
            <input 
              type="text" 
              placeholder="Search by role, company..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 pl-9 pr-4 rounded-md border border-lpu-border text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 w-full sm:w-64"
            />
          </div>
          <Button variant="outline" size="icon">
            <Filter className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={loading || refreshing}
            aria-label="Refresh recommendations"
            title="Refresh recommendations"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {refreshError && (
        <p className="text-sm text-red-700" role="alert">{refreshError}</p>
      )}

      <div className="flex-1 overflow-auto">
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {loading || refreshing ? (
            <div className="md:col-span-2 xl:col-span-3">
              <MentorlyAiLoader />
            </div>
          ) : (
            mentors.filter(m => m.company.toLowerCase().includes(searchQuery.toLowerCase()) || m.title.toLowerCase().includes(searchQuery.toLowerCase())).map((mentor) => {
              const state = requestStatus[mentor.id];
              const requested = state !== undefined;
              return (
              <Card key={mentor.id} className="flex flex-col h-full overflow-hidden">
                <div className="bg-blue-50/50 p-3 border-b border-lpu-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-neutral-900 fill-neutral-900" />
                    <MatchScoreTooltip mentor={mentor} studentProfile={studentProfile} profileLoaded={profileLoaded}>
                      <span className="font-semibold text-neutral-900 text-sm">{mentor.matchScore}% Match</span>
                    </MatchScoreTooltip>
                  </div>
                  <Badge variant="outline" className="bg-white text-xs">
                    {Math.max(0, mentor.capacity.max - mentor.capacity.current)} slots left
                  </Badge>
                </div>
                <CardContent className="p-5 flex-1 flex flex-col">
                  <div className="flex items-start gap-4 mb-4">
                    <img src={mentor.imageUrl} alt={mentor.firstName} className="h-14 w-14 rounded-full object-cover border border-gray-100" />
                    <div>
                      <h3 className="font-semibold text-base">{mentor.firstName} {mentor.lastName}</h3>
                      <p className="text-lpu-text-secondary text-sm line-clamp-1">{mentor.title} at {mentor.company}</p>
                      <p className="text-lpu-text-muted text-xs mt-0.5">{mentor.experienceYears}y exp • Class of {mentor.graduationYear}</p>
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <div className="flex flex-wrap gap-1.5">
                      {mentor.expertise.slice(0, 3).map((exp, i) => (
                        <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0">
                          {exp}
                        </Badge>
                      ))}
                      {mentor.expertise.length > 3 && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          +{mentor.expertise.length - 3}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded p-3 mb-4 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-lpu-text-muted mb-2">Why this mentor?</p>
                    <ul className="text-xs space-y-1.5 text-lpu-text-secondary">
                      {mentor.matchReasons.slice(0, 2).map((reason, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-px" />
                          <span className="line-clamp-2">{reason}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className="mt-auto flex gap-2">
                    <Button
                      className={state === 'pending' ? 'flex-1 border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50 disabled:opacity-100' : 'flex-1'}
                      onClick={() => setRequestMentor(mentor)}
                      disabled={requested}
                    >
                      {state === 'pending' ? (
                        <><CheckCircle2 className="mr-2 h-4 w-4" /> Request Sent</>
                      ) : state === 'accepted' ? 'Mentorship Active' : 'Request Mentorship'}
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => router.push(`/app/student/mentors/${mentor.id}`)}
                    >
                      View Profile
                    </Button>
                  </div>
                </CardContent>
              </Card>
              );
            })
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
