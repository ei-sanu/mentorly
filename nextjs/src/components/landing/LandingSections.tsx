'use client';

/**
 * Mentorly — landing sections.
 *
 * HERO REDESIGN (2026-11-11): the centred hero from 2026-11-10 (grey "M"
 * circle + "Mentorly" pill + huge centred headline + dot-particle
 * ThreeBackground) was not spacious and its scale was inconsistent.
 * The hero is now a two-column Opero-style layout — layout and rhythm
 * taken from the Opero Labs reference Somesh sent (left-aligned text
 * column, visual on the right, black + light button pair, quiet trust
 * line at the bottom). NOT copied: Opero's copy, brand, or isometric
 * browser artwork, or the Meta / Microsoft / character.ai / Cohere /
 * OpenAI logos and "collaborates with leading AI organizations" line.
 *
 * - LEFT: headline (same Mentorly words, left-aligned, 60px desktop),
 *   one short subcopy line, two equal-height buttons: black primary
 *   "Find a mentor" (opens the AuthModal popup on the home page when
 *   HomePage passes onAuthClick, 2026-11-11; falls back to /login)
 *   + light-grey secondary "How it works" (→ #how-it-works).
 * - RIGHT: an ORIGINAL inline-SVG isometric line illustration of a
 *   mentorship session (video call + next-session card + chat + goals),
 *   black hairlines on white/light grey, no colour, no stock photo,
 *   no AI image, no copied logos. It scales by viewBox and stacks
 *   below the text on mobile.
 * - BOTTOM: TrustStrip restyled to the quiet Opero treatment — no white
 *   card, just a hairline and muted 14px plain-text platform facts.
 *   No brands, no stats, no invented partners.
 *
 * The dot-particle ThreeBackground is UNMOUNTED from the hero in
 * HomePage.tsx (2026-11-11) — the component file stays in place.
 *
 * ServicesSection / ClosingCTA are unchanged from the 2026-11-10
 * minimal-theme version. TRUST STRIP: plain text of real platform
 * facts only. SERVICES: real Mentorly features.
 */
import Link from 'next/link';
import { Search, GraduationCap, CalendarCheck, MessagesSquare, ArrowUpRight } from 'lucide-react';
import { scrollToSection } from '../layout/smooth-scroll';

/* ── Trust strip: real platform facts only — no brands, no stats ─────── */
const TRUST_ITEMS = [
  'Verified alumni mentors',
  '1-to-1 sessions',
  'Goals & action plans',
  'Students & alumni',
] as const;

const SERVICES = [
  {
    icon: Search,
    title: 'Find a mentor',
    body: 'Browse verified alumni by industry, skills and experience, and send a request to the right person.',
    href: '/login',
    anchor: false,
  },
  {
    icon: GraduationCap,
    title: 'Become a mentor',
    body: 'Share what your career taught you. Accept the requests you have time for — nothing more.',
    href: '#for-mentors',
    anchor: true,
  },
  {
    icon: CalendarCheck,
    title: 'Sessions & goals',
    body: 'Meet for focused sessions, set small goals together, and keep track of what actually happened.',
    href: '#how-it-works',
    anchor: true,
  },
  {
    icon: MessagesSquare,
    title: 'Community & stories',
    body: 'Message your mentor directly and read how other students used mentorship to move forward.',
    href: '#testimonials',
    anchor: true,
  },
] as const;

/* ── Original isometric line illustration: a mentorship session ────────
 * Video-call window (mentor + student), a next-session calendar card,
 * a chat card and a goals checklist, joined by dashed paths on a dotted
 * isometric floor. Black hairlines on white / light grey only. Pure
 * inline SVG — no image file, no copied artwork. */
