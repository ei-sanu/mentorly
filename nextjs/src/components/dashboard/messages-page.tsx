'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { MessageSquare, Send, RefreshCw, AlertCircle, Inbox, Loader2, Search, CalendarPlus } from 'lucide-react';
// NOTE (2026-11-20): Conversation and ChatMessage live in
// src/services/api.ts, NOT src/types/index.ts — import them from here.
import { messagingService, mentorshipService, mentorService, userService, type Conversation } from '@/services/api';
import type { MentorLeave, Session } from '@/types';
import {
  ScheduleMeetingDialog,
  findLeaveCoveringToday,
  formatLeaveEndDate,
} from '@/components/dashboard/schedule-meeting-dialog';
import {
  connectChatSocket,
  joinConversation,
  leaveConversation,
  sendChatMessage,
  sendTyping,
  onChatMessage,
  onChatTyping,
  onPresence,
  appendChatMessage,
  collapseDuplicateMessages,
  type DisplayChatMessage,
  type ChatPresence,
} from '@/lib/chat-socket';
import { useRoleGuard } from '@/lib/use-role-guard';
import { PageHeader, PageLoader, PageEmptyState } from '@/components/dashboard/page-primitives';

// ─── Messages (2026-11-20, Items 4 + 6) ────────────────────────────────────
// The page used to crash on any real conversation: the backend returns
// `otherUser` (no `participants` array) while this page called
// `c.participants.find(...)`. The other participant is now read from
// `c.otherUser ?? c.participants.find(...)` (defensive — the backend
// sends both). Added: last-message time in the list, name + role +
// mentorship context in the header ("Mentorship since <startDate> ·
// <status>"), sender names on incoming bubbles, a date line on the first
// message of each day, ?conversation=<id> deep-linking, and real-time
// send/receive over the /chat namespace (REST stays the source of truth
// on mount, and REST POST is the fallback when the socket send fails).
// Chat also surfaces the next session's Join meeting link in the header
// when the active mentorship has an upcoming SCHEDULED session with a
// real meetingUrl. REST loading + the manual Refresh button are kept.
//
// Own-message identity (2026-11-20, match-fix Item 4): the bubble code
// always had the alignment (`isMe = m.senderId === user?.id`, own →
// right + dark, other → left + white) but it could never be true —
// `user.id` is the CLERK id (`user_2…`, or the mock id in mock mode)
// while `m.senderId` is the backend Mongo User ObjectId string
// (messaging.service returns `senderId: m.senderId._id?.toString()`),
// so every message rendered LEFT as "received". This page now loads
// `userService.getMe()` once on mount — GET /me returns
// `id: user._id.toString()` (users.service.ts) — and compares against
// that backend id, falling back to `user?.id` when /me is unavailable.
// The same fix covers the typing-indicator filter and the defensive
// other-participant fallback (`participants[].id` are Mongo ids too).
//
// Chat fixed + instant + no duplicates (2026-11-20, Item 1): the
// doubled bubbles were DISTINCT rows, not one message rendered twice —
// the page already deduped by id, but the old client re-POSTed over
// REST when a socket echo was slow (>8s), so the second row had a
// second id no dedupe could collapse (see chat.socket.ts for the full
// root cause). Sends are now exactly-once: the server acks every
// socket send, an ack timeout GETs the thread before any POST, the
// server refuses an identical send twice within 10s, and the page
// collapses same-sender + same-content rows within 15s at render.
// Sending is optimistic: the bubble appears instantly as a pending
// temp and is replaced by the confirmed message on ack; a failed send
// stays visible with a tap-to-retry instead of vanishing. The
// double-submit guard is a synchronous ref, not React state (a rapid
// double-click used to pass the `sending` state guard twice).
//
// Presence (2026-11-20, Item 2): the other person's real presence
// from the /chat gateway — green dot + "Online" while any of their
// sockets is connected, black dot + "Offline" when the last one drops.
// Dot and word flip together with a short pop + colour transition.
// No presence event yet means UNKNOWN: nothing renders, never a
// guessed "Offline", and there is no "last seen".
//
// Meeting scheduling from chat (2026-11-20, Item 3): the mentor — and
// only the mentor — gets a "Schedule meeting" button in the header. It
// opens ScheduleMeetingDialog (date + start/end time + an optional
// pasted meeting link, future-only, http(s)-validated, never generated)
// which POSTs a real session via mentorshipService.createSession. The
// meeting surfaces to BOTH sides as an "Upcoming meetings" card rendered
// from GET /mentorships/:id/sessions — the same real record, keyed by
// session id, so one record is one card and a re-fetch can never
// duplicate it. No chat message is posted for a meeting: an announcement
// bubble would be a fake message as the mentor. The student sees the
// card and the Join link but never the schedule button. The card list
// refreshes after a save and on Refresh; there is no session event on
// the /chat namespace, so a student with the thread already open sees a
// newly scheduled meeting on their next Refresh / reopen, not by push.
//
// Leave in the chat header (2026-11-20, Item 4): when the other
// participant is a mentor with a leave covering today (the Item 5
// leaveCoversToday semantics — startDate 00:00 to endDate 23:59 local,
// end date inclusive), the header shows an amber "On leave until
// <date>" next to the presence line. Leaves come from the existing
// mentorService.getMentorLeaves(mentorProfileId); when the other user
// is a student, or no leave covers today, nothing extra renders and
// the presence line is unchanged. No leave state is ever invented.

