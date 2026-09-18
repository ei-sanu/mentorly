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
  return `/app/${role.toLowerCase().replace('_', '-')}/dashboard`;
}

/**
 * Enforces that the current user is one of `allowedRoles`. On mismatch
 * the user is redirected to their own canonical dashboard.
 *
 * Usage:
 *   useRoleGuard(['ADMIN', 'ALUMNI_OFFICER', 'PLACEMENT_OFFICER']);
 */
export function useRoleGuard(allowedRoles: string[]) {
  const { user } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (user && !allowedRoles.includes(user.role)) {
      router.replace(dashboardPathFor(user.role));
    }
  }, [user, router, allowedRoles]);

  const allowed = !!user && allowedRoles.includes(user.role);
  return { user, allowed };
}
