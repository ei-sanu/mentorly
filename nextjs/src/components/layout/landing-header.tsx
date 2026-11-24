'use client';

/**
 * Mentorly — floating pill navbar (adapted for the Mac alumninetwork project).
 *
 * APPLIED 2026-11-10 directly to:
 *   /Users/somesh/Projects/alumniconnect/alumninetwork/src/components/layout/landing-header.tsx
 * (replaces the Oct-26 pill navbar; backup: landing-header.tsx.pre-minimal-2026-11-10.bak)
 * Source: VM mentorly-navbar/Navbar.tsx, adapted — NOT byte-identical:
 *
 * MAC-VERIFIED ADAPTATIONS (found by reading the Mac project, 2026-11-10):
 * - Auth is `@/lib/mock-auth` `useAuth()` (NOT Clerk's `useAuth()` directly):
 *   the landing page runs inside `MockAuthProvider`, and mock sessions
 *   (localStorage `mock_user_token`, used by the /me 401 fix) are invisible
 *   to Clerk's `useAuth()`. Using Clerk here would show "Get Started" to
 *   signed-in mock users. `signOut()` comes from mock-auth too: for mock
 *   users it clears the token and goes to /login; for Clerk users it
 *   signs out of Clerk and we navigate to '/'.
 * - Dashboard is ROLE-BASED (App.tsx): there is NO single '/dashboard'.
 *   `getDashboardPath(role)` builds `/app/<role>/dashboard`, e.g.
 *   /app/student/dashboard, /app/mentor/dashboard, /app/admin/dashboard.
 * - Section ids verified in Mac HomePage.tsx: the Stories section is
 *   `#testimonials` (NOT `#stories`). 2026-11-11: How it works,
 *   Industries, Stories and FAQ were removed from NAV_LINKS; 2026-11-12:
 *   Benefits was removed too, so the navbar has no section links left
 *   (the sections themselves are untouched — #benefits still exists).
 * - The Oct-26 "Admin Panel" link (ADMIN role only) was removed
 *   2026-11-19: admins reach their dashboard via the /app redirect
 *   (app/page.tsx) and the role-based sidebar; the navbar stays clean.
 * - Export is the named `LandingHeader` (HomePage imports it by name),
 *   with a default export as well.
 *
 * STYLE: the portfolio navbar from Somesh's screenshot (2026-11-10),
 * rebuilt with Mentorly's own content — floating `rounded-full`
 * solid-black pill, thin light border, large wordmark left, plain
 * normal-case links, grey pill CTA with ↗ on the right.
 *
 * FONT: wordmark is SANS (see mentorly-minimal.css / globals.css).
 * The Oct-26 serif wordmark is superseded. No serif, no mono here.
 *
 * FLOATING GAP (2026-11-11): the pill is `sticky`, and `top-6` only
 * constrains it WHILE scrolling — at page load it sits at its normal
 * flow position, and the HomePage wrapper has no top padding, so the
 * pill rendered flush against the viewport top (see Somesh's
 * 2026-11-11 screenshot). Fix: a real in-flow `mt-8` (32px) plus a
 * matching `top-8`, so the gap is visible at rest AND while stuck.
 * Pill stays 1080px max-width / 58px tall (2026-11-11 size change).
 *
 * AUTH POPUP (2026-11-11): Login / Get Started no longer navigate to
 * /login when the home page passes `onAuthClick` — they open the
 * AuthModal popup on the home page instead (Login → 'login' tab,
 * Get Started → 'register' tab). Without the prop, the links fall
 * back to navigating to /login, so the header still works anywhere.
 */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/mock-auth';
import { Menu, X, ArrowUpRight, LogOut } from 'lucide-react';
import { scrollToSection } from './smooth-scroll';

/* ── Edit this one constant to change the nav links ──────────────────── */
/* Section ids verified in Mac src/pages/HomePage.tsx (2026-11-10).
 * 2026-11-11: Somesh removed How it works, Industries, Stories and
 * FAQ from the navbar; 2026-11-12: Benefits was removed too, so this
 * list is empty and the navbar shows no section links — only the
 * wordmark, Login / Get Started (signed out) or Go to Dashboard /
 * Logout (signed in). The sections themselves (#benefits,
 * #how-it-works, #industries, #testimonials, #faq) still exist on
 * the page; only these links were removed. This one list drives
 * BOTH the desktop nav and the mobile menu, and the active-section
 * observer — to restore a link, add one entry here and the lists
 * render again (they stay hidden while the list is empty). */
