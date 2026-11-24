'use client';

/**
 * Mentorly — 404 page (2026-11-11 redesign).
 *
 * Replaces the 2026-11-10 Gireffe-style page ("Oh noo!" + stick-figure
 * illustration on a peach background). That design read as odd and
 * awkward in the app: the huge headline shouted, the busy line drawing
 * crowded the page, the peach background clashed with the rest of the
 * site, and — worst — an /app/* URL showed the LANDING nav (How it
 * works / Benefits / Stories / FAQ), which does not belong on an app
 * error page at all.
 *
 * WHAT IT IS NOW: the same calm minimalism as the rest of Mentorly.
 * Light grey page (#f2f2f2, the site standard — no peach), one clean
 * sans font, generous balanced spacing, no illustration. A minimal top
 * bar with just the Mentorly wordmark and a single "Go home" link.
 * Centred content: a small "404" label, a short headline in a sensible
 * size, one line of subcopy, and two clear actions — "Go back" (black
 * pill, primary) plus a context-aware second action: "Go to dashboard"
 * when signed in, "Go home" when signed out.
 *
 * FUNCTIONAL: still the catch-all for unknown routes (path="*" in
 * App.tsx), still reachable directly (e.g. /some-bogus-url), "Go back"
 * uses history.back() and falls back to "/" when there is no previous
 * page in this tab. No API calls on this page.
 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useAuth } from '@/lib/mock-auth';

export default function NotFound() {
  const router = useRouter();
  const { isSignedIn, user } = useAuth();

  const goBack = () => {
    if (window.history.length > 1) router.back();
    else router.push('/');
  };

  // Every role has a dashboard route (/app/<role>/dashboard); only
  // student and mentor have a profile route, so the second action is
  // always the dashboard for signed-in users.
  const dashboardPath = user
    ? `/app/${user.role.toLowerCase().replace('_', '-')}/dashboard`
    : '/';

  return (
    <main className="flex min-h-screen flex-col bg-[#f2f2f2] px-4 sm:px-8">
      {/* Minimal top bar — wordmark only, no landing nav. */}
      <header className="mx-auto flex w-full max-w-[1120px] items-center justify-between py-6">
        <Link
          href="/"
          aria-label="Mentorly — home"
          className="text-[22px] font-semibold tracking-[-0.02em] text-[#111111]"
        >
          Mentorly
        </Link>
        <Link
          href="/"
          className="text-[15px] font-medium text-[#555555] hover:text-[#111111] hover:underline hover:underline-offset-4"
        >
          Go home
        </Link>
      </header>

      {/* Centred content — calm, one column, nothing shouting. */}
      <div className="mx-auto flex w-full max-w-[560px] flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <p className="text-[13px] font-medium uppercase tracking-[0.2em] text-[#999999]">
          404 — Page not found
        </p>
        <h1 className="mt-4 text-[36px] font-semibold leading-tight tracking-[-0.02em] text-[#111111] sm:text-[40px]">
          This page isn&rsquo;t here.
        </h1>
        <p className="mt-3 max-w-[420px] text-[15px] leading-[1.7] text-[#555555]">
          The link you followed doesn&rsquo;t exist, or the page was moved.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <button
            type="button"
            onClick={goBack}
            className="inline-flex items-center gap-2 rounded-full bg-[#0a0a0a] px-6 py-3 text-[15px] font-medium text-white transition-colors hover:bg-[#262626] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Go back
          </button>
          {isSignedIn ? (
            <Link
              href={dashboardPath}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#d4d4d4] bg-white px-6 py-3 text-[15px] font-medium text-[#111111] transition-colors hover:border-[#111111]"
            >
              Go to dashboard
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          ) : (
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-[15px] font-medium text-[#111111] underline underline-offset-4 hover:text-[#555555]"
            >
              Go home
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
