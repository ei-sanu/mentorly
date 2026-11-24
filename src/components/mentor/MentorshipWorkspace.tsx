'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { mentorshipService, messagingService } from '@/services/api';
import { Mentorship, Session, Goal } from '@/types';
import { Calendar, Target, CheckCircle2, MessageSquare, Video, FileText, X, AlertCircle } from 'lucide-react';

// ─── Shared mentorship workspace (2026-11-20, workspace slice Item 1) ─────
// One component for BOTH roles — the student page
// (src/pages/MentorshipDetail.tsx) and the mentor page
// (src/pages/MentorMentorshipDetail.tsx) are thin wrappers passing
// role="student" | "mentor". Same activities on both sides: overview,
// sessions, goals, feedback, Message + Schedule actions, Next Session
// + Current Goal cards. What differs by role:
// - Header person: the student sees the MENTOR (name, title at
//   company); the mentor sees the STUDENT (name, programme · school ·
//   class). Both come from the flat display objects the backend now
//   attaches on findOne (Item 2) — never a bare " at ".
// - Message / Back navigate to the role's own routes.
// - Schedule: a student SENDS a session request (REQUESTED, Item 3);
//   a mentor schedules directly (SCHEDULED) and decides on requests
//   (Accept / Decline) in the sessions tab.
// Sessions render from the real startTime/endTime + status enum. A
// "Join meeting" link renders ONLY when meetingUrl is a non-empty
// http(s) URL the mentor/student pasted; when absent the honest text
// "No meeting link yet" shows (with an "Add link" action for the
// session, via the same edit dialog). Meeting links are NEVER
// generated or placeholder — the backend used to store a fake
// meet.google.com/mock-link-* URL, which is removed backend-side.

// A meeting link is real only when it is a non-empty http(s) URL.
function isMeetingUrl(u?: string | null): boolean {
  return !!u && /^https?:\/\//i.test(u.trim());
}

// Optional meeting-link field: empty = no link; otherwise a valid URL.
function getMeetingLinkError(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? null
      : 'Meeting link must start with http:// or https://.';
  } catch {
    return 'That meeting link doesn’t look like a valid URL.';
  }
}

// datetime-local input value (local time) for a stored ISO timestamp.
function toInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const SESSION_STATUS_LABEL: Record<string, string> = {
  SCHEDULED: 'Scheduled',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  RESCHEDULED: 'Rescheduled',
  NO_SHOW: 'No show',
  // (2026-11-20, workspace slice Item 3) A student-proposed session
  // awaiting the mentor's decision — never a confirmed session.
  REQUESTED: 'Requested',
};

function sessionStatusLabel(status: string): string {
  return SESSION_STATUS_LABEL[status] ?? status;
}

