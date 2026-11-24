'use client';

/**
 * Mentorly — /login route (2026-11-11 rewrite).
 *
 * The page is now a thin shell: the whole form lives in
 * src/components/auth/AuthForm.tsx (shared with the home-page popup
 * AuthModal.tsx), so sign-in / sign-up / OAuth / verification logic
 * exists exactly once. This route stays as the standalone fallback —
 * direct /login visits, OAuth redirects and deep links still land here.
 *
 * What this file still owns: the loading state, the already-signed-in
 * redirect to the role dashboard, the page chrome (dark glass card on
 * a dim blurred backdrop, matching the popup), and Back to home.
 *
 * Presentation follows the same iOS-glass format as the popup; the
 *   old white card + old coloured buttons + old logo are gone.
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/mock-auth';
import { X } from 'lucide-react';
import AuthForm from '@/components/auth/AuthForm';

export default function LoginPage() {
  const { isLoaded: authLoaded, user } = useAuth();
  const router = useRouter();

  // Redirect if already logged in
  useEffect(() => {
    if (authLoaded && user) {
      router.push(`/app/${user.role.toLowerCase().replace('_', '-')}/dashboard`);
    }
  }, [user, authLoaded, router]);

  if (!authLoaded) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0b0b0d] px-4">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-white/15 border-t-white" />
        <button
          type="button"
          onClick={() => router.push('/')}
          className="mt-6 text-sm font-medium text-white/60 underline hover:text-white"
        >
          Back to home
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#0b0b0d] px-4 py-12 sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={() => router.push('/')}
        aria-label="Close and go back home"
        className="absolute right-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white/70 backdrop-blur-md transition-colors hover:bg-white/20 hover:text-white"
      >
        <X className="h-5 w-5" />
      </button>
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/3 h-96 w-96 rounded-full bg-white/[0.06] blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-white/[0.04] blur-[100px]" />
      </div>

      <p className="relative mb-6 text-center text-[28px] font-semibold tracking-[-0.02em] text-white">
        Mentorly
      </p>
      <div className="auth-glass-card relative w-full max-w-md p-6 sm:p-8">
        <AuthForm defaultTab="login" />
        <button
          type="button"
          onClick={() => router.push('/')}
          className="mt-6 w-full text-center text-sm font-medium text-white/60 underline-offset-4 transition-colors hover:text-white hover:underline"
        >
          Back to home
        </button>
      </div>
    </div>
  );
}
