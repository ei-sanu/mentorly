'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { requestService, messagingService } from '@/services/api';
import { MentorshipRequest, MentorPublicProfile } from '@/types';
import { Clock, CheckCircle2, XCircle, AlertCircle, Ban, MessageSquare } from 'lucide-react';
import { InitialsAvatar } from '@/components/ui/initials-avatar';
import { useThemedDialogs } from '@/components/ui/themed-alert';
import { clearRequestState, requestMentorProfileId } from '@/lib/request-status';
import { AiRefinedSummary } from '@/components/mentor/AiRefinedSummary';

// ─── My Requests (visibility + cancel, 2026-11-12) ─────────────────────────
// The mentor identity on these cards used to render empty — a blank
// avatar circle and a dangling "at" — because GET /requests returned the
// raw mentor profile document (currentDesignation/currentCompany, names
// nested under `user`) while this page read MentorPublicProfile fields
// (firstName/title/company/imageUrl). The backend now maps the mentor
// through the same mapToPublicProfile as GET /mentors/:id, and this page
// still degrades gracefully: no name → "Mentor", no title/company → the
// subtitle line is omitted entirely (never a bare "at"), no photo or a
// failed photo load → the shared InitialsAvatar, never a blank circle.

function mentorDisplayName(mentor: MentorPublicProfile | null | undefined): string {
  const name = [mentor?.firstName, mentor?.lastName].filter(Boolean).join(' ').trim();
  return name || 'Mentor';
}

function mentorSubtitle(mentor: MentorPublicProfile | null | undefined): string {
  return [mentor?.title, mentor?.company].filter(Boolean).join(' at ');
}

function MentorAvatar({ mentor }: { mentor: MentorPublicProfile | null | undefined }) {
  const [imgFailed, setImgFailed] = useState(false);
  const imageUrl = mentor?.imageUrl;
  if (!imageUrl || imgFailed) {
    return (
      <InitialsAvatar
        firstName={mentor?.firstName}
        lastName={mentor?.lastName}
        className="h-12 w-12 text-base"
      />
    );
  }
  return (
    <img
      src={imageUrl}
      alt={mentorDisplayName(mentor)}
      onError={() => setImgFailed(true)}
      className="h-12 w-12 rounded-full object-cover border border-gray-100"
    />
  );
}

