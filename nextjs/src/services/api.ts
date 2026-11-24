import { MentorPublicProfile, MentorMatch, MentorshipRequest, Mentorship, Session, Goal, AvailabilitySlot, MentorLeave, CalendarNote } from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

/**
 * Wait up to `maxMs` for window.Clerk.session to be ready, then return a JWT.
 * Clerk sets window.Clerk synchronously when its script loads, but session
 * is populated asynchronously after the OAuth redirect completes.
 */
async function getClerkToken(maxMs = 3000): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  // Mock login: mock-auth treats mock_user_token as the signed-in flag, so
  // the API layer must do the same — checking only mock_user_email left
  // mock-signed-in users sending no token at all (backend 401 on /me).
  const mockToken = localStorage.getItem('mock_user_token');
  const mockEmail = localStorage.getItem('mock_user_email');
  if (mockToken || mockEmail) {
    const email = mockEmail || 'someshranjanbiswal13678@gmail.com';
    const activeRole = localStorage.getItem('active_role') || 'ADMIN';
    return `mock_token_${email}_role${activeRole}`;
  }

  // Tracked so a failed token fetch can say WHY /me is about to 401:
  // a session that exists but yields no token is a real bug, while no
  // session at all just means signed out.
  let sessionSeen = false;
  const poll = async (elapsed = 0): Promise<string | null> => {
    const clerk = (window as any).Clerk;
    // Clerk finished loading with no session: signed out — stop polling
    // instead of waiting the full 3s on every call and then hitting the
    // backend unauthenticated.
    if (clerk?.loaded && !clerk.session) return null;
    if (clerk?.session) {
      sessionSeen = true;
      try {
        const token = await clerk.session.getToken();
        if (token) return token;
      } catch {
        // session exists but token not ready yet — fall through to retry
      }
    }
    if (elapsed >= maxMs) return null;
    await new Promise(r => setTimeout(r, 150));
    return poll(elapsed + 150);
  };

  const token = await poll();
  if (!token && sessionSeen) {
    console.warn(
      '[api] Clerk session exists but getToken() returned no token — the next /me call goes out with no Authorization header and will 401.'
    );
  }
  return token;
}

// API Fetch helper — resolves the auth token, then delegates.
async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  // Always try to attach the Clerk JWT — wait briefly for session on first load
  const token = await getClerkToken();
  return apiFetchWithToken<T>(path, options, token);
}

// ─────────────────────────────────────────────────
// HUMAN-FRIENDLY ERROR MESSAGES (2026-11-12)
// ─────────────────────────────────────────────────
// Every service call in this file funnels through apiFetch, and several
// surfaces show the thrown message verbatim (e.g. the Request
// Mentorship dialog). The backend now guards malformed ids and converts
// CastError/BSONError to plain wording, but this is the last line of
// defence: if a raw technical message ever slips through — a Mongoose
// cast failure ("input must be a 24 character hex string..."), a
// BSON/ObjectId leak, a duplicate-key dump, a JS runtime error — the
// user sees a plain sentence instead, and the raw text goes to the
// console for debugging. The backend's own human messages (capacity,
// duplicate request, 3-pending limit, "complete your career profile",
// auth diagnostics) do not match these patterns and pass through
// untouched.
const TECHNICAL_ERROR_PATTERNS = [
  /hex string/i, // BSON ObjectId constructor error
  /objectid/i,
  /cast to/i, // Mongoose CastError ("Cast to ObjectId failed...")
  /\bbson\b/i,
  /mongoose/i,
  /validation failed/i, // Mongoose ValidationError dumps
  /duplicate key/i,
  /E11000/,
  /cannot read propert/i, // JS runtime leaks
  /is not a function/i,
  /undefined is not/i,
  /^http error! status:/i, // the fallback itself — word it by status
  /internal server error/i,
  /an unexpected error occurred/i,
];

function toUserFriendlyErrorMessage(rawMessage: string, status: number): string {
  const technical = TECHNICAL_ERROR_PATTERNS.some((pattern) => pattern.test(rawMessage));
  if (!technical) return rawMessage;
  console.error('[api] backend error, sanitized for display:', rawMessage);
  if (status === 404) {
    return "We couldn't find what you were looking for. It may have been removed.";
  }
  if (status === 400) {
    return 'That didn’t look right. Please check and try again.';
  }
  return 'Something went wrong on our end. Please try again in a moment.';
}

// Same fetch, with a pre-resolved token: lets getMe() resolve the token
// once and reuse it as both cache key and Authorization header, instead
// of polling for the Clerk session twice per call.
async function apiFetchWithToken<T>(path: string, options: RequestInit, token: string | null): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as any),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await (async () => {
    try {
      return await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers,
      });
    } catch {
      // The backend is down (or unreachable): fail with a clear message
      // instead of a raw TypeError, so the page stays usable.
      throw new Error(
        `Could not reach the Mentorly server at ${API_BASE_URL}. Start the backend first (Terminal 1: npm run server in alumninetwork/backend) and try again.`
      );
    }
  })();

  // Some error responses have an empty body — never let JSON parsing
  // throw a second, confusing error on top of the real one.
  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    const rawMessage = json?.error?.message || json?.message || `HTTP error! status: ${response.status}`;
    throw new Error(toUserFriendlyErrorMessage(rawMessage, response.status));
  }

  // Handle standard response wrapper { success: true, data: T }
  return (json.data ?? json) as T;
}