function HeroIllustration() {
  return (
    <div className="mx-auto w-full max-w-[520px] lg:mx-0">
      <svg
        viewBox="0 0 560 470"
        role="img"
        aria-label="Illustration of a mentorship video call with a next-session card, chat and goals checklist"
        className="h-auto w-full"
      >
        <defs>
          <pattern id="hero-dots" width="22" height="22" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.3" fill="#c9c9c9" />
          </pattern>
        </defs>

        {/* Dotted isometric floor */}
        <polygon
          points="80,330 280,220 480,330 280,440"
          fill="url(#hero-dots)"
          stroke="#111111"
          strokeOpacity="0.2"
          strokeWidth="1"
        />

        {/* Dashed connectors between the cards */}
        <path d="M 250 300 C 300 320, 320 320, 350 315" fill="none" stroke="#999999" strokeWidth="1.2" strokeDasharray="4 4" />
        <path d="M 400 250 C 420 220, 430 200, 440 185" fill="none" stroke="#999999" strokeWidth="1.2" strokeDasharray="4 4" />

        {/* ── Video-call window ── */}
        <g transform="translate(140 55) rotate(-2 140 105)">
          <rect x="0" y="0" width="280" height="212" rx="14" fill="#ffffff" stroke="#111111" strokeWidth="1.5" />
          <line x1="16" y1="34" x2="264" y2="34" stroke="#111111" strokeOpacity="0.15" strokeWidth="1" />
          <circle cx="26" cy="17" r="4" fill="#111111" />
          <circle cx="40" cy="17" r="4" fill="#ffffff" stroke="#111111" strokeWidth="1.2" />
          <circle cx="54" cy="17" r="4" fill="#ffffff" stroke="#111111" strokeWidth="1.2" />
          {/* Mentor tile */}
          <rect x="16" y="46" width="122" height="112" rx="10" fill="#f5f5f5" stroke="#111111" strokeWidth="1.2" />
          <circle cx="77" cy="88" r="17" fill="#ffffff" stroke="#111111" strokeWidth="1.2" />
          <path d="M 55 132 C 55 116, 99 116, 99 132" fill="none" stroke="#111111" strokeWidth="1.2" />
          <rect x="28" y="140" width="98" height="12" rx="6" fill="#e8e8e8" />
          <text x="77" y="149" textAnchor="middle" fontSize="9" fill="#555555" fontFamily="Inter, sans-serif">Mentor</text>
          {/* Student tile */}
          <rect x="146" y="46" width="122" height="112" rx="10" fill="#f5f5f5" stroke="#111111" strokeWidth="1.2" />
          <circle cx="207" cy="88" r="17" fill="#ffffff" stroke="#111111" strokeWidth="1.2" />
          <path d="M 185 132 C 185 116, 229 116, 229 132" fill="none" stroke="#111111" strokeWidth="1.2" />
          <rect x="158" y="140" width="98" height="12" rx="6" fill="#e8e8e8" />
          <text x="207" y="149" textAnchor="middle" fontSize="9" fill="#555555" fontFamily="Inter, sans-serif">Student</text>
          {/* Call controls */}
          <circle cx="118" cy="186" r="11" fill="#ffffff" stroke="#111111" strokeWidth="1.2" />
          <circle cx="140" cy="186" r="11" fill="#111111" />
          <circle cx="162" cy="186" r="11" fill="#ffffff" stroke="#111111" strokeWidth="1.2" />
          <rect x="114" y="182" width="8" height="8" rx="4" fill="#111111" />
        </g>

        {/* ── Next-session calendar card ── */}
        <g transform="translate(52 288) rotate(3 75 55)">
          <rect x="0" y="0" width="150" height="112" rx="12" fill="#ffffff" stroke="#111111" strokeWidth="1.5" />
          <text x="16" y="24" fontSize="11" fontWeight="600" fill="#111111" fontFamily="Inter, sans-serif">Next session</text>
          <text x="16" y="42" fontSize="10" fill="#6b6b6b" fontFamily="Inter, sans-serif">Tue · 4:00 PM</text>
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <rect key={i} x={16 + i * 18} y="56" width="12" height="12" rx="3" fill={i === 2 ? '#111111' : '#ffffff'} stroke="#111111" strokeWidth="1" />
          ))}
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <rect key={i} x={16 + i * 18} y="74" width="12" height="12" rx="3" fill="#ffffff" stroke="#111111" strokeWidth="1" />
          ))}
          <path d="M 105 96 l 4 4 l 7 -8" fill="none" stroke="#111111" strokeWidth="1.5" />
          <text x="16" y="101" fontSize="10" fill="#6b6b6b" fontFamily="Inter, sans-serif">Confirmed</text>
        </g>

        {/* ── Chat card ── */}
        <g transform="translate(356 268) rotate(-3 80 48)">
          <rect x="0" y="0" width="164" height="98" rx="12" fill="#ffffff" stroke="#111111" strokeWidth="1.5" />
          <rect x="14" y="14" width="96" height="18" rx="9" fill="#f0f0f0" />
          <rect x="54" y="40" width="96" height="18" rx="9" fill="#111111" />
          <rect x="14" y="66" width="70" height="18" rx="9" fill="#f0f0f0" />
        </g>

        {/* ── Goals checklist card ── */}
        <g transform="translate(368 118) rotate(2 75 60)">
          <rect x="0" y="0" width="150" height="122" rx="12" fill="#ffffff" stroke="#111111" strokeWidth="1.5" />
          <text x="16" y="24" fontSize="11" fontWeight="600" fill="#111111" fontFamily="Inter, sans-serif">Goals</text>
          {[
            { y: 44, done: true, label: 'Resume review' },
            { y: 70, done: true, label: 'Mock interview' },
            { y: 96, done: false, label: 'Apply · 5 roles' },
          ].map((row) => (
            <g key={row.label}>
              <circle cx="24" cy={row.y} r="7" fill={row.done ? '#111111' : '#ffffff'} stroke="#111111" strokeWidth="1.2" />
              {row.done && <path d={`M 21 ${row.y} l 2.5 2.5 l 4.5 -5`} fill="none" stroke="#ffffff" strokeWidth="1.4" />}
              <text x="38" y={row.y + 3.5} fontSize="10" fill="#333333" fontFamily="Inter, sans-serif">{row.label}</text>
            </g>
          ))}
        </g>

        {/* ── Floating Mentorly mark ── */}
        <g transform="translate(296 26) rotate(8 14 14)">
          <rect x="0" y="0" width="28" height="28" rx="7" fill="#111111" />
          <text x="14" y="20" textAnchor="middle" fontSize="15" fontWeight="600" fill="#ffffff" fontFamily="Inter, sans-serif">M</text>
        </g>
      </svg>
    </div>
  );
}