export const NAV_LINKS: ReadonlyArray<{ label: string; href: string }> = [];

/** Role-based dashboard path — App.tsx has no single '/dashboard' route. */
export function getDashboardPath(role?: string | null): string {
  if (role) return `/app/${role.toLowerCase().replace('_', '-')}/dashboard`;
  return '/login';
}

export const LOGIN_HREF = '/login';

export type AuthTab = 'login' | 'register';

/**
 * Login / Get Started action: opens the home-page auth popup when the
 * page passes `onAuthClick`, otherwise navigates to /login as before.
 * `onPress` runs first in both cases (used by the mobile menu to close
 * itself before the modal opens / navigation happens).
 */
function AuthLink({
  tab,
  onAuthClick,
  onPress,
  className,
  children,
}: {
  tab: AuthTab;
  onAuthClick?: (tab: AuthTab) => void;
  onPress?: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  if (onAuthClick) {
    return (
      <button
        type="button"
        onClick={() => {
          onPress?.();
          onAuthClick(tab);
        }}
        className={className}
      >
        {children}
      </button>
    );
  }
  return (
    <Link href={LOGIN_HREF} onClick={onPress} className={className}>
      {children}
    </Link>
  );
}

export interface LandingHeaderProps {
  /** Override auth state (e.g. in tests). Defaults to mock-auth. */
  isSignedIn?: boolean;
  /** Extra classes for the outer wrapper, if a page needs them. */
  className?: string;
  /**
   * When set, Login / Get Started open the home-page auth popup
   * (AuthModal) instead of navigating to /login. HomePage passes this;
   * without it the header keeps its old /login links.
   */
  onAuthClick?: (tab: AuthTab) => void;
}

export function LandingHeader({ isSignedIn: isSignedInProp, className = '', onAuthClick }: LandingHeaderProps) {
  const { isSignedIn: authSignedIn, user, isLoaded, signOut } = useAuth();
  const router = useRouter();

  const isSignedIn = isSignedInProp ?? authSignedIn ?? false;
  const dashboardHref = getDashboardPath(user?.role);

  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('');
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  /* Shadow / backdrop once the page has scrolled past the pill. */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* Active-section highlight, via IntersectionObserver (see smooth-scroll.ts). */
  useEffect(() => {
    const ids = NAV_LINKS.map((l) => l.href.slice(1));
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveSection(`#${entry.target.id}`);
        }
      },
      { rootMargin: '-45% 0px -50% 0px' },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  /* Close the mobile menu on Escape, and return focus to the button. */
  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  /* Close the mobile menu when the viewport grows to desktop width. */
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setMenuOpen(false);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const goToSection = (href: string) => {
    setMenuOpen(false);
    scrollToSection(href.slice(1));
  };

  const handleLogout = async () => {
    setMenuOpen(false);
    await signOut();
    router.push('/');
  };

  const linkClass = (href: string) =>
    [
      'rounded-full px-1 py-1 text-[16px] leading-none text-white/90 transition-colors',
      'hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white',
      activeSection === href ? 'text-white underline underline-offset-8 decoration-white/60' : '',
    ].join(' ');

  return (
    <header className={`sticky top-8 z-50 mx-auto mt-8 w-[calc(100%-2rem)] max-w-[1080px] ${className}`}>
      {/* Skip link — visible only on keyboard focus. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:-top-2 focus:left-4 focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:text-black"
      >
        Skip to content
      </a>

      <nav
        aria-label="Main navigation"
        className={[
          'flex h-[58px] items-center justify-between gap-4 rounded-full border border-white/15 bg-[#0a0a0a] pl-6 pr-3',
          'transition-shadow duration-300',
          scrolled ? 'shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur' : 'shadow-[0_4px_24px_rgba(0,0,0,0.25)]',
        ].join(' ')}
      >
        {/* Wordmark — SANS (serif superseded 2026-11-10). */}
        <Link
          href="/"
          aria-label="Mentorly — home"
          className="shrink-0 rounded-full text-[24px] font-semibold leading-none tracking-[-0.02em] text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
        >
          Mentorly
        </Link>

        {/* Desktop links — centre/right, as in the screenshot. The list
          renders only when NAV_LINKS is non-empty: it is empty today
          (Admin Panel removed 2026-11-19), so no empty <ul> is left
          behind in the pill. */}
        {NAV_LINKS.length > 0 && (
          <ul className="hidden items-center gap-7 lg:flex">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  aria-current={activeSection === link.href ? 'true' : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    goToSection(link.href);
                  }}
                  className={linkClass(link.href)}
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        )}

        {/* Desktop actions. */}
        <div className="hidden items-center gap-5 lg:flex">
          {isLoaded && !isSignedIn && (
            <AuthLink
              tab="login"
              onAuthClick={onAuthClick}
              className="text-[16px] leading-none text-white/90 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
            >
              Login
            </AuthLink>
          )}
          {isSignedIn ? (
            <>
              <Link
                href={dashboardHref}
                className="flex items-center gap-2 rounded-full bg-zinc-700 px-5 py-2.5 text-[16px] font-medium leading-none text-white transition-colors hover:bg-zinc-600 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
              >
                Go to Dashboard
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-1.5 text-[16px] leading-none text-white/90 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Logout
              </button>
            </>
          ) : (
            <AuthLink
              tab="register"
              onAuthClick={onAuthClick}
              className="flex items-center gap-2 rounded-full bg-zinc-700 px-5 py-2.5 text-[16px] font-medium leading-none text-white transition-colors hover:bg-zinc-600 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
            >
              Get Started
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </AuthLink>
          )}
        </div>

        {/* Mobile hamburger. */}
        <button
          ref={menuButtonRef}
          type="button"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          aria-controls="mentorly-mobile-menu"
          onClick={() => setMenuOpen((open) => !open)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white lg:hidden"
        >
          {menuOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
        </button>
      </nav>

      {/* Mobile menu — same black pill language, drops below the bar. */}
      {menuOpen && (
        <div
          ref={menuRef}
          id="mentorly-mobile-menu"
          className="mt-2 rounded-[28px] border border-white/15 bg-[#0a0a0a] p-3 shadow-[0_12px_40px_rgba(0,0,0,0.45)] lg:hidden"
        >
          {NAV_LINKS.length > 0 && (
            <ul className="flex flex-col">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    aria-current={activeSection === link.href ? 'true' : undefined}
                    onClick={(e) => {
                      e.preventDefault();
                      goToSection(link.href);
                    }}
                    className={`block rounded-2xl px-4 py-3.5 text-[17px] text-white/90 transition-colors hover:bg-white/10 hover:text-white ${
                      activeSection === link.href ? 'bg-white/10 text-white' : ''
                    }`}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          )}
          {/* No divider above the actions when the nav list is empty —
            otherwise a hairline would sit at the top of the menu with
            nothing above it. */}
          <div className={NAV_LINKS.length > 0 ? 'mt-2 flex flex-col gap-2 border-t border-white/10 pt-3' : 'flex flex-col gap-2'}>
            {isSignedIn ? (
              <>
                <Link
                  href={dashboardHref}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center justify-center gap-2 rounded-full bg-zinc-700 px-6 py-3.5 text-[17px] font-medium text-white transition-colors hover:bg-zinc-600"
                >
                  Go to Dashboard
                  <ArrowUpRight className="h-[18px] w-[18px]" aria-hidden="true" />
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-full px-6 py-3 text-center text-[17px] text-white/90 transition-colors hover:bg-white/10 hover:text-white"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <AuthLink
                  tab="register"
                  onAuthClick={onAuthClick}
                  onPress={() => setMenuOpen(false)}
                  className="flex items-center justify-center gap-2 rounded-full bg-zinc-700 px-6 py-3.5 text-[17px] font-medium text-white transition-colors hover:bg-zinc-600"
                >
                  Get Started
                  <ArrowUpRight className="h-[18px] w-[18px]" aria-hidden="true" />
                </AuthLink>
                <AuthLink
                  tab="login"
                  onAuthClick={onAuthClick}
                  onPress={() => setMenuOpen(false)}
                  className="rounded-full px-6 py-3 text-center text-[17px] text-white/90 transition-colors hover:bg-white/10 hover:text-white"
                >
                  Login
                </AuthLink>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

export default LandingHeader;