// ─────────────────────────────────────────────────
// GET /me DEDUPE + SHORT CACHE (2026-11-12, /me spam fix)
// ─────────────────────────────────────────────────
// Several pages call userService.getMe() from effects whose deps are
// fresh objects on every render (the useRouter shim returns a new
// object per render; mock-auth's `user` is rebuilt per render), so one
// logical "load the user" could fire GET /me over and over — 11 calls
// in ~7s were observed on /onboarding/status. Each /me costs the
// backend a full Clerk JWKS verify + Clerk API lookup + 3 Mongo
// queries, so the service layer now collapses repeats:
//
// - In-flight dedupe: concurrent getMe() calls for the same session
//   share one network request and one promise.
// - 30s cache: a fresh getMe() result is reused for 30 seconds.
// - The cache is keyed by the auth token, so a different signed-in
//   user never sees another user's cached profile, and a token
//   refresh naturally misses. Failed (null) results are never cached.
// - invalidateGetMeCache() clears both. It is called on sign-out
//   (mock-auth handleSignOut — the single sign-out choke point) and
//   after every write that changes what /me returns (updateMe,
//   submitOnboarding, profile/career updates below), so the next
//   getMe() after a mutation always hits the network.
// - getMe({ forceRefresh: true }) skips the cache read (manual
//   Refresh buttons); it still joins an in-flight request.
const GET_ME_CACHE_TTL_MS = 30_000;

type GetMeCacheEntry = { key: string; data: any; fetchedAt: number };
type GetMeInflightEntry = { key: string | null; promise: Promise<any> };

let getMeCache: GetMeCacheEntry | null = null;
let getMeInflight: GetMeInflightEntry | null = null;
let getMeCacheGeneration = 0;

export function invalidateGetMeCache(): void {
  getMeCache = null;
  getMeInflight = null;
  // Bumps the generation so a request that was already in flight when
  // this ran does not repopulate the cache with pre-invalidation data.
  getMeCacheGeneration++;
}

// ─────────────────────────────────────────────────
// GENERIC DEDUPED + SHORT-CACHED FETCH (2026-11-20, Item 2)
// ─────────────────────────────────────────────────
// The getMe dedupe above fixed the /me spam, but the mentor dashboard
// trio (/mentors/me, /mentorships, /requests) kept firing once per
// render — its load effect depends on a `user` object that mock-auth
// rebuilds on every render. This is the same machinery factored out
// into one small generic helper so the three sibling calls get the
// same treatment without three copies of the getMe code:
//
// - In-flight dedupe: concurrent calls for the same key share one
//   network request and one promise.
// - 30s cache: a fresh result is reused for 30 seconds (same window
//   as getMe / request-status).
// - The cache is keyed by the auth token, so a different signed-in
//   user never sees another user's cached data, and a token refresh
//   naturally misses. No token (signed out) skips the cache entirely.
// - Generation guard: a result invalidated mid-flight does not
//   repopulate the cache with pre-invalidation data.
// - Failures and nulls are never cached.
// - invalidateDedupedCache(key) clears one entry. Named wrappers
//   below are the call sites' invalidation points.
const DEDUPED_CACHE_TTL_MS = 30_000;

type DedupedCacheEntry = { key: string; data: any; fetchedAt: number };
type DedupedInflightEntry = { key: string | null; promise: Promise<any> };

const dedupedCache = new Map<string, DedupedCacheEntry>();
const dedupedInflight = new Map<string, DedupedInflightEntry>();
let dedupedCacheGeneration = 0;

function invalidateDedupedCache(key: string): void {
  dedupedCache.delete(key);
  dedupedInflight.delete(key);
  // Bumps the generation so a request that was already in flight when
  // this ran does not repopulate the cache with pre-invalidation data.
  dedupedCacheGeneration++;
}

/** Drop the cached mentor-profile entry (mentorService.getMyProfile). */
export function invalidateMentorProfileCache(): void {
  invalidateDedupedCache('mentor-profile');
}

/** Drop the cached mentor-requests entry (requestService.getMentorRequests). */
export function invalidateMentorRequestsCache(): void {
  invalidateDedupedCache('mentor-requests');
}