export function MentorshipWorkspace({ role }: { role: 'student' | 'mentor' }) {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.mentorshipId === 'string' ? params.mentorshipId : '';

  // Role wiring (Item 1): the mentor side shows the student, routes to
  // the mentor paths, and decides on session requests; the student side
  // shows the mentor and can only SEND a session request (Item 3).
  const isMentor = role === 'mentor';
  const messagesBase = isMentor ? '/app/mentor/messages' : '/app/student/messages';
  const listBase = isMentor ? '/app/mentor/mentees' : '/app/student/mentorships';

  const [mentorship, setMentorship] = useState<Mentorship | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // "Message" in flight (Item 4).
  const [messageLoading, setMessageLoading] = useState(false);
  // Create/edit session dialog (Item 6): null = closed.
  const [sessionDialog, setSessionDialog] = useState<
    { mode: 'create' } | { mode: 'edit'; session: Session } | null
  >(null);
  const [formTitle, setFormTitle] = useState('');
  const [formStart, setFormStart] = useState('');
  const [formEnd, setFormEnd] = useState('');
  const [formTimezone, setFormTimezone] = useState('Asia/Kolkata');
  const [formNotes, setFormNotes] = useState('');
  const [formMeetingUrl, setFormMeetingUrl] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSaving, setFormSaving] = useState(false);
  // Mentor decision on a session request (Item 3): which row is acting,
  // and the last decision error (rendered above the sessions list).
  const [sessionActionId, setSessionActionId] = useState<string | null>(null);
  const [sessionActionError, setSessionActionError] = useState<string | null>(null);

  async function loadSessions() {
    const sess = await mentorshipService.getSessions(id);
    setSessions(sess || []);
  }

  useEffect(() => {
    async function loadData() {
      if (!id) return;
      try {
        // Item 6: fetch this mentorship directly. The old code fetched ALL
        // mentorships and fell back to allMentorships[0] — the wrong
        // mentorship whenever the id was not found.
        const [found, sess, g] = await Promise.all([
          mentorshipService.getMentorshipById(id),
          mentorshipService.getSessions(id),
          mentorshipService.getGoals(id),
        ]);
        setMentorship(found);
        setSessions(sess || []);
        setGoals(g || []);
        if (!found) setLoadError('This mentorship couldn’t be found.');
      } catch (err: any) {
        setLoadError(err?.message || 'Could not load this mentorship.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  // Open the conversation for this mentorship (the 2026-11-20 mentor
  // bundle wired the dead "Message" button). Role-aware: the mentor
  // side opens the mentor messages path.
  const handleMessage = async () => {
    setMessageLoading(true);
    try {
      const convo = await messagingService.getConversationByMentorship(id);
      router.push(convo ? `${messagesBase}?conversation=${convo.id}` : messagesBase);
    } catch {
      router.push(messagesBase);
    } finally {
      setMessageLoading(false);
    }
  };

  // Item 3 — mentor decision on a student's schedule request. Approve
  // confirms the session (SCHEDULED); decline cancels it. The list is
  // re-read from the server after either, never optimistically edited.
  const handleDecideSession = async (sessionId: string, decision: 'approve' | 'decline') => {
    setSessionActionId(sessionId);
    setSessionActionError(null);
    try {
      if (decision === 'approve') await mentorshipService.approveSession(sessionId);
      else await mentorshipService.declineSession(sessionId);
      await loadSessions();
    } catch (err: any) {
      setSessionActionError(err?.message || 'Could not save that decision. Please try again.');
    } finally {
      setSessionActionId(null);
    }
  };

  const openCreateSession = () => {
    setFormTitle('');
    setFormStart('');
    setFormEnd('');
    setFormTimezone('Asia/Kolkata');
    setFormNotes('');
    setFormMeetingUrl('');
    setFormError(null);
    setSessionDialog({ mode: 'create' });
  };

  const openEditSession = (session: Session) => {
    setFormTitle(session.title);
    setFormStart(toInputValue(session.startTime));
    setFormEnd(toInputValue(session.endTime));
    setFormTimezone(session.timezone || 'Asia/Kolkata');
    setFormNotes(session.notes || '');
    setFormMeetingUrl(session.meetingUrl || '');
    setFormError(null);
    setSessionDialog({ mode: 'edit', session });
  };

  const handleSaveSession = async () => {
    const title = formTitle.trim();
    if (!title) {
      setFormError('Give the session a title.');
      return;
    }
    if (!formStart || !formEnd) {
      setFormError('Choose a start and end time.');
      return;
    }
    const start = new Date(formStart);
    const end = new Date(formEnd);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      setFormError('End time must be after start time.');
      return;
    }
    const linkError = getMeetingLinkError(formMeetingUrl);
    if (linkError) {
      setFormError(linkError);
      return;
    }
    setFormSaving(true);
    setFormError(null);
    try {
      const meetingUrl = formMeetingUrl.trim();
      if (sessionDialog?.mode === 'edit') {
        const patch: Record<string, unknown> = {
          title,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          timezone: formTimezone.trim() || 'Asia/Kolkata',
          notes: formNotes.trim(),
        };
        // Meeting link editable here too; only send it when it changed,
        // so an untouched PATCH never wipes a stored link.
        if (meetingUrl !== (sessionDialog.session.meetingUrl || '')) {
          patch.meetingUrl = meetingUrl;
        }
        await mentorshipService.updateSession(sessionDialog.session.id, patch);
      } else {
        await mentorshipService.createSession(id, {
          title,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          timezone: formTimezone.trim() || 'Asia/Kolkata',
          notes: formNotes.trim(),
          ...(meetingUrl ? { meetingUrl } : {}),
        });
      }
      await loadSessions();
      setSessionDialog(null);
    } catch (err: any) {
      setFormError(err?.message || 'Could not save the session. Please try again.');
    } finally {
      setFormSaving(false);
    }
  };

  // Escape closes the session dialog, except while saving.
  useEffect(() => {
    if (!sessionDialog || formSaving) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSessionDialog(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sessionDialog, formSaving]);

  if (loading) {
    return <div className="animate-pulse space-y-8">
      <div className="h-32 bg-gray-50 rounded-xl" />
      <div className="h-64 bg-gray-50 rounded-xl" />
    </div>;
  }

  if (!mentorship) {
    return (
      <Card className="flex flex-col items-center justify-center py-12 text-center">
        <CardContent className="pt-6">
          <h3 className="text-lg font-medium">Mentorship not found</h3>
          <p className="mt-1 max-w-sm text-sm text-lpu-text-secondary">{loadError || 'This mentorship couldn’t be found.'}</p>
          <div className="mt-6">
            <Button variant="outline" onClick={() => router.push(listBase)}>
              Back to {isMentor ? 'My Mentees' : 'My Mentorships'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Header person (Item 2): the OTHER party of the mentorship. The
  // backend now attaches both flat display objects on findOne; the
  // fallbacks below mean a genuinely missing field can never render a
  // bare " at " or an empty name again — "Mentor" / "Student" /
  // "Not provided" instead. The subtitle joins only non-empty parts,
  // so a missing company never leaves a dangling " at ".
  const mentorName = [mentorship.mentor?.firstName, mentorship.mentor?.lastName].filter(Boolean).join(' ').trim();
  const mentorSubtitle = [mentorship.mentor?.title, mentorship.mentor?.company].filter(Boolean).join(' at ');
  const studentName = [mentorship.student?.firstName, mentorship.student?.lastName].filter(Boolean).join(' ').trim();
  const studentSubtitle = [
    mentorship.student?.programme,
    mentorship.student?.school,
    mentorship.student?.graduationYear ? `Class of ${mentorship.student.graduationYear}` : null,
  ].filter(Boolean).join(' · ');
  const headerName = isMentor ? studentName || 'Student' : mentorName || 'Mentor';
  const headerSubtitle = isMentor ? studentSubtitle || 'Not provided' : mentorSubtitle || 'Not provided';
  const headerImageUrl = isMentor ? mentorship.student?.imageUrl : mentorship.mentor?.imageUrl;
  const headerInitial = headerName.charAt(0).toUpperCase();

  const nextSession =
    sessions
      .filter((s) => s.status === 'SCHEDULED' && new Date(s.startTime) > new Date())
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0] ?? null;

  return (
    <div className="space-y-6">
      {/* Header Profile Card — the other party of this mentorship (Item 2) */}
      <div className="bg-white border border-lpu-border rounded-xl p-6 flex flex-col md:flex-row items-center md:items-start gap-6 shadow-sm">
        {headerImageUrl ? (
          <img
            src={headerImageUrl}
            alt={headerName}
            className="w-24 h-24 rounded-full object-cover border-4 border-blue-50"
          />
        ) : (
          <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-4 border-blue-50 bg-blue-50 text-3xl font-bold text-blue-600" aria-hidden="true">
            {headerInitial}
          </div>
        )}
        <div className="flex-1 text-center md:text-left space-y-2">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-lpu-text-primary">
                {headerName}
              </h1>
              <p className="text-lpu-text-secondary">{headerSubtitle}</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="gap-2" onClick={handleMessage} disabled={messageLoading}>
                <MessageSquare className="w-4 h-4" /> {messageLoading ? 'Opening…' : 'Message'}
              </Button>
              <Button size="sm" className="gap-2" onClick={openCreateSession}>
                <Calendar className="w-4 h-4" /> {isMentor ? 'Schedule' : 'Request session'}
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-sm text-lpu-text-muted">
            <span className="flex items-center gap-1.5">
              <Badge variant="success" className="bg-emerald-50 text-emerald-700">Active</Badge>
            </span>
            <span>Started {new Date(mentorship.startDate).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:w-[400px]">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="goals">Goals</TabsTrigger>
          <TabsTrigger value="feedback">Feedback</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-6 mt-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Video className="w-5 h-5 text-neutral-900" /> Next Session
                </CardTitle>
              </CardHeader>
              <CardContent>
                {nextSession ? (
                  <div className="space-y-4">
                    <div className="p-4 rounded-lg bg-gray-50 border border-gray-100 flex justify-between items-center gap-3">
                      <div>
                        <p className="font-semibold text-sm">{nextSession.title}</p>
                        <p className="text-xs text-lpu-text-secondary mt-1">
                          {new Date(nextSession.startTime).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}
                          {' · '}
                          {new Date(nextSession.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {' – '}
                          {new Date(nextSession.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      {isMeetingUrl(nextSession.meetingUrl) ? (
                        <a
                          href={nextSession.meetingUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-9 shrink-0 items-center rounded-md bg-neutral-900 px-3 text-sm font-medium text-white hover:bg-neutral-800"
                        >
                          Join meeting
                        </a>
                      ) : (
                        <span className="shrink-0 text-xs text-lpu-text-muted">No meeting link yet</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-lpu-text-muted">No upcoming sessions.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="w-5 h-5 text-neutral-900" /> Current Goal
                </CardTitle>
              </CardHeader>
              <CardContent>
                 {goals.filter(g => g.status === 'IN_PROGRESS').length > 0 ? (
                  <div className="space-y-4">
                    {goals.filter(g => g.status === 'IN_PROGRESS').slice(0,1).map(goal => (
                      <div key={goal.id} className="space-y-2">
                        <div className="flex justify-between">
                          <p className="font-medium text-sm">{goal.title}</p>
                          <span className="text-xs font-semibold text-neutral-900">{goal.progress}%</span>
                        </div>
                        <Progress value={goal.progress} className="h-2" />
                        <p className="text-xs text-lpu-text-secondary mt-2">{goal.description}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-lpu-text-muted">No goals in progress.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="sessions" className="mt-6 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-lg">Session History</h3>
            <Button size="sm" onClick={openCreateSession}>{isMentor ? 'Schedule New' : 'Request session'}</Button>
          </div>
          {sessionActionError && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{sessionActionError}</span>
            </div>
          )}
          <div className="grid gap-4">
            {sessions.length === 0 && (
              <p className="text-sm text-lpu-text-muted">No sessions yet.</p>
            )}
            {sessions.map(session => (
              <Card key={session.id}>
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="h-12 w-12 rounded bg-blue-50 text-neutral-900 flex flex-col items-center justify-center shrink-0">
                      <span className="text-xs uppercase font-semibold">
                        {new Date(session.startTime).toLocaleDateString('en-US', { month: 'short' })}
                      </span>
                      <span className="font-bold leading-none">
                        {new Date(session.startTime).getDate()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold">{session.title}</p>
                      <p className="text-sm text-lpu-text-secondary">
                        {new Date(session.startTime).toLocaleDateString([], { day: 'numeric', month: 'short' })}
                        {' · '}
                        {new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {' – '}
                        {new Date(session.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      {session.status === 'SCHEDULED' && (
                        <p className="mt-1 text-xs">
                          {isMeetingUrl(session.meetingUrl) ? (
                            <a href={session.meetingUrl} target="_blank" rel="noreferrer" className="font-medium text-neutral-900 underline underline-offset-2">
                              Join meeting
                            </a>
                          ) : (
                            <span className="text-lpu-text-muted">
                              No meeting link yet{' '}
                              <button type="button" onClick={() => openEditSession(session)} className="font-medium text-neutral-900 underline underline-offset-2">
                                Add link
                              </button>
                            </span>
                          )}
                        </p>
                      )}
                      {session.status === 'REQUESTED' && (
                        <p className="mt-1 text-xs text-amber-700">
                          {isMentor
                            ? 'Session request — awaiting your decision.'
                            : 'Awaiting mentor approval — this is not a confirmed session yet.'}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant={session.status === 'COMPLETED' ? 'success' : 'secondary'} className={session.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700' : ''}>
                      {sessionStatusLabel(session.status)}
                    </Badge>
                    {session.status === 'REQUESTED' && isMentor && (
                      <>
                        <Button size="sm" onClick={() => handleDecideSession(session.id, 'approve')} disabled={sessionActionId === session.id}>
                          {sessionActionId === session.id ? 'Saving…' : 'Accept'}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleDecideSession(session.id, 'decline')} disabled={sessionActionId === session.id}>
                          Decline
                        </Button>
                      </>
                    )}
                    {session.status !== 'COMPLETED' && session.status !== 'CANCELLED' && (
                      <Button size="sm" variant="outline" onClick={() => openEditSession(session)}>Reschedule</Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="goals" className="mt-6 space-y-4">
           <div className="flex justify-between items-center">
            <h3 className="font-semibold text-lg">Action Plan</h3>
            <Button size="sm">Add Goal</Button>
          </div>
          <div className="grid gap-4">
            {goals.map(goal => (
              <Card key={goal.id}>
                <CardContent className="p-4 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold">{goal.title}</p>
                      <p className="text-sm text-lpu-text-secondary mt-1">{goal.description}</p>
                    </div>
                    {goal.status === 'COMPLETED' ? (
                      <Badge variant="success" className="bg-emerald-50 text-emerald-700"><CheckCircle2 className="w-3 h-3 mr-1"/> Done</Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-blue-50 text-neutral-900">In Progress</Badge>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-lpu-text-muted">
                      <span>Progress</span>
                      <span>{goal.progress}%</span>
                    </div>
                    <Progress value={goal.progress} className="h-2" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="feedback" className="mt-6 text-center py-12">
           <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
             <FileText className="w-6 h-6 text-lpu-text-muted" />
           </div>
           <h3 className="text-lg font-medium">Session Feedback</h3>
           <p className="text-sm text-lpu-text-secondary mt-2">Feedback records will appear here after sessions are completed.</p>
        </TabsContent>
      </Tabs>

      {sessionDialog && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="session-dialog-title"
        >
          <div aria-hidden="true" className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { if (!formSaving) setSessionDialog(null); }} />
          <div className="relative w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-5 shadow-xl outline-none">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="session-dialog-title" className="text-base font-bold text-neutral-900">
                  {sessionDialog.mode === 'edit' ? 'Reschedule session' : isMentor ? 'Schedule a session' : 'Request a session'}
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-neutral-600">
                  {headerName}
                </p>
                {sessionDialog.mode === 'create' && !isMentor && (
                  <p className="mt-1 text-sm leading-relaxed text-neutral-600">
                    Your mentor will confirm this session — it only appears as confirmed once they accept it.
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSessionDialog(null)}
                disabled={formSaving}
                aria-label="Close"
                className="shrink-0 rounded-full p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {formError && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <label className="mt-4 block text-sm font-medium text-neutral-900" htmlFor="session-title">
              Title
            </label>
            <input
              id="session-title"
              type="text"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="e.g. Resume Review"
              className="mt-1.5 h-10 w-full rounded-xl border border-neutral-300 bg-white px-4 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/20"
            />

            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-neutral-900" htmlFor="session-start">
                  Starts
                </label>
                <input
                  id="session-start"
                  type="datetime-local"
                  value={formStart}
                  onChange={(e) => setFormStart(e.target.value)}
                  className="mt-1.5 h-10 w-full rounded-xl border border-neutral-300 bg-white px-3 text-sm text-neutral-900 outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-900" htmlFor="session-end">
                  Ends
                </label>
                <input
                  id="session-end"
                  type="datetime-local"
                  value={formEnd}
                  onChange={(e) => setFormEnd(e.target.value)}
                  className="mt-1.5 h-10 w-full rounded-xl border border-neutral-300 bg-white px-3 text-sm text-neutral-900 outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/20"
                />
              </div>
            </div>

            <label className="mt-3 block text-sm font-medium text-neutral-900" htmlFor="session-timezone">
              Timezone
            </label>
            <input
              id="session-timezone"
              type="text"
              value={formTimezone}
              onChange={(e) => setFormTimezone(e.target.value)}
              placeholder="Asia/Kolkata"
              className="mt-1.5 h-10 w-full rounded-xl border border-neutral-300 bg-white px-4 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/20"
            />

            <label className="mt-3 block text-sm font-medium text-neutral-900" htmlFor="session-notes">
              Notes <span className="font-normal text-neutral-400">(optional)</span>
            </label>
            <textarea
              id="session-notes"
              value={formNotes}
              rows={2}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder="What will this session cover?"
              className="mt-1.5 w-full resize-none rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/20"
            />

            <label className="mt-3 block text-sm font-medium text-neutral-900" htmlFor="session-meeting-url">
              Meeting link <span className="font-normal text-neutral-400">(optional — paste your own Meet/Zoom link)</span>
            </label>
            <input
              id="session-meeting-url"
              type="url"
              value={formMeetingUrl}
              onChange={(e) => setFormMeetingUrl(e.target.value)}
              placeholder="https://meet.google.com/…"
              className="mt-1.5 h-10 w-full rounded-xl border border-neutral-300 bg-white px-4 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/20"
            />

            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setSessionDialog(null)}
                disabled={formSaving}
                className="rounded-full border-neutral-300 bg-white px-5 text-neutral-900 hover:bg-neutral-100"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveSession}
                disabled={formSaving}
                className="rounded-full bg-neutral-900 px-6 text-white hover:bg-neutral-800 disabled:opacity-50"
              >
                {formSaving ? 'Saving…' : sessionDialog.mode === 'edit' ? 'Save changes' : isMentor ? 'Schedule session' : 'Send request'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