// Presence dot + word, flipping together with a brief pop when the
// state changes (the `key` remounts both spans, replaying the
// `presence-pop` keyframes; colour cross-fades via transition).
function PresenceLabel({ online }: { online: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        key={online ? 'online' : 'offline'}
        className="inline-flex h-2 w-2 animate-[presence-pop_350ms_ease-out]"
      >
        <span
          className={`h-2 w-2 rounded-full transition-colors duration-300 ${
            online ? 'bg-emerald-500' : 'bg-neutral-900'
          }`}
        />
      </span>
      <span
        key={online ? 'online-word' : 'offline-word'}
        className="inline-block animate-[presence-pop_350ms_ease-out]"
      >
        {online ? 'Online' : 'Offline'}
      </span>
    </span>
  );
}

// A meeting link is real only when it is a non-empty http(s) URL — never
// a generated or placeholder link.
function isMeetingUrl(u?: string | null): boolean {
  return !!u && /^https?:\/\//i.test(u.trim());
}

function formatLastMessageTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${d.toLocaleDateString([], { day: 'numeric', month: 'short' })}`;
}

function humanRole(role?: string | null): string | null {
  if (!role) return null;
  return role.charAt(0) + role.slice(1).toLowerCase();
}

export function MessagesPage({ allowedRoles }: { allowedRoles: string[] }) {
  const { allowed, user } = useRoleGuard(allowedRoles);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DisplayChatMessage[]>([]);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  // Mentorship context for the active conversation's header (Item 4).
  // mentorProfileId is the id getMentorLeaves needs (Item 4); mentorUserId
  // is how the page knows whether *I* am the mentor (Item 3). Both come
  // from getMentorshipById at runtime (mentorProfile.id / .user.id) —
  // the Mentorship type only declares `mentor?`, so they are read off
  // the untyped response, never guessed from the other participant.
  const [mentorshipInfo, setMentorshipInfo] = useState<{
    startDate: string;
    status: string;
    mentorProfileId?: string;
    mentorUserId?: string;
  } | null>(null);
  // Upcoming SCHEDULED sessions for the active mentorship (Items 3 + 6):
  // the real records both sides read — rendered as meeting cards in the
  // thread, one card per session id. The header Join link is derived
  // from the first of these that carries a real meetingUrl.
  const [upcomingSessions, setUpcomingSessions] = useState<Session[]>([]);
  // The other mentor's leave covering today, if any (Item 4).
  const [currentLeave, setCurrentLeave] = useState<MentorLeave | null>(null);
  // Schedule-meeting dialog (Item 3, mentor-only).
  const [scheduleOpen, setScheduleOpen] = useState(false);
  // Typing indicator: the other participant's name while they type.
  const [typingName, setTypingName] = useState<string | null>(null);
  // Real presence by user id (Item 2): true = online, false = offline,
  // missing entry = unknown (no event yet — render nothing, never guess).
  const [presenceByUser, setPresenceByUser] = useState<Record<string, boolean>>({});
  // Synchronous double-submit guard (Item 1): React state `sending`
  // updates asynchronously, so a rapid double-click passed it twice.
  const sendInFlightRef = useRef(false);
  // Backend (Mongo) id of the signed-in user, from GET /me — see the
  // header note. `user?.id` is the Clerk id and never equals a
  // `senderId` / `participants[].id`, which are Mongo ObjectId strings.
  const [backendUserId, setBackendUserId] = useState<string | null>(null);
  // Own id for every identity comparison below: backend id when known,
  // Clerk id as fallback (same as before the fix) when /me is unavailable.
  const ownId = backendUserId ?? user?.id ?? null;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const otherNameRef = useRef('Conversation');

  const loadConversations = async (quiet = false) => {
    try {
      if (!quiet) setLoadingConvos(true);
      setError(null);
      const data = await messagingService.getConversations();
      setConversations(data || []);
      if (!activeId && data && data.length > 0) {
        // Deep-link ?conversation=<id> preselects (accept flow, workspace
        // "Message" button); otherwise the first conversation.
        const deepLinked =
          typeof window !== 'undefined'
            ? new URLSearchParams(window.location.search).get('conversation')
            : null;
        setActiveId(
          deepLinked && data.some((c) => c.id === deepLinked) ? deepLinked : data[0].id,
        );
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load conversations.');
    } finally {
      if (!quiet) setLoadingConvos(false);
    }
  };

  const loadMessages = async (conversationId: string) => {
    try {
      setLoadingMessages(true);
      const data = await messagingService.getMessages(conversationId, 100);
      // Collapse rows already doubled before the Item 1 fix (same
      // sender + content within 15s renders as one bubble).
      setMessages(collapseDuplicateMessages((data || []) as DisplayChatMessage[]));
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch (err: any) {
      setError(err.message || 'Failed to load messages.');
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    if (allowed) loadConversations();
  }, [allowed]);

  // Load the backend user id once (match-fix Item 4). getMe() is deduped
  // + 30s cached in api.ts and returns null (never throws) when the
  // backend is down or the session is invalid — then `ownId` above stays
  // on the Clerk-id fallback and the page behaves exactly as before.
  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    userService
      .getMe()
      .then((me: any) => {
        if (cancelled || !me) return;
        const id = me?.id ?? me?._id;
        if (id != null) setBackendUserId(String(id));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [allowed]);

  // Presence (Item 2): subscribe once, not per conversation — the
  // manager replays the last known state to this subscriber, so the
  // header and the list learn who is online immediately.
  useEffect(() => {
    if (!allowed) return;
    const off = onPresence((ev: ChatPresence) => {
      setPresenceByUser((prev) =>
        prev[ev.userId] === ev.online ? prev : { ...prev, [ev.userId]: ev.online },
      );
    });
    return () => {
      if (typeof off === 'function') off();
    };
  }, [allowed]);

  useEffect(() => {
    if (activeId) loadMessages(activeId);
  }, [activeId]);

  const active = conversations.find((c) => c.id === activeId);
  // Defensive: the backend sends both shapes; otherUser is authoritative.
  // The fallback compares against the BACKEND id — participants[].id are
  // Mongo ids, so the Clerk id would pick the wrong participant.
  const otherParticipant = active?.otherUser ?? active?.participants.find((p) => p.id !== ownId);
  const otherName = otherParticipant
    ? `${otherParticipant.firstName} ${otherParticipant.lastName}`.trim()
    : 'Conversation';
  otherNameRef.current = otherName;
  const otherRole = humanRole(active?.otherUser?.role);
  // The other person's presence (Item 2): boolean when known,
  // `undefined` while no presence event has arrived — render nothing.
  const otherOnline = otherParticipant?.id ? presenceByUser[otherParticipant.id] : undefined;
  // Next session's real meeting link, if any (Item 6) — derived from the
  // same upcoming-sessions list the meeting cards render (Item 3).
  const nextMeetingUrl =
    upcomingSessions.find((s) => isMeetingUrl(s.meetingUrl))?.meetingUrl ?? null;
  // Am I the mentor in this mentorship (Item 3, schedule is mentor-only)?
  // Primary: the mentorship's mentor user id vs my backend id. Fallback
  // while that is still loading: the other participant is a student.
  const isMentor =
    ownId && mentorshipInfo?.mentorUserId
      ? ownId === mentorshipInfo.mentorUserId
      : active?.otherUser?.role === 'STUDENT';

  // Upcoming sessions for the active thread (Items 3 + 6), re-runnable
  // after a meeting is scheduled and from the Refresh button.
  const loadUpcomingSessions = async (mentorshipId: string) => {
    try {
      const sess = await mentorshipService.getSessions(mentorshipId);
      const now = new Date();
      setUpcomingSessions(
        (sess || [])
          .filter((s) => s.status === 'SCHEDULED' && new Date(s.startTime) > now)
          .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()),
      );
    } catch {
      setUpcomingSessions([]);
    }
  };

  // Mentorship context + upcoming sessions + the other mentor's current
  // leave (Items 3 + 4) for the active thread.
  useEffect(() => {
    const mentorshipId = active?.mentorshipId;
    if (!mentorshipId) {
      setMentorshipInfo(null);
      setUpcomingSessions([]);
      setCurrentLeave(null);
      return;
    }
    let cancelled = false;
    void loadUpcomingSessions(mentorshipId);
    mentorshipService
      .getMentorshipById(mentorshipId)
      .then((m: any) => {
        if (cancelled || !m) return;
        // Runtime shape of findOne: `mentorProfile: { id, user: { id } }`
        // (plus `mentor` on the list path) — read all three, trust none
        // blindly; a missing id simply means no leave lookup and the
        // mentor check below falls back to the other user's role.
        const mentorProfileId =
          m?.mentorProfile?.id ?? m?.mentor?.id ?? m?.mentorProfileId?._id ?? undefined;
        const mentorUserId =
          m?.mentorProfile?.user?.id ?? m?.mentor?.userId ?? m?.mentor?.user?.id ?? undefined;
        setMentorshipInfo({
          startDate: m.startDate,
          status: m.status,
          mentorProfileId: mentorProfileId ? String(mentorProfileId) : undefined,
          mentorUserId: mentorUserId ? String(mentorUserId) : undefined,
        });
        // Leave (Item 4): only when the OTHER participant is the mentor
        // — i.e. I am not the mentor — and only with the real profile id.
        // The public endpoint returns upcoming leaves only; the
        // covers-today test below is the Item 5 day-window semantics.
        // Primary: the mentorship's mentor user id vs my backend id.
        // While /me has not resolved yet (ownId null), fall back to the
        // other participant's role — never treat "unknown own id" as
        // "I am not the mentor", or a mentor would briefly see their
        // OWN leave in the header.
        const otherIsMentor =
          ownId && mentorUserId
            ? String(mentorUserId) !== ownId
            : active?.otherUser?.role === 'MENTOR';
        if (otherIsMentor && mentorProfileId) {
          mentorService
            .getMentorLeaves(String(mentorProfileId))
            .then((leaves) => {
              if (!cancelled)
                setCurrentLeave(findLeaveCoveringToday(leaves || []) ?? null);
            })
            .catch(() => {
              if (!cancelled) setCurrentLeave(null);
            });
        } else {
          setCurrentLeave(null);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // ownId arrives after /me resolves; re-running then is what lets the
    // mentor check above compare against the real backend id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.mentorshipId, ownId]);

  // Real-time chat (Item 4): join the active conversation's room, append
  // incoming messages for it, refresh the list for other conversations,
  // and show the typing indicator. REST stays the source of truth on
  // mount; this effect only adds live updates on top.
  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    // connectChatSocket mirrors dashboardSocket.connect (Promise<Socket |
    // null)); tolerate a direct Socket return too.
    const maybeSocket = connectChatSocket() as unknown;
    const join = () => {
      if (!cancelled) joinConversation(activeId);
    };
    if (maybeSocket && typeof (maybeSocket as { then?: unknown }).then === 'function') {
      (maybeSocket as Promise<unknown>).then((socket) => {
        if (!socket || cancelled) return;
        joinConversation(activeId);
      });
    } else if (maybeSocket) {
      join();
    }
    const offMessage = onChatMessage((msg) => {
      if (msg.conversationId === activeId) {
        // One append path, one rule: appendChatMessage dedupes by id,
        // replaces a pending optimistic temp with the confirmed row,
        // and collapses a same-sender + same-content row within 15s —
        // so neither the echo nor a re-delivery can add a second bubble.
        setMessages((prev) => appendChatMessage(prev, msg as DisplayChatMessage));
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      } else {
        loadConversations(true);
      }
    });
    const offTyping = onChatTyping((event) => {
      // Compare against the backend id: with the Clerk id here, our own
      // typing events passed the filter and showed our own name typing
      // back at us.
      if (event.conversationId === activeId && event.userId !== ownId) {
        setTypingName(event.isTyping ? otherNameRef.current : null);
      }
    });
    return () => {
      cancelled = true;
      leaveConversation();
      if (typeof offMessage === 'function') offMessage();
      if (typeof offTyping === 'function') offTyping();
      setTypingName(null);
    };
  }, [activeId, ownId]);

  // Stop our own typing broadcast when leaving the thread.
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  if (!allowed) return <PageLoader message="Verifying access…" />;

  const filteredConvos = conversations.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const names = c.otherUser
      ? `${c.otherUser.firstName} ${c.otherUser.lastName}`
      : c.participants.map((p) => `${p.firstName} ${p.lastName}`).join(' ');
    return names.toLowerCase().includes(q);
  });

  const stopTypingSoon = () => {
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      if (activeId) {
        try {
          sendTyping(activeId, false);
        } catch {
          // Typing is best-effort; never break sending.
        }
      }
    }, 2500);
  };

  const handleDraftChange = (value: string) => {
    setDraft(value);
    if (activeId && value.trim()) {
      try {
        sendTyping(activeId, true);
      } catch {
        // Typing is best-effort; never break sending.
      }
      stopTypingSoon();
    }
  };

  // Send with an optimistic bubble (Item 1): the message appears
  // instantly as a pending temp, and the ack replaces the temp with
  // the confirmed row — never a second bubble. The synchronous ref
  // guard (not the `sending` state) stops a rapid double-click from
  // sending twice. A failed send stays visible with a tap-to-retry.
  const sendContent = async (content: string, existingTempId?: string) => {
    if (!activeId) return;
    if (sendInFlightRef.current) return;
    sendInFlightRef.current = true;
    const tempId =
      existingTempId ?? `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    try {
      setSending(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      try {
        sendTyping(activeId, false);
      } catch {
        // Best-effort only.
      }
      const temp: DisplayChatMessage = {
        id: tempId,
        conversationId: activeId,
        senderId: ownId ?? '',
        content,
        createdAt: new Date().toISOString(),
        pending: true,
      };
      setMessages((prev) => {
        if (existingTempId) {
          return prev.map((m) =>
            m.id === existingTempId ? { ...m, pending: true, failed: false } : m,
          );
        }
        return appendChatMessage(prev, temp);
      });
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      // sendChatMessage owns every fallback (ack -> GET check -> REST)
      // and only rejects when the send provably did not land — so the
      // page must NOT re-POST here; the old catch did, and that was
      // itself a second write of the same message.
      const sent = await sendChatMessage(activeId, content);
      setMessages((prev) =>
        appendChatMessage(prev, sent as DisplayChatMessage, { replaceTempId: tempId }),
      );
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, pending: false, failed: true } : m)),
      );
      setError(err.message || 'Failed to send message.');
    } finally {
      sendInFlightRef.current = false;
      setSending(false);
    }
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  const retrySend = (tempId: string) => {
    const temp = messages.find((m) => m.id === tempId);
    if (!temp || !activeId) return;
    void sendContent(temp.content, tempId);
  };

  const handleSend = async () => {
    if (!activeId || !draft.trim() || sending || sendInFlightRef.current) return;
    const content = draft.trim();
    setDraft('');
    await sendContent(content);
  };

  return (
    <div className="space-y-6 pb-10">
      {/* One-shot pop for the presence flip (Item 2). */}
      <style>{`@keyframes presence-pop { 0% { transform: scale(0.6); opacity: 0.4; } 100% { transform: scale(1); opacity: 1; } }`}</style>
      <PageHeader
        title="Messages"
        description="Your private conversations with mentors and mentees."
        icon={MessageSquare}
        actions={
          <Button
            variant="outline"
            onClick={() => {
              void loadConversations();
              if (active?.mentorshipId) void loadUpcomingSessions(active.mentorshipId);
            }}
            size="sm"
            className="rounded-xl"
          >
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

      <div className="grid gap-4 lg:grid-cols-[320px_1fr] h-[calc(100vh-220px)] min-h-[500px]">
        {/* Conversation List */}
        <Card className="overflow-hidden flex flex-col">
          <div className="p-4 border-b border-lpu-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-lpu-text-muted" />
              <Input
                placeholder="Search conversations…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>
          <div className="flex-1 overflow-auto">
            {loadingConvos ? (
              <PageLoader message="Loading conversations…" />
            ) : filteredConvos.length === 0 ? (
              <PageEmptyState
                message="No conversations yet"
                hint="Accepted mentorship requests will appear here."
                icon={Inbox}
              />
            ) : (
              filteredConvos.map((c) => {
                const other = c.otherUser ?? c.participants.find((p) => p.id !== ownId);
                const name = other ? `${other.firstName} ${other.lastName}` : 'Conversation';
                const isActive = c.id === activeId;
                // Presence for this conversation's other person (Item 2);
                // `undefined` while unknown — no dot, never a guess.
                const listOnline = other?.id ? presenceByUser[other.id] : undefined;
                return (
                  <button
                    key={c.id}
                    onClick={() => setActiveId(c.id)}
                    className={`w-full text-left p-4 border-b border-lpu-border hover:bg-gray-50 transition-colors ${
                      isActive ? 'bg-neutral-100/50' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative h-10 w-10 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-900 font-bold text-sm shrink-0">
                        {name.charAt(0)}
                        {listOnline !== undefined && (
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white transition-colors duration-300 ${
                              listOnline ? 'bg-emerald-500' : 'bg-neutral-900'
                            }`}
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="text-sm font-semibold truncate">{name}</p>
                          {c.lastMessage && (
                            <p className="shrink-0 text-[11px] text-lpu-text-muted">
                              {formatLastMessageTime(c.lastMessage.createdAt)}
                            </p>
                          )}
                        </div>
                        {c.lastMessage && (
                          <p className="text-xs text-lpu-text-secondary truncate">
                            {c.lastMessage.content}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </Card>

        {/* Active Conversation */}
        <Card className="flex flex-col overflow-hidden">
          {active ? (
            <>
              <div className="p-4 border-b border-lpu-border flex items-center gap-3">
                <div className="relative h-10 w-10 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-900 font-bold text-sm">
                  {otherName.charAt(0)}
                  {otherOnline !== undefined && (
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white transition-colors duration-300 ${
                        otherOnline ? 'bg-emerald-500' : 'bg-neutral-900'
                      }`}
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">
                    {otherName}
                    {otherRole && <span className="ml-2 font-normal text-lpu-text-muted">{otherRole}</span>}
                  </p>
                  <p className="text-xs text-lpu-text-muted flex items-center gap-2 flex-wrap">
                    {otherOnline !== undefined && <PresenceLabel online={otherOnline} />}
                    {otherOnline !== undefined && <span aria-hidden="true">·</span>}
                    {mentorshipInfo
                      ? `Mentorship since ${new Date(mentorshipInfo.startDate).toLocaleDateString()} · ${mentorshipInfo.status}`
                      : 'Private conversation'}
                    {currentLeave && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-medium text-amber-700">
                          On leave until {formatLeaveEndDate(currentLeave.endDate)}
                        </span>
                      </>
                    )}
                  </p>
                </div>
                {isMentor && (
                  <button
                    type="button"
                    onClick={() => setScheduleOpen(true)}
                    className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-900 hover:bg-neutral-100"
                  >
                    <CalendarPlus className="h-4 w-4" /> Schedule meeting
                  </button>
                )}
                {nextMeetingUrl && (
                  <a
                    href={nextMeetingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-9 shrink-0 items-center rounded-md bg-neutral-900 px-3 text-sm font-medium text-white hover:bg-neutral-800"
                  >
                    Join meeting
                  </a>
                )}
              </div>
              {/* Upcoming meetings (Item 3): real session records both
                  sides read — one card per session id, never a chat
                  message. The student sees the same cards; only the
                  mentor sees the Schedule button above. */}
              {upcomingSessions.length > 0 && (
                <div className="border-b border-lpu-border bg-white px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-lpu-text-muted">
                    Upcoming meetings
                  </p>
                  <div className="mt-2 space-y-2">
                    {upcomingSessions.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-neutral-900">
                            {s.title}
                          </p>
                          <p className="text-xs text-lpu-text-muted">
                            {new Date(s.startTime).toLocaleDateString([], {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}{' '}
                            ·{' '}
                            {new Date(s.startTime).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                            {' – '}
                            {new Date(s.endTime).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                        {isMeetingUrl(s.meetingUrl) ? (
                          <a
                            href={s.meetingUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-8 shrink-0 items-center rounded-md bg-neutral-900 px-3 text-xs font-medium text-white hover:bg-neutral-800"
                          >
                            Join meeting
                          </a>
                        ) : (
                          <span className="shrink-0 text-xs text-lpu-text-muted">
                            No meeting link yet
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex-1 overflow-auto p-4 space-y-3 bg-gray-50/30">
                {loadingMessages ? (
                  <PageLoader message="Loading messages…" />
                ) : messages.length === 0 ? (
                  <PageEmptyState
                    message="No messages yet"
                    hint="Start the conversation by sending a message below."
                    icon={MessageSquare}
                  />
                ) : (
                  messages.map((m, idx) => {
                    // Backend id comparison (match-fix Item 4): m.senderId
                    // is a Mongo ObjectId string — the Clerk id never
                    // matched, so own messages always rendered left.
                    // A pending optimistic temp is always mine, even
                    // before the backend id is known.
                    const isMe = m.pending === true || m.senderId === ownId;
                    const day = new Date(m.createdAt).toDateString();
                    const prevDay = idx > 0 ? new Date(messages[idx - 1].createdAt).toDateString() : null;
                    const showDate = day !== prevDay;
                    return (
                      <div key={m.id}>
                        {showDate && (
                          <div className="py-1 text-center text-[11px] text-lpu-text-muted">
                            {new Date(m.createdAt).toLocaleDateString([], {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </div>
                        )}
                        <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                          <div
                            className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                              isMe
                                ? 'bg-neutral-900 text-white'
                                : 'bg-white border border-gray-100 text-lpu-text-primary'
                            } ${m.pending ? 'opacity-70' : ''}`}
                          >
                            {!isMe && m.senderName && (
                              <p className="text-[11px] font-semibold text-lpu-text-secondary">{m.senderName}</p>
                            )}
                            <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                            <p className={`text-[10px] mt-1 ${isMe ? 'text-white/70' : 'text-lpu-text-muted'}`}>
                              {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            {m.pending && (
                              <p className={`text-[10px] mt-0.5 ${isMe ? 'text-white/60' : 'text-lpu-text-muted'}`}>
                                Sending…
                              </p>
                            )}
                            {m.failed && (
                              <button
                                type="button"
                                onClick={() => retrySend(m.id)}
                                className={`text-[11px] mt-0.5 underline ${isMe ? 'text-white/80' : 'text-lpu-text-muted'}`}
                              >
                                Not delivered — tap to retry
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                {typingName && (
                  <p className="text-xs italic text-lpu-text-muted">{typingName} is typing…</p>
                )}
                <div ref={messagesEndRef} />
              </div>
              <div className="p-4 border-t border-lpu-border">
                <form
                  onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                  className="flex items-center gap-2"
                >
                  <Input
                    value={draft}
                    onChange={(e) => handleDraftChange(e.target.value)}
                    onBlur={() => {
                      if (activeId) {
                        try {
                          sendTyping(activeId, false);
                        } catch {
                          // Best-effort only.
                        }
                      }
                    }}
                    placeholder="Type a message…"
                    className="flex-1"
                    disabled={sending}
                  />
                  <Button
                    type="submit"
                    className="bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl"
                    disabled={sending || !draft.trim()}
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <PageEmptyState
                message="Select a conversation"
                hint="Choose a conversation from the list to view messages."
                icon={MessageSquare}
              />
            </div>
          )}
        </Card>
      </div>
      {/* Schedule-meeting dialog (Item 3, mentor-only). onScheduled
          re-reads the sessions from the server — the card list is always
          the stored rows, never an optimistic local copy. */}
      <ScheduleMeetingDialog
        open={scheduleOpen}
        mentorshipId={active?.mentorshipId ?? null}
        onClose={() => setScheduleOpen(false)}
        onScheduled={() => {
          if (active?.mentorshipId) void loadUpcomingSessions(active.mentorshipId);
        }}
      />
    </div>
  );
}