async function dedupedCached<T>(key: string, fetcher: (token: string | null) => Promise<T>): Promise<T> {
  const token = await getClerkToken();
  // Signed out: no cache, same as getMe — just run the fetch.
  if (!token) return fetcher(token);
  const now = Date.now();
  const cached = dedupedCache.get(key);
  if (cached && cached.key === token && now - cached.fetchedAt < DEDUPED_CACHE_TTL_MS) {
    return cached.data as T;
  }
  // `return await` on purpose: a rejected shared promise must land in
  // the caller's catch instead of throwing at an un-awaited promise.
  const inflight = dedupedInflight.get(key);
  if (inflight && inflight.key === token) {
    return (await inflight.promise) as T;
  }
  const generation = dedupedCacheGeneration;
  const entry: DedupedInflightEntry = {
    key: token,
    promise: (async () => {
      try {
        const data = await fetcher(token);
        // Cache only successful, non-null results, and only if nothing
        // invalidated the cache while we were in flight.
        if (data != null && generation === dedupedCacheGeneration) {
          dedupedCache.set(key, { key: token, data, fetchedAt: Date.now() });
        }
        return data;
      } finally {
        if (dedupedInflight.get(key) === entry) dedupedInflight.delete(key);
      }
    })(),
  };
  dedupedInflight.set(key, entry);
  return (await entry.promise) as T;
}