export function MentorlyHero({ onAuthClick }: { onAuthClick?: (tab: 'login' | 'register') => void } = {}) {
  return (
    <section aria-labelledby="landing-hero-heading" className="px-6 pb-20 pt-24 sm:pt-28">
      <div className="mx-auto grid max-w-[1200px] items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        <div>
          <h1
            id="landing-hero-heading"
            className="max-w-[560px] text-[40px] font-medium leading-[1.08] tracking-[-0.02em] text-[#111111] sm:text-[60px]"
          >
            Find a mentor who has walked your path.
          </h1>
          <p className="mt-6 max-w-[520px] text-[17px] leading-[1.7] text-[#555555]">
            Alumni mentorship for students — real people, real experience, one conversation at a time.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            {onAuthClick ? (
              <button type="button" onClick={() => onAuthClick('register')} className="mentorly-btn-black">
                Find a mentor
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : (
              <Link href="/login" className="mentorly-btn-black">
                Find a mentor
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            )}
            <a
              href="#how-it-works"
              className="mentorly-btn-grey"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('how-it-works');
              }}
            >
              How it works
            </a>
          </div>
        </div>
        <HeroIllustration />
      </div>
    </section>
  );
}

export function TrustStrip() {
  return (
    <section aria-label="What Mentorly is" className="px-6 pb-16">
      <div className="mx-auto max-w-[1200px] border-t border-[rgba(0,0,0,0.08)] pt-6">
        <ul className="flex flex-wrap items-center gap-x-10 gap-y-2">
          {TRUST_ITEMS.map((item) => (
            <li key={item} className="text-[14px] font-medium text-[#6b6b6b]">
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function ServicesSection() {
  return (
    <section id="services" aria-labelledby="services-heading" className="px-6 py-24 text-center">
      <h2
        id="services-heading"
        className="mx-auto max-w-[640px] text-[32px] font-medium leading-[1.25] tracking-[-0.02em] text-[#111111] sm:text-[40px]"
      >
        Mentorship that covers the whole journey.
      </h2>
      <p className="mx-auto mt-4 max-w-[480px] text-[15px] leading-[1.7] text-[#6b6b6b]">
        From the first request to the last goal — everything in one place.
      </p>
      <div className="mx-auto mt-14 grid max-w-[1120px] grid-cols-1 gap-10 text-left sm:grid-cols-2 lg:grid-cols-4">
        {SERVICES.map((service) => {
          const Icon = service.icon;
          const inner = (
            <>
              <Icon className="h-6 w-6 text-[#111111]" aria-hidden="true" />
              <h3 className="mt-4 text-[17px] font-medium text-[#111111]">{service.title}</h3>
              <p className="mt-2 text-[14px] leading-[1.7] text-[#6b6b6b]">{service.body}</p>
            </>
          );
          return (
            <div key={service.title}>
              {service.anchor ? (
                <a
                  href={service.href}
                  className="block rounded-2xl p-2 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black"
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToSection(service.href.slice(1));
                  }}
                >
                  {inner}
                </a>
              ) : (
                <Link href={service.href} className="block rounded-2xl p-2 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black">
                  {inner}
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function ClosingCTA() {
  return (
    <section aria-labelledby="closing-cta-heading" className="px-4 pb-24 sm:px-6">
      <div className="mx-auto max-w-[1120px] rounded-[40px] bg-white px-6 py-20 text-center shadow-[0_8px_30px_rgba(0,0,0,0.05)]">
        <h2
          id="closing-cta-heading"
          className="mx-auto max-w-[560px] text-[32px] font-medium leading-[1.25] tracking-[-0.02em] text-[#111111] sm:text-[44px]"
        >
          Tell us where you want to go.
        </h2>
        <p className="mx-auto mt-4 max-w-[440px] text-[15px] leading-[1.7] text-[#6b6b6b]">
          Start with one mentor, one conversation, one next step.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/login" className="mentorly-btn-black">
            Get Started
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <a
            href="#how-it-works"
            className="mentorly-btn-white"
            onClick={(e) => {
              e.preventDefault();
              scrollToSection('how-it-works');
            }}
          >
            See how it works
          </a>
        </div>
      </div>
    </section>
  );
}

export default function LandingSections() {
  return (
    <>
      <MentorlyHero />
      <TrustStrip />
      <ServicesSection />
      <ClosingCTA />
    </>
  );
}
