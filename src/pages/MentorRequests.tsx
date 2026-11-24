'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Clock, User, MessageSquare } from 'lucide-react';
import { requestService } from '@/services/api';
import { MentorshipRequest } from '@/types';
import { useThemedDialogs } from '@/components/ui/themed-alert';
import { AiRefinedSummary } from '@/components/mentor/AiRefinedSummary';
import { RequestDetailDialog } from '@/components/mentor/RequestDetailDialog';

// Same fix as MentorDashboard (2026-11-20): the backend used to leak the
// populated student User document into `studentId`, so calling .slice()
// on it threw "slice is not a function". The
// backend now sends `studentId` as a string AND the populated `student`
// object — the name comes from the student object, with a safe fallback.
function studentDisplayName(request: MentorshipRequest): string {
  const name = [request.student?.firstName, request.student?.lastName].filter(Boolean).join(' ').trim();
  if (name) return name;
  const idText = typeof request.studentId === 'string' ? request.studentId : String(request.studentId ?? '');
  return idText ? `Student ${idText.slice(0, 6)}` : 'Student';
}

export default function MentorRequests() {
  const router = useRouter();
  const [requests, setRequests] = useState<MentorshipRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  // Themed modal dialogs (replaces native alert(), 2026-11-11).
  const { showAlert, dialogs } = useThemedDialogs();
  // Request open in the detail dialog (Item 3), if any.
  const [selectedRequest, setSelectedRequest] = useState<MentorshipRequest | null>(null);
  // conversationId per request accepted in this session (Item 4) — from
  // the accept response. Older ACCEPTED rows have none: their Message
  // action opens the messages list instead of failing.
  const [acceptedConvos, setAcceptedConvos] = useState<Record<string, string>>({});

  useEffect(() => {
    loadRequests();
  }, []);

  async function loadRequests() {
    try {
      setLoading(true);
      setError(null);
      const data = await requestService.getMentorRequests();
      setRequests(data);
    } catch (err) {
      setError('Failed to load requests. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

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
        setRequests((prev) => prev.map((r) => (r.id === fresh.id ? fresh : r)));
      })
      .catch(() => undefined);
  };

  const handleAccept = async (id: string): Promise<boolean> => {
    setActionLoading(id + '-accept');
    try {
      const result = await requestService.acceptRequest(id);
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'ACCEPTED' as const } : r));
      if (result?.conversationId) {
        setAcceptedConvos(prev => ({ ...prev, [id]: result.conversationId as string }));
      }
      return true;
    } catch (err: any) {
      showAlert(err.message || 'Failed to accept request', { tone: 'error' });
      return false;
    } finally {
      setActionLoading(null);
    }
  };

  const handleDecline = async (id: string): Promise<boolean> => {
    setActionLoading(id + '-decline');
    try {
      await requestService.declineRequest(id);
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'DECLINED' as const } : r));
      return true;
    } catch (err: any) {
      showAlert(err.message || 'Failed to decline request', { tone: 'error' });
      return false;
    } finally {
      setActionLoading(null);
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

  const pendingCount = requests.filter(r => r.status === 'PENDING').length;

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
          Mentorship Requests
        </h1>
        <p className="text-lpu-text-secondary mt-1">
          Review and manage requests from students.
          {pendingCount > 0 && (
            <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-900 text-white">
              {pendingCount} pending
            </span>
          )}
        </p>
      </div>

      <div className="grid gap-6 max-w-4xl">
        {loading ? (
          Array(2).fill(0).map((_, i) => (
            <Card key={i} className="animate-pulse bg-gray-50 h-48" />
          ))
        ) : error ? (
          <Card className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-red-500 mb-4">{error}</p>
            <Button onClick={loadRequests} variant="outline">Retry</Button>
          </Card>
        ) : requests.length === 0 ? (
          <Card className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center mb-4">
              <CheckCircle2 className="h-6 w-6 text-neutral-900" />
            </div>
            <h3 className="text-lg font-medium">No requests yet</h3>
            <p className="text-lpu-text-secondary mt-1">When students send mentorship requests, they&apos;ll appear here.</p>
          </Card>
        ) : (
          requests.map((request) => (
            <Card key={request.id} className="overflow-hidden">
              <div className="p-6 flex flex-col md:flex-row gap-6">
                <div className="flex-1 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      {request.mentor?.imageUrl ? (
                        <img
                          src={request.mentor.imageUrl}
                          alt={request.mentor.firstName}
                          className="h-12 w-12 rounded-full object-cover border border-gray-100"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center">
                          <User className="h-6 w-6 text-gray-400" />
                        </div>
                      )}
                      <div>
                        <h3 className="font-semibold text-lg">
                          {studentDisplayName(request)}
                        </h3>
                        <p className="text-sm text-lpu-text-secondary">
                          {request.studentProfile?.programme || 'Not provided'}
                        </p>
                      </div>
                    </div>
                    {request.status === 'PENDING' && (
                      <Badge variant="warning" className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Pending
                      </Badge>
                    )}
                    {request.status === 'ACCEPTED' && (
                      <Badge variant="success" className="flex items-center gap-1 bg-emerald-50 text-emerald-700 border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" /> Accepted
                      </Badge>
                    )}
                    {request.status === 'DECLINED' && (
                      <Badge variant="destructive" className="flex items-center gap-1">
                        <XCircle className="w-3 h-3" /> Declined
                      </Badge>
                    )}
                  </div>

                  <AiRefinedSummary request={request} />

                  <div>
                    <h4 className="text-xs font-semibold text-lpu-text-muted uppercase tracking-wider mb-1">Target Goal</h4>
                    <p className="text-sm font-medium">{request.goal}</p>
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold text-lpu-text-muted uppercase tracking-wider mb-1">Message</h4>
                    <p className="text-sm text-lpu-text-secondary bg-gray-50 p-3 rounded-md border border-gray-100">
                      &quot;{request.message}&quot;
                    </p>
                  </div>

                  <div className="text-xs text-lpu-text-muted flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Received {new Date(request.createdAt).toLocaleDateString()}
                  </div>
                </div>

                {request.status === 'PENDING' && (
                  <div className="flex md:flex-col gap-2 justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openRequestDetail(request)}
                    >
                      View
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleAccept(request.id)}
                      disabled={actionLoading === request.id + '-accept'}
                    >
                      {actionLoading === request.id + '-accept' ? 'Accepting...' : 'Accept Request'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDecline(request.id)}
                      disabled={actionLoading === request.id + '-decline'}
                    >
                      {actionLoading === request.id + '-decline' ? 'Declining...' : 'Decline'}
                    </Button>
                  </div>
                )}

                {request.status === 'ACCEPTED' && (
                  <div className="flex md:flex-col gap-2 justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        router.push(
                          acceptedConvos[request.id]
                            ? `/app/mentor/messages?conversation=${acceptedConvos[request.id]}`
                            : '/app/mentor/messages',
                        )
                      }
                    >
                      <MessageSquare className="mr-2 h-4 w-4" /> Message {studentDisplayName(request)}
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