// ─────────────────────────────────────────────────
// MENTOR SERVICE
// ─────────────────────────────────────────────────
export const mentorService = {
  getRecommendedMentors: async (): Promise<MentorMatch[]> => {
    return apiFetch<MentorMatch[]>('/recommendations/mentors');
  },

  // ── Refresh recommendations (2026-11-20, workspace slice Item 5) ───
  // Busts the 1h recommendations cache (POST /recommendations/
  // recalculate invalidates ALL cached lists server-side) so the next
  // getRecommendedMentors() recomputes fresh — a re-render of the
  // stale list is not a refresh. Returns the backend's acknowledgement.
  recalculateRecommendations: async (): Promise<{ success: boolean; message?: string }> => {
    return apiFetch<{ success: boolean; message?: string }>('/recommendations/recalculate', {
      method: 'POST',
    });
  },

  searchMentors: async (query: string): Promise<MentorPublicProfile[]> => {
    return apiFetch<MentorPublicProfile[]>(`/mentors?search=${encodeURIComponent(query)}`);
  },

  getMentorById: async (id: string): Promise<MentorPublicProfile | null> => {
    try {
      return await apiFetch<MentorPublicProfile>(`/mentors/${id}`);
    } catch {
      return null;
    }
  },

  // Get mentor's own profile — deduped + 30s cached (Item 2): the
  // mentor dashboard's load effect re-fires per render, and this was
  // one of the three calls spamming the backend log every second.
  getMyProfile: async (): Promise<any | null> => {
    try {
      return await dedupedCached<any | null>('mentor-profile', (token) =>
        apiFetchWithToken<any>('/mentors/me', {}, token)
      );
    } catch {
      return null;
    }
  },

  updateMyProfile: async (data: Record<string, any>): Promise<any> => {
    const updated = await apiFetch('/mentors/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    // /me embeds the mentor profile — drop the cached copy.
    invalidateGetMeCache();
    // The mentor-profile entry is stale for the same reason.
    invalidateMentorProfileCache();
    return updated;
  },

  // ── Availability + leave (2026-11-20, Item 5) ─────────────────────
  // Thin wrappers over the mentor-own routes. The mentor's profile id
  // is resolved backend-side from auth — never client-passed.
  getMyAvailability: async (): Promise<AvailabilitySlot[]> => {
    return apiFetch<AvailabilitySlot[]>('/mentors/me/availability');
  },

  addAvailability: async (slot: {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    timezone?: string;
  }): Promise<AvailabilitySlot> => {
    return apiFetch<AvailabilitySlot>('/mentors/me/availability', {
      method: 'POST',
      body: JSON.stringify(slot),
    });
  },

  deleteAvailability: async (id: string): Promise<void> => {
    await apiFetch(`/mentors/me/availability/${id}`, { method: 'DELETE' });
  },

  getMyLeaves: async (): Promise<MentorLeave[]> => {
    return apiFetch<MentorLeave[]>('/mentors/me/leaves');
  },

  addLeave: async (leave: {
    startDate: string;
    endDate: string;
    reason?: string;
  }): Promise<MentorLeave> => {
    return apiFetch<MentorLeave>('/mentors/me/leaves', {
      method: 'POST',
      body: JSON.stringify(leave),
    });
  },

  deleteLeave: async (id: string): Promise<void> => {
    await apiFetch(`/mentors/me/leaves/${id}`, { method: 'DELETE' });
  },

  // Public: upcoming leaves for one mentor (student-facing display).
  getMentorLeaves: async (mentorId: string): Promise<MentorLeave[]> => {
    return apiFetch<MentorLeave[]>(`/mentors/${mentorId}/leaves`);
  },
};

// ─────────────────────────────────────────────────
// REQUEST SERVICE
// ─────────────────────────────────────────────────
export const requestService = {
  createRequest: async (mentorId: string, message: string, goal: string): Promise<MentorshipRequest> => {
    return apiFetch<MentorshipRequest>('/requests', {
      method: 'POST',
      body: JSON.stringify({ mentorId, message, goal }),
    });
  },

  getStudentRequests: async (): Promise<MentorshipRequest[]> => {
    return apiFetch<MentorshipRequest[]>('/requests');
  },

  // Mentor: get incoming requests — deduped + 30s cached (Item 2):
  // one of the three calls spamming the backend log from the mentor
  // dashboard. Shared with the MentorRequests page for free.
  getMentorRequests: async (): Promise<MentorshipRequest[]> => {
    return dedupedCached<MentorshipRequest[]>('mentor-requests', (token) =>
      apiFetchWithToken<MentorshipRequest[]>('/requests', {}, token)
    );
  },

  // Single request with its studentProfile (Item 3). Route already
  // exists and is ownership-checked; the dialog opens from the
  // already-loaded list item and refreshes through this in the
  // background (a refinement lands ~10s after the request is created).
  getRequestById: async (id: string): Promise<MentorshipRequest> => {
    return apiFetch<MentorshipRequest>(`/requests/${id}`);
  },

  // Returns the created mentorship (2026-11-20, Item 4): the backend
  // accept() now returns the mentorship plus the conversationId of
  // the conversation it created, so the mentor can jump straight to
  // Messages after accepting. Was Promise<void> (response discarded).
  acceptRequest: async (id: string): Promise<{ id: string; conversationId?: string }> => {
    const result = await apiFetch<{ id: string; conversationId?: string }>(`/requests/${id}/accept`, {
      method: 'POST',
    });
    // The list changed — the cached mentor-requests entry is stale.
    invalidateMentorRequestsCache();
    return result;
  },

  declineRequest: async (id: string): Promise<void> => {
    await apiFetch(`/requests/${id}/decline`, { method: 'POST' });
    // The list changed — the cached mentor-requests entry is stale.
    invalidateMentorRequestsCache();
  },

  cancelRequest: async (id: string): Promise<void> => {
    await apiFetch(`/requests/${id}/cancel`, { method: 'POST' });
  },
};

// ─────────────────────────────────────────────────
// MENTORSHIP SERVICE
// ─────────────────────────────────────────────────
export const mentorshipService = {
  // Deduped + 30s cached (Item 2): one of the three calls spamming
  // the backend log from the mentor dashboard.
  getActiveMentorships: async (): Promise<Mentorship[]> => {
    return dedupedCached<Mentorship[]>('active-mentorships', (token) =>
      apiFetchWithToken<Mentorship[]>('/mentorships', {}, token)
    );
  },

  getMentorshipById: async (id: string): Promise<Mentorship | null> => {
    try {
      return await apiFetch<Mentorship>(`/mentorships/${id}`);
    } catch {
      return null;
    }
  },

  getSessions: async (mentorshipId: string): Promise<Session[]> => {
    return apiFetch<Session[]>(`/mentorships/${mentorshipId}/sessions`);
  },

  // ── Sessions (2026-11-20, Item 6) ──────────────────────────────────
  // meetingUrl is optional and user-supplied only (a mentor/student
  // pastes their own link). The backend no longer generates one.
  createSession: async (
    mentorshipId: string,
    dto: {
      title: string;
      startTime: string;
      endTime: string;
      timezone?: string;
      notes?: string;
      meetingUrl?: string;
    }
  ): Promise<Session> => {
    return apiFetch<Session>(`/mentorships/${mentorshipId}/sessions`, {
      method: 'POST',
      body: JSON.stringify(dto),
    });
  },

  updateSession: async (
    id: string,
    patch: {
      title?: string;
      startTime?: string;
      endTime?: string;
      timezone?: string;
      notes?: string;
      meetingUrl?: string;
      status?: string;
    }
  ): Promise<Session> => {
    return apiFetch<Session>(`/sessions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  },

  cancelSession: async (id: string): Promise<void> => {
    await apiFetch(`/sessions/${id}`, { method: 'DELETE' });
  },

  // ── Session requests (2026-11-20, workspace slice Item 3) ─────────
  // Mentor decision on a student's schedule request. The backend
  // enforces mentor-only + REQUESTED-only; approve confirms the
  // session (SCHEDULED, calendar sync, student notified), decline
  // cancels it. Both return the updated session.
  approveSession: async (id: string): Promise<Session> => {
    return apiFetch<Session>(`/sessions/${id}/approve`, { method: 'POST' });
  },

  declineSession: async (id: string): Promise<Session> => {
    return apiFetch<Session>(`/sessions/${id}/decline`, { method: 'POST' });
  },

  getGoals: async (mentorshipId: string): Promise<Goal[]> => {
    return apiFetch<Goal[]>(`/mentorships/${mentorshipId}/goals`);
  },

  updateStatus: async (id: string, status: string): Promise<Mentorship> => {
    return apiFetch<Mentorship>(`/mentorships/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },
};

// ─────────────────────────────────────────────────
// STUDENT SERVICE
// ─────────────────────────────────────────────────
export const studentService = {
  getMyProfile: async (): Promise<any | null> => {
    try {
      return await apiFetch<any>('/students/me');
    } catch {
      return null;
    }
  },

  updateProfile: async (data: Record<string, any>): Promise<any> => {
    const updated = await apiFetch('/students/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    // /me embeds the student profile — drop the cached copy.
    invalidateGetMeCache();
    return updated;
  },

  updateCareer: async (data: Record<string, any>): Promise<any> => {
    const updated = await apiFetch('/students/me/career', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    // /me embeds the student profile — drop the cached copy.
    invalidateGetMeCache();
    return updated;
  },
};

// ─────────────────────────────────────────────────
// USER SERVICE
// ─────────────────────────────────────────────────
export const userService = {
  getMe: async (options?: { forceRefresh?: boolean }): Promise<any> => {
    try {
      // Resolve the token once: it is both the cache key and the
      // Authorization header (passed through so apiFetch does not poll
      // for the Clerk session a second time).
      const key = await getClerkToken();
      const now = Date.now();
      if (
        !options?.forceRefresh &&
        key &&
        getMeCache &&
        getMeCache.key === key &&
        now - getMeCache.fetchedAt < GET_ME_CACHE_TTL_MS
      ) {
        return getMeCache.data;
      }
      // `return await` on purpose: a rejected shared promise must land
      // in this catch (log + null) instead of throwing at the caller.
      if (getMeInflight && getMeInflight.key === key) {
        return await getMeInflight.promise;
      }
      const generation = getMeCacheGeneration;
      const entry: GetMeInflightEntry = {
        key,
        promise: (async () => {
          try {
            const data = await apiFetchWithToken<any>('/me', {}, key);
            // Cache only successful, signed-in results, and only if
            // nothing invalidated the cache while we were in flight.
            if (data != null && key && generation === getMeCacheGeneration) {
              getMeCache = { key, data, fetchedAt: Date.now() };
              // Remember the backend-confirmed role per Clerk user, so
              // the auth layer (mock-auth) can tell a long-standing
              // account that predates role metadata from a brand-new
              // account that never chose a role. Same generation guard:
              // a result invalidated mid-flight must not overwrite the
              // key with a stale role. PENDING is never written — it
              // means "no role yet", which is the absence of a signal.
              try {
                if (
                  typeof window !== 'undefined' &&
                  data.clerkUserId &&
                  data.role &&
                  data.role !== 'PENDING'
                ) {
                  localStorage.setItem(`mentorly_backend_role_${data.clerkUserId}`, data.role);
                }
              } catch {
                // Storage unavailable (private mode, quota): the
                // in-memory cache above still works; this is only a hint.
              }
              // Same treatment for the name the user PROVIDED: /me
              // returns the backend User doc's firstName/lastName
              // (onboarding / profile edits), while the shell reads
              // the Clerk/Google name — see mock-auth.tsx. Persisting
              // it per Clerk user lets useUser() prefer the profile
              // name with the Google name as fallback. Only a
              // non-empty first name is stored: an empty profile name
              // means "no name provided yet", not a name.
              try {
                if (
                  typeof window !== 'undefined' &&
                  data.clerkUserId &&
                  typeof data.firstName === 'string' &&
                  data.firstName.trim()
                ) {
                  localStorage.setItem(
                    `mentorly_profile_name_${data.clerkUserId}`,
                    JSON.stringify({
                      firstName: data.firstName.trim(),
                      lastName: typeof data.lastName === 'string' ? data.lastName.trim() : '',
                    }),
                  );
                }
              } catch {
                // Storage unavailable: the in-memory cache above still works.
              }
            }
            return data;
          } finally {
            if (getMeInflight === entry) getMeInflight = null;
          }
        })(),
      };
      getMeInflight = entry;
      return await entry.promise;
    } catch (err) {
      // Surface the backend's own reason instead of swallowing it: /me
      // returning null is otherwise undiagnosable (the 401 body names the
      // cause — e.g. "Clerk JWKS Client not configured" vs "Missing or
      // invalid Authorization header" vs "Authentication failed: ...").
      console.error('[getMe] /me failed:', (err as Error)?.message || err);
      return null;
    }
  },

  /**
   * True when the backend answers at all (GET /health always responds
   * JSON 200). Used to tell "backend is down" apart from "signed out":
   * getMe() returns null for both, but only a signed-out user should be
   * bounced back to the home page.
   */
  isBackendReachable: async (): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${API_BASE_URL}/health`, { signal: controller.signal });
      clearTimeout(timer);
      return res.ok;
    } catch {
      return false;
    }
  },

  updateMe: async (data: Record<string, any>): Promise<any> => {
    const updated = await apiFetch('/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    // Names changed — the cached /me result is stale.
    invalidateGetMeCache();
    return updated;
  },

  submitOnboarding: async (data: Record<string, any>): Promise<any> => {
    const result = await apiFetch('/me/onboard', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    // Role + onboardingStatus changed — the cached /me result would
    // bounce the user back to /onboarding. Force a fresh read.
    invalidateGetMeCache();
    return result;
  },
};

// ─────────────────────────────────────────────────
// CALENDAR NOTES SERVICE (Item 5, 2026-11-20)
// ─────────────────────────────────────────────────
// Personal day notes, private to the signed-in user — the backend
// scopes every call to the authenticated user, so no note is ever
// shared. `month` is "YYYY-MM"; dates are plain "YYYY-MM-DD" strings.
export const calendarNotesService = {
  getNotes: async (month: string): Promise<CalendarNote[]> => {
    const notes = await apiFetch<CalendarNote[]>(`/calendar-notes?month=${encodeURIComponent(month)}`);
    return Array.isArray(notes) ? notes : [];
  },

  createNote: async (data: { date: string; title?: string; text: string }): Promise<CalendarNote> => {
    return apiFetch<CalendarNote>('/calendar-notes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateNote: async (
    id: string,
    data: { date?: string; title?: string; text?: string },
  ): Promise<CalendarNote> => {
    return apiFetch<CalendarNote>(`/calendar-notes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  deleteNote: async (id: string): Promise<{ success: boolean; message?: string }> => {
    return apiFetch<{ success: boolean; message?: string }>(`/calendar-notes/${id}`, {
      method: 'DELETE',
    });
  },
};

// ─────────────────────────────────────────────────
// NOTIFICATION SERVICE
// ─────────────────────────────────────────────────
export const notificationService = {
  getNotifications: async (): Promise<{
    id: string;
    type: string;
    title: string;
    body: string;
    message: string;
    read: boolean;
    createdAt: string;
    actorName?: string;
    entityType?: string;
    entityId?: string;
    link?: string;
    metadata?: Record<string, unknown>;
  }[]> => {
    return apiFetch('/notifications');
  },

  markRead: async (id: string): Promise<void> => {
    await apiFetch(`/notifications/${id}/read`, { method: 'PATCH' });
  },

  markAllRead: async (): Promise<void> => {
    await apiFetch('/notifications/read-all', { method: 'POST' });
  },
};

// ─────────────────────────────────────────────────
// ANALYTICS / ADMIN SERVICE
// ─────────────────────────────────────────────────
export const adminService = {
  getDashboardMetrics: async (): Promise<{
    totalStudents: number;
    totalMentors: number;
    activeMentorships: number;
    acceptanceRate: number;
    pendingVerifications: number;
    recentRequests: MentorshipRequest[];
  }> => {
    return apiFetch('/analytics/dashboard');
  },

  getUsers: async (): Promise<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    status: string;
  }[]> => {
    return apiFetch('/admin/users');
  },

  getPendingVerifications: async (): Promise<{
    id: string;
    userId: string;
    status: string;
    submittedAt: string;
    user?: { firstName: string; lastName: string; email: string };
  }[]> => {
    return apiFetch('/verification');
  },

  approveVerification: async (id: string): Promise<void> => {
    await apiFetch(`/verification/${id}/approve`, { method: 'PATCH' });
  },

  rejectVerification: async (id: string, reason: string): Promise<void> => {
    await apiFetch(`/verification/${id}/reject`, {
      method: 'PATCH',
      body: JSON.stringify({ rejectionReason: reason }),
    });
  },

  requestChangesVerification: async (id: string, explanation: string): Promise<void> => {
    await apiFetch(`/verification/${id}/request-changes`, {
      method: 'PATCH',
      body: JSON.stringify({ explanation }),
    });
  },

  getAdminDashboard: async (): Promise<any> => {
    return apiFetch('/admin/dashboard');
  },

  getMatchingConfig: async (): Promise<any> => {
    return apiFetch('/admin/matching/config');
  },

  updateMatchingConfig: async (weights: Record<string, number>): Promise<any> => {
    return apiFetch('/admin/matching/config', {
      method: 'PATCH',
      body: JSON.stringify(weights),
    });
  },

  // LLM ranking status (2026-11-19): model, enabled flag, Ollama reachability.
  getLlmStatus: async (): Promise<any> => {
    return apiFetch('/admin/matching/llm-status');
  },

  getUserGrowth: async (days: number): Promise<any> => {
    return apiFetch(`/admin/user-growth?days=${days}`);
  },

  getVerificationOverview: async (): Promise<any> => {
    return apiFetch('/admin/verification-overview');
  },

  getMentorshipOverview: async (): Promise<any> => {
    return apiFetch('/admin/mentorship-overview');
  },

  getMentorUtilization: async (): Promise<any> => {
    return apiFetch('/admin/mentor-utilization');
  },

  getMatchingOverview: async (): Promise<any> => {
    return apiFetch('/admin/matching-overview');
  },

  getTopSkills: async (): Promise<any> => {
    return apiFetch('/admin/top-skills');
  },

  getTopIndustries: async (): Promise<any> => {
    return apiFetch('/admin/top-industries');
  },

  getAuditLogs: async (limit = 50): Promise<any> => {
    return apiFetch(`/admin/audit-logs?limit=${limit}`);
  },

  getSystemHealth: async (): Promise<any> => {
    return apiFetch('/health');
  },
};

// ─────────────────────────────────────────────────
// MESSAGING SERVICE
// ─────────────────────────────────────────────────
export interface Conversation {
  id: string;
  mentorshipId?: string;
  participants: Array<{ id: string; firstName: string; lastName: string; avatar?: string }>;
  /**
   * The other participant, as the backend actually returns it
   * (2026-11-20, Item 4). getConversations never sent `participants`
   * — only `otherUser` + `lastMessage` — so the Messages page threw
   * `Cannot read properties of undefined (reading 'find')` on the
   * first real conversation. `participants` stays for compatibility;
   * read the other person from `otherUser ?? participants.find(...)`.
   */
  otherUser?: { id: string; firstName: string; lastName: string; avatar?: string; role?: string };
  lastMessage?: { id?: string; content: string; senderId: string; createdAt: string };
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  /** Sender's display name — the backend sends it; the UI renders it on incoming bubbles. */
  senderName?: string;
  content: string;
  createdAt: string;
}

export const messagingService = {
  getConversations: async (): Promise<Conversation[]> => {
    return apiFetch<Conversation[]>('/conversations');
  },

  getMessages: async (conversationId: string, limit = 50, before?: string): Promise<ChatMessage[]> => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (before) params.set('before', before);
    return apiFetch<ChatMessage[]>(`/conversations/${conversationId}/messages?${params.toString()}`);
  },

  sendMessage: async (conversationId: string, content: string): Promise<ChatMessage> => {
    return apiFetch<ChatMessage>(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  },

  // The single conversation for a mentorship (2026-11-20, Item 4).
  // One conversation exists per mentorship (created on accept), so the
  // workspace "Message" button can jump straight to it without
  // listing every conversation first. 404s when none exists yet.
  getConversationByMentorship: async (mentorshipId: string): Promise<Conversation> => {
    return apiFetch<Conversation>(`/conversations/by-mentorship/${mentorshipId}`);
  },
};

// ─────────────────────────────────────────────────
// ALUMNI OFFICER SERVICE
// ─────────────────────────────────────────────────
export const alumniOfficerService = {
  getDashboard: async (): Promise<any> => {
    return apiFetch('/alumni-officer/dashboard');
  },

  getVerifications: async (
    page = 1,
    limit = 10,
    status?: string,
    q?: string
  ): Promise<any> => {
    const query = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      ...(status ? { status } : {}),
      ...(q ? { q } : {}),
    });
    return apiFetch(`/alumni-officer/verifications?${query.toString()}`);
  },

  getMentors: async (
    page = 1,
    limit = 10,
    q?: string
  ): Promise<any> => {
    const query = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      ...(q ? { q } : {}),
    });
    return apiFetch(`/alumni-officer/mentors?${query.toString()}`);
  },

  getVerificationById: async (id: string): Promise<any> => {
    return apiFetch(`/verification/${id}`);
  },

  approveVerification: async (id: string): Promise<any> => {
    return apiFetch(`/verification/${id}/approve`, { method: 'PATCH' });
  },

  rejectVerification: async (id: string, reason: string): Promise<any> => {
    return apiFetch(`/verification/${id}/reject`, {
      method: 'PATCH',
      body: JSON.stringify({ rejectionReason: reason }),
    });
  },

  requestChangesVerification: async (id: string, explanation: string): Promise<any> => {
    return apiFetch(`/verification/${id}/request-changes`, {
      method: 'PATCH',
      body: JSON.stringify({ explanation }),
    });
  },
};

