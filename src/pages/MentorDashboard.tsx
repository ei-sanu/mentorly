'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useUser } from '@/lib/mock-auth';
import { requestService, mentorshipService, mentorService } from '@/services/api';
import { MentorshipRequest, Mentorship } from '@/types';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Users, Clock, Calendar, CheckCircle2, MessageSquare, X } from 'lucide-react';
import { useThemedDialogs } from '@/components/ui/themed-alert';
import { AiRefinedSummary } from '@/components/mentor/AiRefinedSummary';
import { RequestDetailDialog } from '@/components/mentor/RequestDetailDialog';
import { onDashboardUpdate } from '@/lib/dashboard-socket';

// The backend used to leak the populated student User document into
// `studentId`, so calling .slice() on it threw "slice is not a
// function" and crashed this whole page (2026-11-20). The backend now
// sends `studentId` as a string AND the populated `student` object —
// the name comes from the student object, with a safe fallback that can
// never throw even if the id arrives in an unexpected shape.
function studentDisplayName(req: MentorshipRequest): string {
  const name = [req.student?.firstName, req.student?.lastName].filter(Boolean).join(' ').trim();
  if (name) return name;
  const idText = typeof req.studentId === 'string' ? req.studentId : String(req.studentId ?? '');
  return idText ? `Student ${idText.slice(0, 6)}` : 'Student';
}

