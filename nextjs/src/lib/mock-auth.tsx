'use client';

import React, { useCallback, useEffect, useSyncExternalStore } from 'react';
import { ClerkProvider, useAuth as useClerkAuth, useUser as useClerkUser } from '@clerk/nextjs';
import { User, Role } from '@/types';
import { invalidateGetMeCache, userService } from '@/services/api';
import { invalidateRequestStatusCache } from '@/lib/request-status';

// ---- Name refresh (profile name save, 2026-11-20) ----
// The app shell (sidebar/header, App.tsx) renders its name from
// useUser(). PATCH /me updates only the backend User doc, so after a
// name save the shell kept the old name until a full reload.
// refreshUser() (inside useUser, below) closes that gap:
// - Mock mode: the mock name is hardcoded constants, so the edited name
//   is persisted to localStorage (mock_user_first_name /
//   mock_user_last_name) and read back on every render; sign-out clears
//   both keys so a different mock user never inherits the name.
// - Clerk mode: PATCH /me never touches Clerk's own profile, so
//   clerkUser.reload() alone cannot surface the new name — the Clerk
//   store still holds the old one. refreshUser therefore pushes the new
//   name into Clerk with clerkUser.update({ firstName, lastName }) (same
//   window.Clerk.user.update precedent as OnboardingPage role
//   persistence), falling back to reload() when no name is passed. A
//   Clerk-sync failure is swallowed: the backend save already succeeded
//   and /me is the source of truth.
// Every useUser consumer re-renders on refresh via this version store,
// because React does not re-render on localStorage writes alone. The
// third useSyncExternalStore argument is the server snapshot (0) so the
// Next.js twin can server-render this hook without an error.
//
// ---- Profile name overlay (dashboard/home name, 2026-11-20) ----
// Root cause of the dashboard showing the Gmail name: useUser() built
// its user from clerkUser.firstName/lastName — the Google account name
// from the OAuth sign-in — while the Profile page reads the name the
// user PROVIDED from the backend User doc (GET /me, see
// StudentProfile.tsx / MentorProfile.tsx). Nothing ever overwrote the
// Clerk-sourced name with the backend name on load; refreshUser()
// only ran after a profile save. So a user whose provided name
// differs from their Google name saw the Google name on the dashboard
// and in the shell header, and the provided name only on Profile.
// Fix, at this one source (every display surface reads useUser(), so
// no dashboard/header edit is needed): the backend profile name wins.
// GET /me persists it per Clerk user (mentorly_profile_name_<id>, the
// same pattern as the mentorly_backend_role_<id> key in api.ts);
// useUser() reads it back and prefers it over the Clerk name, with
// the Clerk/Google name as the fallback when no profile name exists
// yet (fresh account, backend down, or an empty profile name). The
// stored Google name and the Clerk account are never changed — this
// is a display-source fix only.
let userVersion = 0;
const userVersionListeners = new Set<() => void>();
function bumpUserVersion(): void {
  userVersion += 1;
  userVersionListeners.forEach((listener) => listener());
}
function subscribeUserVersion(listener: () => void): () => void {
  userVersionListeners.add(listener);
  return () => {
    userVersionListeners.delete(listener);
  };
}
function getUserVersion(): number {
  return userVersion;
}

// The backend profile name, persisted per Clerk user by getMe() (see
// api.ts) and by refreshUser() after a profile save. Keyed by Clerk
// user id, like mentorly_backend_role_<id>, so one user's stored name
// can never leak into another user's session. A stored name always
// has a non-empty firstName: an empty profile name is never written,
// so "no stored name" means "fall back to the Clerk/Google name".
const PROFILE_NAME_STORAGE_PREFIX = 'mentorly_profile_name_';