// ─────────────────────────────────────────────────
// PLACEMENT OFFICER SERVICE
// ─────────────────────────────────────────────────
export const placementOfficerService = {
  getDashboard: async (): Promise<any> => {
    return apiFetch('/placement-officer/dashboard');
  },

  getStudents: async (
    page = 1,
    limit = 10,
    q?: string,
    industry?: string
  ): Promise<any> => {
    const query = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      ...(q ? { q } : {}),
      ...(industry ? { industry } : {}),
    });
    return apiFetch(`/placement-officer/students?${query.toString()}`);
  },

  getStudentById: async (id: string): Promise<any> => {
    return apiFetch(`/placement-officer/students/${id}`);
  },

  getOpportunities: async (
    page = 1,
    limit = 10,
    status?: string
  ): Promise<any> => {
    const query = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      ...(status ? { status } : {}),
    });
    return apiFetch(`/placement-officer/opportunities?${query.toString()}`);
  },

  createOpportunity: async (body: any): Promise<any> => {
    return apiFetch('/placement-officer/opportunities', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  getApplications: async (
    page = 1,
    limit = 10
  ): Promise<any> => {
    const query = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    return apiFetch(`/placement-officer/applications?${query.toString()}`);
  },

  updateApplicationStatus: async (id: string, body: any): Promise<any> => {
    return apiFetch(`/placement-officer/applications/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },
};

// ─────────────────────────────────────────────────
// CHATBOT SERVICE (2026-11-20, chatbot + RAG slice, frontend half)
// ─────────────────────────────────────────────────
// POST /chatbot/chat answers from the signed-in user's account data
// plus Mentorly platform info (RAG, backend-side). History is the
// prior turns only — the new message travels as `message`. When the
// AI engine is down or disabled the backend still answers 200 with
// aiAvailable: false and an honest "AI engine unavailable" reply;
// the widget renders that reply with an amber treatment, never a
// crash. GET /chatbot/status is called once when the chat panel
// first opens, never polled.
export interface ChatbotHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatbotChatResponse {
  reply: string;
  sources: ('account' | 'platform')[];
  aiAvailable: boolean;
}

export interface ChatbotStatusResponse {
  available: boolean;
  enabled: boolean;
  model: string;
}

// Streaming reply (2026-11-21, chatbot access + lag slice, frontend
// half). POST /chatbot/chat/stream is the same auth + body as
// POST /chatbot/chat but answers as SSE: one
// `data: {"token": "..."}` line per token, then a final
// `data: {"done": true, "reply": "...", "sources": [...],
// "aiAvailable": true}` line. When the AI engine is down before the
// first token the stream instead ends with a done line carrying the
// honest unavailable reply and `aiAvailable: false`. Validation /
// rate-limit / auth failures (400/429/401) return a normal JSON error
// BEFORE any stream starts, so they surface here as a thrown error
// and the widget falls back to the non-streaming sendMessage path.
// The token is resolved with the same getClerkToken() helper as
// apiFetch, and errors go through the same user-friendly mapping.
export interface ChatbotStreamCallbacks {
  onToken: (token: string) => void;
}

export const chatbotService = {
  sendMessage: async (
    message: string,
    history?: ChatbotHistoryItem[],
  ): Promise<ChatbotChatResponse> => {
    return apiFetch<ChatbotChatResponse>('/chatbot/chat', {
      method: 'POST',
      body: JSON.stringify({ message, ...(history ? { history } : {}) }),
    });
  },

  sendMessageStream: async (
    message: string,
    history: ChatbotHistoryItem[] | undefined,
    callbacks: ChatbotStreamCallbacks,
  ): Promise<ChatbotChatResponse> => {
    const token = await getClerkToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}/chatbot/chat/stream`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ message, ...(history ? { history } : {}) }),
      });
    } catch {
      // Same wording as apiFetchWithToken: the backend is down (or
      // unreachable), not a stream problem.
      throw new Error(
        `Could not reach the Mentorly server at ${API_BASE_URL}. Start the backend first (Terminal 1: npm run server in alumninetwork/backend) and try again.`,
      );
    }

    // A JSON error before the stream starts (400/401/429/500): throw
    // it like apiFetch does, so the caller can fall back.
    if (!response.ok) {
      const json = await response.json().catch(() => ({}));
      const rawMessage =
        json?.error?.message || json?.message || `HTTP error! status: ${response.status}`;
      throw new Error(toUserFriendlyErrorMessage(rawMessage, response.status));
    }

    if (!response.body) {
      throw new Error('The Mentorly AI reply ended unexpectedly. Please try again.');
    }

    // SSE parsing: lines arrive in arbitrary chunk boundaries, so
    // accumulate a text buffer and split on newlines as they complete.
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let newlineIndex = buffer.indexOf('\n');
        while (newlineIndex !== -1) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);
          if (line.startsWith('data:')) {
            const payload = line.slice('data:'.length).trim();
            if (payload && payload !== '[DONE]') {
              const event = JSON.parse(payload);
              if (typeof event.token === 'string' && event.token.length > 0) {
                callbacks.onToken(event.token);
              }
              if (event.done === true) {
                return {
                  reply: typeof event.reply === 'string' ? event.reply : '',
                  sources: Array.isArray(event.sources) ? event.sources : [],
                  aiAvailable: event.aiAvailable !== false,
                };
              }
            }
          }
          newlineIndex = buffer.indexOf('\n');
        }
      }
    } finally {
      try {
        reader.releaseLock();
      } catch {
        // The reader may already be released after an error — ignore.
      }
    }
    // Stream ended without a done line: the reply is incomplete.
    throw new Error('The Mentorly AI reply ended unexpectedly. Please try again.');
  },

  getStatus: async (): Promise<ChatbotStatusResponse> => {
    return apiFetch<ChatbotStatusResponse>('/chatbot/status');
  },
};
