'use client';

/**
 * Mentorly — minimal "About" section.
 *
 * WHERE IT GOES (Mac): /Users/somesh/Projects/alumniconnect/alumninetwork
 *   Save as `src/components/landing/MinimalAbout.tsx` (new file) and
 *   mount it on the landing page in `src/pages/HomePage.tsx`, e.g. after
 *   the hero / concept section:
 *
 *     import MinimalAbout from '../components/landing/MinimalAbout';
 *     <MinimalAbout />
 *
 *   Requires `mentorly-minimal.css` to be imported (see that file).
 *   Uses `lucide-react` icons — already a dependency of the frontend.
 *
 * WHAT IT IS: the Matthew about-page reference (2026-11-10, image.png),
 * rebuilt with Mentorly's own content. Style taken from the reference:
 * flat light-grey page, tiny top pill, small centred avatar + name,
 * one large light sans headline, white icon dock, narrow centred text
 * column, underlined in-text links, "Let's connect" close.
 * NOTHING is copied from it: no photo, no name, no bio, no BBDO / DDB /
 * Yandex / IKEA / Nike / Cannes Lions / CMO / IADAS, no brand row.
 *
 * AVATAR: a plain grey circle with "M". If Mentorly has a real logo or
 * avatar asset, pass it as `avatarSrc` — TO-CONFIRM which asset, if any.
 * BACK PILL: the reference has a "back" pill because it is a detail
 * view. The landing page has no detail view to go back from, so the
 * pill is rendered ONLY when `backHref` is passed (e.g. from a routed
 * /about page, backHref="/"). On the landing, omit the prop.
 *
 * DOCK: product sections only — no Mentorly social accounts are
 * invented, and no partner logos are used. Each tile links to a real
 * section/route. TO-CONFIRM: the "#for-mentors" anchor (see
 * README-APPLY.md) — change it in DOCK_ITEMS below if the section id
 * differs.
 */
import { Link } from 'react-router-dom';
import { Sun, Users, Search, GraduationCap, Compass, MessagesSquare, ArrowUpRight } from 'lucide-react';
import { scrollToSection } from '../layout/smooth-scroll';

/* ── Edit these two constants to change the dock / closing links ─────── */
const DOCK_ITEMS = [
  { label: 'Find a mentor', href: '/login', icon: Search, note: 'Guests sign in first (see README)' },
  { label: 'Become a mentor', href: '#for-mentors', icon: GraduationCap, note: 'TO-CONFIRM section id' },
  { label: 'How it works', href: '#how-it-works', icon: Compass, note: '' },
  { label: 'Stories', href: '#testimonials', icon: MessagesSquare, note: '' },
] as const;

export interface MinimalAboutProps {
  /** Optional real avatar/logo image. Defaults to a plain grey "M" circle. */
  avatarSrc?: string;
  /** Render the small "back" pill linking here. Omit on the landing page. */
  backHref?: string;
}

export default function MinimalAbout({ avatarSrc, backHref }: MinimalAboutProps) {
  const goTo = (href: string) => {
    if (href.startsWith('#')) scrollToSection(href.slice(1));
  };

  return (
    <section id="about" aria-labelledby="about-heading" className="px-6 py-24 sm:py-32">
      <div className="mx-auto max-w-[1120px] text-center">
        {/* Tiny top pill — sun icon + "about", as in the reference. No play
            button: there is no video to play, and a dead play icon would
            be a fake affordance. */}
        <p className="mentorly-pill">
          <Sun className="h-3.5 w-3.5" aria-hidden="true" />
          <span>about</span>
        </p>

        {/* Small centred avatar + name. */}
        <div className="mt-16 flex flex-col items-center">
          {avatarSrc ? (
            <img
              src={avatarSrc}
              alt=""
              className="h-[88px] w-[88px] rounded-full object-cover grayscale"
            />
          ) : (
            <div
              aria-hidden="true"
              className="flex h-[88px] w-[88px] items-center justify-center rounded-full bg-[#d9d9d9] text-[32px] font-medium text-[#555555]"
            >
              M
            </div>
          )}
          <p className="mt-4 text-[15px] text-[#111111]">Mentorly</p>
        </div>

        {/* One large sans headline, light/medium weight, tight leading. */}
        <h2
          id="about-heading"
          className="mx-auto mt-10 max-w-[720px] text-[40px] font-normal leading-[1.15] tracking-[-0.02em] text-[#111111] sm:text-[56px]"
        >
          Alumni mentorship,{' '}
          <Users className="inline h-[0.9em] w-[0.9em] align-[-0.08em] text-[#555555]" aria-hidden="true" />{' '}
          made simple.
        </h2>

        {/* White dock — Mentorly sections only. */}
        <div className="mt-16 flex justify-center">
          <nav aria-label="About this platform" className="mentorly-dock">
            {DOCK_ITEMS.map((item) => {
              const Icon = item.icon;
              const isAnchor = item.href.startsWith('#');
              return isAnchor ? (
                <a
                  key={item.label}
                  href={item.href}
                  title={item.label}
                  aria-label={item.label}
                  onClick={(e) => {
                    e.preventDefault();
                    goTo(item.href);
                  }}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </a>
              ) : (
                <Link key={item.label} to={item.href} title={item.label} aria-label={item.label}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Back pill — only when this is a routed detail view. */}
        {backHref && (
          <p className="mt-16">
            <Link to={backHref} className="mentorly-pill">
              <Sun className="h-3.5 w-3.5" aria-hidden="true" />
              <span>back</span>
            </Link>
          </p>
        )}

        {/* Narrow centred text column — short paragraphs, underlined links. */}
        <div className="mentorly-prose mentorly-narrow mt-16 text-left text-[15px] leading-[1.9] text-[#333333]">
          <p>Hi there. Mentorly is a place where students find alumni mentors — people who studied the same subjects, walked the same campus, and are now doing the work students want to do.</p>
          <p className="mt-6">
            Students browse <Link to="/login">verified mentors</Link>, read how they work, and send a mentorship request. Mentors accept the requests they have time for, and nothing starts until both sides agree.
          </p>
          <p className="mt-6">
            A mentorship is a few honest conversations, not a course. Mentor and student meet for <a href="#how-it-works" onClick={(e) => { e.preventDefault(); goTo('#how-it-works'); }}>sessions</a>, set small goals together, and keep track of what actually happened.
          </p>
          <p className="mt-6">Alumni join to give back an hour or two, not to take on a second job. Students join to ask the questions they cannot ask a syllabus.</p>
          <p className="mt-6">That is the whole idea. No feeds, no noise — just one student, one alumnus, and a clear next step.</p>

          <p className="mt-10 text-[#111111]">Let&rsquo;s connect</p>
          <p className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[14px] text-[#6b6b6b]">
            <Link to="/login" className="inline-flex items-center gap-1">
              Get started <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
            <Link to="/login" className="inline-flex items-center gap-1">
              Find a mentor <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
            <a
              href="#for-mentors"
              className="inline-flex items-center gap-1"
              onClick={(e) => {
                e.preventDefault();
                goTo('#for-mentors');
              }}
            >
              Become a mentor <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