function readStoredProfileName(clerkUserId: string): { firstName: string; lastName: string } | null {
  if (typeof window === 'undefined' || !clerkUserId) return null;
  try {
    const raw = localStorage.getItem(`${PROFILE_NAME_STORAGE_PREFIX}${clerkUserId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { firstName?: unknown; lastName?: unknown };
    if (typeof parsed.firstName !== 'string' || !parsed.firstName.trim()) return null;
    return {
      firstName: parsed.firstName.trim(),
      lastName: typeof parsed.lastName === 'string' ? parsed.lastName.trim() : '',
    };
  } catch {
    return null;
  }
}

function storeProfileName(clerkUserId: string, name: { firstName: string; lastName: string }): void {
  if (typeof window === 'undefined' || !clerkUserId) return;
  try {
    localStorage.setItem(
      `${PROFILE_NAME_STORAGE_PREFIX}${clerkUserId}`,
      JSON.stringify({ firstName: name.firstName.trim(), lastName: name.lastName.trim() }),
    );
  } catch {
    // Storage unavailable: the in-memory user object still carries the name.
  }
}

export const MockAuthProvider = ({ children }: { children: React.ReactNode }) => {
  // Next.js port: the publishable key comes ONLY from .env.local
  // (NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY). The React app's hardcoded
  // fallback key is deliberately NOT carried over — never commit a
  // key value. If the variable is unset, Clerk fails with a clear
  // error telling you to set it; see README.md env setup.
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  return (
    <ClerkProvider publishableKey={publishableKey}>
      {children}
    </ClerkProvider>
  );
};

export const useUser = () => {
  const { isLoaded: clerkLoaded, isSignedIn: clerkSignedIn, user: clerkUser } = useClerkUser();

  // Re-render every consumer when refreshUser() bumps the version (a
  // localStorage write alone would not re-render anything).
  useSyncExternalStore(subscribeUserVersion, getUserVersion, () => 0);

  const isMock = typeof window !== 'undefined' && !!localStorage.getItem('mock_user_token');

  // Push a saved name into the app shell. Called by the profile pages
  // after a successful personal save. Clerk-sync failure is swallowed:
  // the backend save already succeeded and /me is the source of truth.
  const refreshUser = useCallback(async (name?: { firstName: string; lastName: string }) => {
    if (typeof window !== 'undefined' && localStorage.getItem('mock_user_token')) {
      if (name) {
        localStorage.setItem('mock_user_first_name', name.firstName);
        localStorage.setItem('mock_user_last_name', name.lastName);
      }
      bumpUserVersion();
      return;
    }
    // The backend save already succeeded — persist the provided name
    // as the display name now, so the shell shows it even if the
    // Clerk push below fails, and across reloads. (The mock branch
    // above does the same for mock_user_first_name/_last_name.)
    if (name && clerkUser?.id) storeProfileName(clerkUser.id, name);
    try {
      // PATCH /me never touches Clerk's own profile, so reload() alone
      // cannot surface the new name — the Clerk store still holds the
      // old one. Push the name into Clerk instead (same
      // window.Clerk.user.update precedent as OnboardingPage role
      // persistence); fall back to reload() when no name is passed.
      const clerk = clerkUser as unknown as {
        update?: (params: { firstName: string; lastName: string }) => Promise<unknown>;
        reload?: () => Promise<unknown>;
      } | null;
      if (name && clerk?.update) {
        await clerk.update({ firstName: name.firstName, lastName: name.lastName });
      } else if (clerk?.reload) {
        await clerk.reload();
      }
    } catch {
      // Best-effort only (see above).
    }
    bumpUserVersion();
  }, [clerkUser]);

  // Load the backend profile name once a Clerk user is known, so the
  // shell and dashboards show the name the user provided instead of
  // the Google account name. getMe() is deduped + 30s-cached in api.ts
  // (AppLayout calls it too), so this adds no extra network call in
  // practice — concurrent callers share one in-flight request — and
  // api.ts's own persist writes the mentorly_profile_name_<id> key
  // when the fetch lands. The version bump below re-renders consumers
  // only when the stored name actually changed, so a warm cache costs
  // no extra render.
  //
  // Deliberately, this effect does NOT store the name from the
  // returned payload itself: api.ts's persist is generation-guarded
  // (a /me invalidated mid-flight never writes), while a store here
  // would let a stale in-flight /me overwrite a name the user JUST
  // saved (refreshUser stores the new name; the stale fetch resolving
  // afterwards would put the old name back for up to 30s). Mock mode
  // skips this: clerkUser is null there, and the mock branch below
  // already reads the persisted mock name.
  const clerkIdForName = clerkUser?.id;
  useEffect(() => {
    if (!clerkIdForName) return;
    let before: string | null = null;
    try {
      before = localStorage.getItem(`${PROFILE_NAME_STORAGE_PREFIX}${clerkIdForName}`);
    } catch {
      before = null;
    }
    let cancelled = false;
    userService
      .getMe()
      .then(() => {
        if (cancelled) return;
        let after: string | null = null;
        try {
          after = localStorage.getItem(`${PROFILE_NAME_STORAGE_PREFIX}${clerkIdForName}`);
        } catch {
          after = null;
        }
        if (after !== before) bumpUserVersion();
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [clerkIdForName]);

  // If mock login bypass is active
  if (isMock) {
    const mockEmail = localStorage.getItem('mock_user_email') || 'someshranjanbiswal13678@gmail.com';
    const activeRole = (localStorage.getItem('active_role') as Role) || 'ADMIN';
    const user: User = {
      id: 'mock_user_someshranjanbiswal13678_gmail_com',
      firstName: localStorage.getItem('mock_user_first_name') || 'Somesh Ranjan',
      lastName: localStorage.getItem('mock_user_last_name') || 'Biswal',
      email: mockEmail,
      // No photo URL: avatars are initials-only (see InitialsAvatar).
      // The old Unsplash stock photo of a stranger is gone on purpose.
      imageUrl: '',
      role: activeRole,
    };
    return {
      isLoaded: true,
      isSignedIn: true,
      user,
      explicitRole: activeRole,
      refreshUser,
    };
  }

  let user: User | null = null;
  let explicitRole: Role | null = null;
  if (clerkUser) {
    const storedRole = typeof window !== 'undefined' ? localStorage.getItem(`clerk_role_${clerkUser.id}`) : null;
    const metaRole = clerkUser.unsafeMetadata?.role as Role | undefined;
    explicitRole = (storedRole as Role) || metaRole || null;
    // No explicit role? Fall back to the last backend-confirmed role
    // getMe() cached (see api.ts) — this keeps long-standing accounts
    // that predate role metadata working exactly as before. Only when
    // there is NO signal at all (a brand-new account that never chose)
    // is the role PENDING: never a silent STUDENT.
    const cachedBackendRole =
      typeof window !== 'undefined'
        ? localStorage.getItem(`mentorly_backend_role_${clerkUser.id}`)
        : null;
    const backendRole =
      cachedBackendRole === 'STUDENT' ||
      cachedBackendRole === 'MENTOR' ||
      cachedBackendRole === 'ALUMNI_OFFICER' ||
      cachedBackendRole === 'PLACEMENT_OFFICER' ||
      cachedBackendRole === 'ADMIN'
        ? (cachedBackendRole as Role)
        : null;
    // The name the user PROVIDED lives on the backend User doc (/me),
    // not in Clerk — read back the stored profile name, if any.
    const profileName = readStoredProfileName(clerkUser.id);
    user = {
      id: clerkUser.id,
      // Profile name first, Google/Clerk name only as fallback (see
      // the overlay comment above): the Profile page shows the backend
      // name, so the dashboard and header must show the same name.
      firstName: profileName ? profileName.firstName : clerkUser.firstName || '',
      lastName: profileName ? profileName.lastName : clerkUser.lastName || '',
      email: clerkUser.primaryEmailAddress?.emailAddress || '',
      // No photo URL: avatars are initials-only (see InitialsAvatar), so
      // the Clerk/Google photo is deliberately not carried over.
      imageUrl: '',
      role: explicitRole || backendRole || 'PENDING',
    };
  }

  return {
    isLoaded: clerkLoaded,
    isSignedIn: !!clerkSignedIn,
    user,
    explicitRole,
    refreshUser,
  };
};

export const useAuth = () => {
  const { isLoaded: clerkLoaded, isSignedIn: clerkSignedIn, signOut: clerkSignOut } = useClerkAuth();
  const { user, explicitRole } = useUser();

  const isMock = typeof window !== 'undefined' && !!localStorage.getItem('mock_user_token');

  const handleSignOut = async () => {
    // Drop the cached /me profile first: the next sign-in (possibly a
    // different user) must never read the previous session's data.
    // This is the single sign-out choke point — every signOut() in the
    // app funnels through here (mock + Clerk alike).
    invalidateGetMeCache();
    // Same for the shared request state: another user's "Request Sent"
    // marks must never survive into the next session.
    invalidateRequestStatusCache();
    if (isMock) {
      localStorage.removeItem('mock_user_token');
      localStorage.removeItem('mock_user_email');
      localStorage.removeItem('active_role');
      // A persisted mock name must not leak into the next mock user.
      localStorage.removeItem('mock_user_first_name');
      localStorage.removeItem('mock_user_last_name');
      window.location.href = '/login';
    } else {
      await clerkSignOut();
    }
  };

  return {
    isLoaded: isMock ? true : clerkLoaded,
    isSignedIn: isMock ? true : !!clerkSignedIn,
    user,
    explicitRole,
    signOut: handleSignOut,
    signIn: (email: string) => true,
    signUp: (email: string, firstName: string, lastName: string, role: Role) => {},
    users: [],
  };
};

export const SignedIn = ({ children }: { children: React.ReactNode }) => {
  const { isSignedIn } = useUser();
  return isSignedIn ? <>{children}</> : null;
};

export const SignedOut = ({ children }: { children: React.ReactNode }) => {
  const { isSignedIn } = useUser();
  return !isSignedIn ? <>{children}</> : null;
};
