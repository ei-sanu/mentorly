'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { requestService } from '@/services/api';
import { onDashboardUpdate } from '@/lib/dashboard-socket';
import type { MentorshipRequest } from '@/types';

// ─── Shared mentorship-request state (2026-11-12) ──────────────────────────
// Every mentor surface (Find Mentors, the student dashboard's recommended
// cards, the mentor profile page) must show whether the signed-in student
// already has a request with that mentor — and it must stay correct
// without a manual refresh. The request dialog used to track this in
// per-page local state, so a request sent in one place (or in an earlier
// visit) never showed on the cards.
//
// One module-level store, shared by all mounted surfaces:
//
// - Load: the first mounted surface fetches GET /requests once
//   (in-flight dedupe, 30s freshness window) and every surface reads
//   the same snapshot.
// - Immediate: sending a request marks the mentor "pending" locally the
//   moment the POST succeeds; cancelling clears it the moment the
//   cancel succeeds. No waiting for a refetch, no refresh needed.
// - Live: the backend forwards MENTORSHIP_REQUEST_* events over the
//   existing /dashboard socket (type only, no ids) to the STUDENT room;
//   each event triggers a refetch, so a mentor accepting or declining
//   in another session flips the card within seconds.
// - Fallback: window focus + tab-visible refetches cover a dropped
//   socket, and every navigation remounts the page and re-checks
//   freshness. A decision made while the socket is down therefore
//   appears on the next focus or visit at the latest — never silently
//   stale forever.
// - Sign-out clears the store (see handleSignOut in mock-auth), and a
//   local mark/clear always wins over a refetch that started earlier
//   (generation guard, same pattern as the /me cache in api.ts).

export type MentorRequestState = 'pending' | 'accepted';

/** Mentor profile id → the student's liveliest request state with them. */
export type RequestStatusMap = Record<string, MentorRequestState>;

const STALE_MS = 30_000;

const REQUEST_EVENT_TYPES = new Set([
  'MENTORSHIP_REQUEST_CREATED',
  'MENTORSHIP_REQUEST_ACCEPTED',
  'MENTORSHIP_REQUEST_DECLINED',
  'MENTORSHIP_REQUEST_CANCELLED',
]);

let snapshot: RequestStatusMap = {};
let listeners = new Set<() => void>();
let fetchedAt = 0;
let inflight: Promise<void> | null = null;
let generation = 0;

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): RequestStatusMap {
  return snapshot;
}

/**
 * The mentor profile id a request belongs to. GET /requests returns the
 * mapped `mentor.id` (the profile id, the same id the recommendation
 * cards carry); fall back to the raw `mentorId` field, which may be a
 * string id or a populated document.
 */
export function requestMentorProfileId(request: MentorshipRequest): string | null {
  const mentor = (request as { mentor?: { id?: string } }).mentor;
  if (mentor?.id) return String(mentor.id);
  const raw: unknown = (request as unknown as { mentorId?: unknown }).mentorId;
  if (!raw) return null;
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'object' && raw !== null && '_id' in raw) {
    return String((raw as { _id: unknown })._id);
  }
  return String(raw);
}

function buildMap(requests: MentorshipRequest[]): RequestStatusMap {
  const map: RequestStatusMap = {};
  for (const request of requests) {
    const mentorId = requestMentorProfileId(request);
    if (!mentorId) continue;
    // A mentor can hold several requests over time (an old declined one
    // plus a new pending one): pending outranks accepted, and anything
    // decided-and-closed (declined/cancelled/expired) leaves no state.
    if (request.status === 'PENDING') {
      map[mentorId] = 'pending';
    } else if (request.status === 'ACCEPTED' && map[mentorId] !== 'pending') {
      map[mentorId] = 'accepted';
    }
  }
  return map;
}

/** Refetch the student's requests unless the snapshot is still fresh. */
export async function refreshRequestStatus(force = false): Promise<void> {
  const now = Date.now();
  if (!force && fetchedAt > 0 && now - fetchedAt < STALE_MS) return;
  if (inflight) return inflight;
  const startedGeneration = generation;
  inflight = (async () => {
    try {
      const requests = await requestService.getStudentRequests();
      // A local mark/clear that landed while this fetch was in flight
      // is newer than this response — never overwrite it.
      if (startedGeneration !== generation) return;
      snapshot = buildMap(requests);
      fetchedAt = Date.now();
      emit();
    } catch (err) {
      // Silent: the cards stay usable on the last known state, and the
      // next focus/visit retries. The detail stays in the console.
      console.error('[request-status] failed to refresh request state:', err);
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** The request dialog calls this the moment a send succeeds. */
export function markRequestSent(mentorId: string): void {
  generation++;
  if (snapshot[mentorId] === 'pending') return;
  snapshot = { ...snapshot, [mentorId]: 'pending' };
  emit();
}

/** The My Requests cancel flow calls this the moment a cancel succeeds. */
export function clearRequestState(mentorId: string): void {
  generation++;
  if (!(mentorId in snapshot)) return;
  const next = { ...snapshot };
  delete next[mentorId];
  snapshot = next;
  emit();
}

/** Sign-out: the next signed-in user must never see this state. */
export function invalidateRequestStatusCache(): void {
  generation++;
  snapshot = {};
  fetchedAt = 0;
  inflight = null;
  emit();
}

/**
 * Read the shared request-state snapshot. Pass `enabled` false for
 * non-student roles: GET /requests answers other roles with other
 * people's requests, which must never mark a mentor card.
 */
export function useMentorRequestStatus(enabled: boolean): RequestStatusMap {
  const map = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    if (!enabled) return;
    refreshRequestStatus();

    const onFocus = () => {
      refreshRequestStatus();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refreshRequestStatus();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    const unsubscribeSocket = onDashboardUpdate((event) => {
      if (REQUEST_EVENT_TYPES.has(event.type)) refreshRequestStatus();
    });

    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      unsubscribeSocket();
    };
  }, [enabled]);

  return map;
}