export default function MentorDashboard() {
  const { user } = useUser();
  const router = useRouter();
  const [pendingRequests, setPendingRequests] = useState<MentorshipRequest[]>([]);
  const [mentorships, setMentorships] = useState<Mentorship[]>([]);
  const [mentorProfile, setMentorProfile] = useState<{ capacity: { max: number; current: number } } | null>(null);
  const [loading, setLoading] = useState(true);
  // Themed modal dialogs (replaces native alert(), 2026-11-11).
  const { showAlert, dialogs } = useThemedDialogs();
  // Request open in the detail dialog (Item 3), if any.
  const [selectedRequest, setSelectedRequest] = useState<MentorshipRequest | null>(null);
  // Just-accepted request (Item 4): after an accept, offer a direct
  // "Message <student>" action. conversationId comes from the accept
  // response; null → the messages list instead of failing.
  const [justAccepted, setJustAccepted] = useState<{ name: string; conversationId: string | null } | null>(null);

  // Item 2 — the load effect used to depend on [user], but useUser()
  // builds a fresh user object every render, so the effect re-fired
  // after every render and its own setState kept the loop going
  // (three endpoints every ~1s, no timer anywhere). The dependency is
  // now the stable user id string. Refetch is event-driven only: the
  // /dashboard socket (MENTORSHIP_REQUEST_* events) plus window focus /
  // tab-visible, the same pattern as src/lib/request-status.ts. No
  // setInterval. A `cancelled` flag keeps an in-flight response from
  // setting state after unmount.
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    async function loadDashboard() {
      try {
        const [requests, activeMentorships, profile] = await Promise.all([
          requestService.getMentorRequests(),
          mentorshipService.getActiveMentorships(),
          mentorService.getMyProfile(),
        ]);
        if (cancelled) return;
        setPendingRequests(requests.filter(r => r.status === 'PENDING'));
        setMentorships(activeMentorships);
        setMentorProfile(profile as any);
      } catch (err) {
        if (!cancelled) console.error('Failed to load mentor dashboard:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadDashboard();
    const unsubscribeSocket = onDashboardUpdate((event) => {
      if (event.type.startsWith('MENTORSHIP_REQUEST_')) loadDashboard();
    });
    const onFocus = () => loadDashboard();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') loadDashboard();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      unsubscribeSocket();
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [user?.id]);

  // Open the detail dialog instantly from the already-loaded list item,
  // then refresh the AI fields in the background — a refinement lands
  // ~10s after the request is created, so the list copy can be stale.
  const openRequestDetail = (req: MentorshipRequest) => {
    setSelectedRequest(req);
    requestService
      .getRequestById(req.id)
      .then((fresh) => {
        if (!fresh) return;
        setSelectedRequest((prev) => (prev && prev.id === fresh.id ? fresh : prev));
        setPendingRequests((prev) => prev.map((r) => (r.id === fresh.id ? fresh : r)));
      })
      .catch(() => undefined);
  };

  const handleAccept = async (id: string): Promise<boolean> => {
    try {
      const result = await requestService.acceptRequest(id);
      const req = pendingRequests.find((r) => r.id === id);
      setPendingRequests(prev => prev.filter(r => r.id !== id));
      setJustAccepted({
        name: req ? studentDisplayName(req) : 'Student',
        conversationId: result?.conversationId ?? null,
      });
      return true;
    } catch (err: any) {
      showAlert(err.message || 'Failed to accept request', { tone: 'error' });
      return false;
    }
  };

  const handleDecline = async (id: string): Promise<boolean> => {
    try {
      await requestService.declineRequest(id);
      setPendingRequests(prev => prev.filter(r => r.id !== id));
      return true;
    } catch (err: any) {
      showAlert(err.message || 'Failed to decline request', { tone: 'error' });
      return false;
    }
  };

  // Dialog Accept/Decline (Item 3): same handlers as the cards; on success
  // close the dialog and update the list the same way the cards do.
  const handleAcceptFromDialog = async () => {
    if (!selectedRequest) return;
    const ok = await handleAccept(selectedRequest.id);
    if (ok) setSelectedRequest(null);
  };

  const handleDeclineFromDialog = async () => {
    if (!selectedRequest) return;
    const ok = await handleDecline(selectedRequest.id);
    if (ok) setSelectedRequest(null);
  };

  if (!user) return null;

  const capacity = mentorProfile?.capacity;

  return (
    <div className="space-y-8">
      {dialogs}
      {selectedRequest !== null && (
        <RequestDetailDialog
          request={selectedRequest}
          open
          onClose={() => setSelectedRequest(null)}
          onAccept={handleAcceptFromDialog}
          onDecline={handleDeclineFromDialog}
        />
      )}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-lpu-text-primary">
          Welcome back, {user.firstName}
        </h1>
        <p className="text-lpu-text-secondary mt-1">
          Manage your mentees and mentorship requests.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Active Mentees</CardTitle>
            <Users className="h-4 w-4 text-lpu-text-muted" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-8 bg-gray-100 rounded animate-pulse" />
            ) : (
              <div className="text-2xl font-bold">
                {mentorships.length}{' '}
                {capacity && (
                  <span className="text-sm font-normal text-lpu-text-muted">/ {capacity.max} capacity</span>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
            <Clock className="h-4 w-4 text-lpu-text-muted" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-8 bg-gray-100 rounded animate-pulse" />
            ) : (
              <div className="text-2xl font-bold">{pendingRequests.length}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Total Mentorships</CardTitle>
            <Calendar className="h-4 w-4 text-lpu-text-muted" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-8 bg-gray-100 rounded animate-pulse" />
            ) : (
              <div className="text-2xl font-bold">{mentorships.length}</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        {/* Pending Requests */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold tracking-tight">Pending Requests</h2>
            <Link href="/app/mentor/requests">
              <Button variant="ghost" size="sm" className="text-neutral-900">
                View all <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>

          {justAccepted && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <p className="text-sm text-emerald-700">
                Request accepted — you can now message {justAccepted.name}.
              </p>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  size="sm"
                  onClick={() =>
                    router.push(
                      justAccepted.conversationId
                        ? `/app/mentor/messages?conversation=${justAccepted.conversationId}`
                        : '/app/mentor/messages',
                    )
                  }
                >
                  <MessageSquare className="mr-2 h-4 w-4" /> Message {justAccepted.name}
                </Button>
                <button
                  type="button"
                  onClick={() => setJustAccepted(null)}
                  aria-label="Dismiss"
                  className="rounded-full p-1 text-emerald-700 hover:bg-emerald-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <Card className="animate-pulse bg-gray-50 h-48" />
          ) : pendingRequests.length === 0 ? (
            <Card className="flex flex-col items-center justify-center py-10 text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-2" />
              <p className="text-lpu-text-secondary text-sm">No pending requests</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {pendingRequests.slice(0, 3).map((req) => (
                <Card key={req.id} className="overflow-hidden">
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-sm">
                          {studentDisplayName(req)}
                        </p>
                        <p className="text-xs text-lpu-text-secondary">
                          {req.studentProfile?.programme || 'Not provided'}
                        </p>
                      </div>
                      <Badge variant="warning" className="text-xs flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Pending
                      </Badge>
                    </div>
                    <AiRefinedSummary request={req} compact />
                    <p className="text-xs text-lpu-text-secondary bg-gray-50 p-2 rounded mb-3 line-clamp-2">
                      &quot;{req.message}&quot;
                    </p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => openRequestDetail(req)}>
                        View
                      </Button>
                      <Button size="sm" className="flex-1" onClick={() => handleAccept(req.id)}>
                        Accept
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => handleDecline(req.id)}>
                        Decline
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Active Mentorships */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold tracking-tight">Active Mentorships</h2>
            <Link href="/app/mentor/mentees">
              <Button variant="ghost" size="sm" className="text-neutral-900">
                View all <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>

          {loading ? (
            <Card className="animate-pulse bg-gray-50 h-48" />
          ) : mentorships.length === 0 ? (
            <Card className="flex flex-col items-center justify-center py-10 text-center">
              <p className="text-lpu-text-secondary text-sm">No active mentorships yet</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {mentorships.slice(0, 3).map((mentorship) => {
                // (2026-11-20, workspace slice Item 2) The backend now
                // attaches the flat `student` display object on the
                // MENTOR branch; fall back to the bare "Student" only
                // when no name is stored at all.
                const menteeName = [mentorship.student?.firstName, mentorship.student?.lastName].filter(Boolean).join(' ').trim() || 'Student';
                return (
                <Card key={mentorship.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold">
                        {menteeName}
                      </CardTitle>
                      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
                        Active
                      </Badge>
                    </div>
                    <CardDescription className="text-xs">
                      Started {new Date(mentorship.startDate).toLocaleDateString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <Button variant="outline" size="sm" className="w-full" onClick={() => router.push(`/app/mentor/mentorships/${mentorship.id}`)}>
                      Go to Workspace <ArrowRight className="ml-1 h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