export default function StudentRequests() {
  const router = useRouter();
  const [requests, setRequests] = useState<MentorshipRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  // Which ACCEPTED card is resolving its conversation (Item 4).
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const { showConfirm, dialogs } = useThemedDialogs();

  async function loadRequests() {
    try {
      setLoading(true);
      setLoadError(null);
      const data = await requestService.getStudentRequests();
      setRequests(data);
    } catch (err: any) {
      setLoadError(err?.message || 'Failed to load requests. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRequests();
  }, []);

  // Item 4 — "Message mentor" on ACCEPTED cards. The conversation id is
  // NOT stored on the request: resolve it from the conversations list by
  // matching the conversation whose other participant is that mentor
  // (mentor.userId is the mentor's User id; participants are User ids).
  // No conversation found → the messages list, never a failure.
  const handleMessageMentor = async (request: MentorshipRequest) => {
    setResolvingId(request.id);
    try {
      const convos = await messagingService.getConversations();
      const mentorUserId = request.mentor?.userId;
      const match = (convos || []).find((c) => {
        if (!mentorUserId) return false;
        if (c.otherUser) return c.otherUser.id === mentorUserId;
        return c.participants.some((p) => p.id === mentorUserId);
      });
      router.push(match ? `/app/student/messages?conversation=${match.id}` : '/app/student/messages');
    } catch {
      router.push('/app/student/messages');
    } finally {
      setResolvingId(null);
    }
  };

  const handleCancel = async (request: MentorshipRequest) => {
    const mentorName = mentorDisplayName(request.mentor);
    const confirmed = await showConfirm({
      title: 'Cancel this request?',
      message: `Your mentorship request to ${mentorName} will be withdrawn. You can send a new request to this mentor later.`,
      confirmLabel: 'Cancel request',
      danger: true,
    });
    if (!confirmed) return;

    setCancellingId(request.id);
    setCancelError(null);
    try {
      await requestService.cancelRequest(request.id);
      setRequests((prev) =>
        prev.map((r) => (r.id === request.id ? { ...r, status: 'CANCELLED' as const } : r)),
      );
      // The mentor cards must clear their "Request Sent" state at once —
      // no refresh, no waiting for the next refetch.
      const mentorId = requestMentorProfileId(request);
      if (mentorId) clearRequestState(mentorId);
    } catch (err: any) {
      // The backend's own human message (e.g. only pending requests can
      // be cancelled); raw technical text is already sanitized by
      // apiFetch before it reaches this banner.
      setCancelError(err?.message || 'Could not cancel the request. Please try again.');
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="space-y-8">
      {dialogs}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-lpu-text-primary">
          My Requests
        </h1>
        <p className="text-lpu-text-secondary mt-1">
          Track the status of your mentorship applications.
        </p>
      </div>

      {cancelError && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 max-w-4xl" role="alert">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{cancelError}</span>
        </div>
      )}

      <div className="grid gap-6 max-w-4xl">
        {loading ? (
           <Card className="animate-pulse bg-gray-50 h-40" />
        ) : loadError ? (
          <Card className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-red-500 mb-4">{loadError}</p>
            <Button onClick={loadRequests} variant="outline">Retry</Button>
          </Card>
        ) : requests.length > 0 ? (
          requests.map((request) => {
            const subtitle = mentorSubtitle(request.mentor);
            return (
            <Card key={request.id} className="overflow-hidden">
              <div className="p-6 flex flex-col md:flex-row gap-6">
                <div className="flex-1 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <MentorAvatar mentor={request.mentor} />
                      <div>
                        <h3 className="font-semibold text-lg">{mentorDisplayName(request.mentor)}</h3>
                        {subtitle && (
                          <p className="text-sm text-lpu-text-secondary">{subtitle}</p>
                        )}
                      </div>
                    </div>
                    {request.status === 'PENDING' && <Badge variant="warning" className="flex items-center gap-1"><Clock className="w-3 h-3"/> Pending</Badge>}
                    {request.status === 'ACCEPTED' && <Badge variant="success" className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Accepted</Badge>}
                    {request.status === 'DECLINED' && <Badge variant="destructive" className="flex items-center gap-1"><XCircle className="w-3 h-3"/> Declined</Badge>}
                    {request.status === 'CANCELLED' && <Badge variant="outline" className="flex items-center gap-1"><Ban className="w-3 h-3"/> Cancelled</Badge>}
                    {request.status === 'EXPIRED' && <Badge variant="outline" className="flex items-center gap-1"><Clock className="w-3 h-3"/> Expired</Badge>}
                  </div>

                  <AiRefinedSummary request={request} />

                  <div>
                    <h4 className="text-xs font-semibold text-lpu-text-muted uppercase tracking-wider mb-1">Goal Focus</h4>
                    <p className="text-sm font-medium">{request.goal}</p>
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold text-lpu-text-muted uppercase tracking-wider mb-1">Your Message</h4>
                    <p className="text-sm text-lpu-text-secondary bg-gray-50 p-3 rounded-md border border-gray-100">
                      &quot;{request.message}&quot;
                    </p>
                  </div>

                  <div className="text-xs text-lpu-text-muted flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Sent {new Date(request.createdAt).toLocaleDateString()}
                  </div>
                </div>

                {request.status === 'PENDING' && (
                  <div className="flex md:flex-col gap-2 justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={() => handleCancel(request)}
                      disabled={cancellingId === request.id}
                    >
                      {cancellingId === request.id ? 'Cancelling…' : 'Cancel Request'}
                    </Button>
                  </div>
                )}

                {request.status === 'ACCEPTED' && (
                  <div className="flex md:flex-col gap-2 justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleMessageMentor(request)}
                      disabled={resolvingId === request.id}
                    >
                      <MessageSquare className="mr-2 h-4 w-4" /> {resolvingId === request.id ? 'Opening…' : 'Message mentor'}
                    </Button>
                  </div>
                )}
              </div>
            </Card>
            );
          })
        ) : (
          <Card className="flex flex-col items-center justify-center py-12 text-center">
            <h3 className="text-lg font-medium">No pending requests</h3>
            <p className="text-lpu-text-secondary mt-1">You haven&apos;t sent any mentorship requests yet.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
