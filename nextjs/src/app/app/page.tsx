'use client';

// /app has no page of its own. An admin landing on the generic entry is
// sent straight to the admin dashboard; every other role sees exactly
// what /app showed before (the app chrome with an empty main area).
// Redirects only on an EXPLICITLY chosen ADMIN role (see use-role-guard):
// a user whose role is only a backend-cache fallback is never guessed
// at, and role-pending users never reach here — the app layout's /me
// check sends them to /onboarding before this page renders.
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/lib/mock-auth';

export default function AppIndexPage() {
  const { isLoaded, user, explicitRole } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;
    if (user && explicitRole === 'ADMIN') {
      router.replace('/app/admin/dashboard');
    }
  }, [isLoaded, user, explicitRole, router]);

  return null;
}
