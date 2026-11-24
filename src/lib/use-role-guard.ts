'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/lib/mock-auth';

/**
 * Returns the canonical dashboard path for the given role.
 * Single source of truth — used by the auth layout, login redirects,
 * header dropdowns, and per-page role guards.
 */
export function dashboardPathFor(role: string | undefined): string {
  if (!role) return '/';
  // No role chosen yet: there is no dashboard to send the user to —
  // onboarding (with its role gate) is the only correct destination.
  if (role === 'PENDING') return '/onboarding';
  return `/app/${role.toLowerCase().replace('_', '-')}/dashboard`;
}

/**
 * Enforces that the current user is one of `allowedRoles`. On mismatch
 * the user is redirected to their own canonical dashboard.
 *
 * The guard only redirects on an EXPLICITLY chosen role (registration
 * choice / onboarding gate / mock role switch). A user with no explicit
 * role yet is never guessed at: AppLayout's /me check is authoritative
 * there and sends role-pending users to /onboarding. Redirecting on a
 * guessed role would bounce long-standing accounts that predate role
 * metadata into a redirect loop.
 *
 * Usage:
 *   useRoleGuard(['ADMIN', 'ALUMNI_OFFICER', 'PLACEMENT_OFFICER']);
 */
export function useRoleGuard(allowedRoles: string[]) {
  const { user, explicitRole } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (user && explicitRole && !allowedRoles.includes(explicitRole)) {
      router.replace(dashboardPathFor(explicitRole));
    }
  }, [user, router, allowedRoles, explicitRole]);

  const allowed = !!user && (!explicitRole || allowedRoles.includes(explicitRole));
  return { user, allowed };
}
