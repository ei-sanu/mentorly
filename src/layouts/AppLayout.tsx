'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { ChatbotWidget } from '@/components/chatbot/ChatbotWidget';
import { userService } from '@/services/api';
import { useAuth } from '@/lib/mock-auth';

export default function AppLayout({ children }: { children?: React.ReactNode }) {
  const router = useRouter();
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    // Never call the backend before knowing the auth state: guests used to
    // hit /api/v1/me with no token and collect a 401, then get bounced.
    if (!authLoaded) return;
    if (!isSignedIn) {
      router.push('/login');
      return;
    }
    async function checkUserOnboarding() {
      try {
        const fresh = await userService.getMe();
        if (fresh) {
          if (fresh.onboardingStatus === 'NOT_STARTED' || fresh.onboardingStatus === 'IN_PROGRESS') {
            router.push('/onboarding');
          } else if (fresh.onboardingStatus === 'UNDER_REVIEW' || fresh.onboardingStatus === 'SUBMITTED') {
            router.push('/onboarding/status');
          } else if (fresh.onboardingStatus === 'REJECTED' || fresh.onboardingStatus === 'CHANGES_REQUESTED') {
            router.push('/onboarding/review');
          } else {
            setLoading(false);
          }
        } else if (await userService.isBackendReachable()) {
          // Backend answered but returned no user: genuinely signed out
          // (401) — bounce to the home page.
          router.push('/');
        } else {
          // Backend is down: stay on the dashboard with the local session
          // (mock sign-in works offline). Data sections show their own
          // "server unreachable" state until the backend is back.
          setLoading(false);
        }
      } catch (err) {
        console.error(err);
        if (await userService.isBackendReachable()) {
          router.push('/');
        } else {
          setLoading(false);
        }
      }
    }
    checkUserOnboarding();
    // NOTE: `router` is intentionally NOT a dep. The useRouter shim returns
    // a fresh object on every render, so listing it re-ran this guard — and
    // its getMe() + navigation — on every render. The underlying navigate()
    // is stable, so the captured router still works.
  }, [authLoaded, isSignedIn]);

  if (loading) {
    return (
      <div className="glass-theme flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f2f2f2] px-4" role="status" aria-busy="true">
        <div className="glass-panel flex w-fit items-center gap-2.5 rounded-full px-4 py-2 text-xs text-neutral-500">
          <span className="flex items-center gap-1" aria-hidden="true">
            <span className="glass-thinking-dot h-1.5 w-1.5 rounded-full bg-current" />
            <span className="glass-thinking-dot h-1.5 w-1.5 rounded-full bg-current" />
            <span className="glass-thinking-dot h-1.5 w-1.5 rounded-full bg-current" />
          </span>
          Checking authorization status…
        </div>
        <div className="w-64 space-y-2">
          <div className="pulse-skeleton h-3 w-full rounded-md" aria-hidden="true" />
          <div className="pulse-skeleton h-3 w-2/3 rounded-md" aria-hidden="true" />
        </div>
      </div>
    );
  }

  return (
    <div className="glass-theme app-shell relative flex h-screen bg-[#f2f2f2] text-neutral-900">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="relative flex flex-1 flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <div className="mx-auto max-w-[1400px]">
            <Breadcrumbs />
            {children || <Outlet />}
          </div>
        </main>
      </div>
      <ChatbotWidget />
    </div>
  );
}
