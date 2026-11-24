'use client';

/**
 * Mentorly — early-access waitlist section.
 *
 * WHERE IT GOES (Mac): /Users/somesh/Projects/alumniconnect/alumninetwork
 *   Save as `src/components/landing/Waitlist.tsx` (new file) and mount
 *   it on the landing page in `src/pages/HomePage.tsx` where early
 *   access is offered (e.g. after the services section):
 *
 *     import Waitlist from '../components/landing/Waitlist';
 *     <Waitlist />
 *
 *   Requires `mentorly-minimal.css` to be imported (see that file).
 *
 * WHAT IT IS: the EarlyBird-style waitlist reference (2026-11-10,
 * 9.22.34 screenshot), rebuilt for Mentorly. Layout taken from it:
 * small black circular logo mark on top, tiny "goes live soon" pill
 * with a green status dot, large centred headline, 2-line subcopy,
 * email input + black "Join Waitlist" pill in one row, 3-column
 * features (black circle icon + title + 2-line copy), and a white
 * "Mission" card (label, headline, short paragraphs, bold fact lines).
 * NOT copied: "Early Access to Future of AI Growth", "Automate tasks…
 * scale your team's productivity", the 8,258+ count, November 2025,
 * "Save 10+ hours weekly", "SaaS & AI founders", Daniel Hayes /
 * Founder of EarlyBird, or any AI-growth / SaaS product claims.
 *
 * HONEST SUBMIT (read this before wiring it up):
 * - Pass `onSubmit(email)` to POST the address to Mentorly's real
 *   waitlist endpoint. TO-CONFIRM: whether such an endpoint exists —
 *   search the backend for it first (see README-APPLY.md). If none
 *   exists, do NOT invent one: leave `onSubmit` unset.
 * - With no `onSubmit`, the form still works: it validates the email,
 *   saves it to localStorage (`mentorly-waitlist`) on this device, and
 *   shows the success state. A small caption under the form says so
 *   plainly ("stored on this device until the waitlist endpoint is
 *   connected") — the success state never pretends a server saved it.
 * - SOCIAL PROOF IS OMITTED on purpose: no real Mentorly waitlist
 *   count exists, so there is no "Join N+ …" line. Do not invent one.
 * - MISSION CARD FACT LINES: only "Built For: Students and alumni"
 *   is stated, because that is known. Launch Date and Key Benefit are
 *   LEFT OUT (unknown — flagged to-confirm in README-APPLY.md), and
 *   there is no founder row (no founder is named in Mentorly's copy).
 * - The green dot in the pill is a status indicator, kept from the
 *   reference; it is the only colour on this section.
 */
import { useState, type FormEvent } from 'react';
import { ShieldCheck, CalendarCheck, Target, Check } from 'lucide-react';

const FEATURES = [
  {
    icon: ShieldCheck,
    title: 'Verified mentors',
    body: 'Alumni whose background has been checked — not just anyone with a profile.',
  },
  {
    icon: CalendarCheck,
    title: '1-to-1 sessions',
    body: 'Focused conversations, booked around your week, with clear notes after.',
  },
  {
    icon: Target,
    title: 'Goals that stick',
    body: 'Small goals, set together, tracked until they are done — or changed.',
  },
] as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const LOCAL_KEY = 'mentorly-waitlist';

export interface WaitlistProps {
  /**
   * Real submit handler, e.g. `async (email) => { await api.joinWaitlist(email); }`.
   * TO-CONFIRM: whether a Mentorly waitlist endpoint exists (see README).
   * If omitted, the email is saved to localStorage on this device only.
   */
  onSubmit?: (email: string) => Promise<void>;
}

export default function Waitlist({ onSubmit }: WaitlistProps) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const isLocalOnly = !onSubmit;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
      setError('Enter a valid email address, e.g. you@example.com.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      if (onSubmit) {
        await onSubmit(value);
      } else {
        const existing: string[] = JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '[]');
        if (!existing.includes(value)) {
          localStorage.setItem(LOCAL_KEY, JSON.stringify([...existing, value]));
        }
      }
      setDone(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section aria-labelledby="waitlist-heading" className="px-6 py-24" style={{ background: '#f7f7f7' }}>
      <div className="mx-auto max-w-[720px] text-center">
        {/* Black circular logo mark. */}
        <div aria-hidden="true" className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#0a0a0a] text-[20px] font-semibold text-white">
          M
        </div>

        {/* Status pill — green dot is a status indicator (see header). */}
        <p className="mt-6 inline-flex items-center gap-2 text-[13px] font-medium text-[#333333]">
          <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
          Early access — opening soon
        </p>

        <h2
          id="waitlist-heading"
          className="mx-auto mt-5 max-w-[560px] text-[36px] font-medium leading-[1.2] tracking-[-0.02em] text-[#111111] sm:text-[48px]"
        >
          Early access to Mentorly
        </h2>
        <p className="mx-auto mt-4 max-w-[480px] text-[15px] leading-[1.7] text-[#6b6b6b]">
          Be first in line when new mentor places open. One email when
          it&rsquo;s your turn — nothing else.
        </p>

        {/* Form / success state. */}
        {done ? (
          <p role="status" className="mx-auto mt-8 flex max-w-[520px] items-center justify-center gap-2 rounded-full bg-white px-6 py-4 text-[15px] font-medium text-[#111111] shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
            <Check className="h-5 w-5" aria-hidden="true" />
            You&rsquo;re on the list — we&rsquo;ll email you when your place opens.
          </p>
        ) : (
          <form onSubmit={submit} noValidate className="mx-auto mt-8 max-w-[520px]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:rounded-full sm:bg-white sm:p-1.5 sm:shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
              <label htmlFor="waitlist-email" className="sr-only">
                Email address
              </label>
              <input
                id="waitlist-email"
                type="email"
                autoComplete="email"
                placeholder="Your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? 'waitlist-error' : undefined}
                className="w-full flex-1 rounded-full bg-white px-5 py-3.5 text-[15px] text-[#111111] placeholder:text-[#9a9a9a] focus:outline-none sm:bg-transparent sm:py-3"
              />
              <button type="submit" disabled={submitting} className="mentorly-btn-black shrink-0">
                {submitting ? 'Joining…' : 'Join Waitlist'}
              </button>
            </div>
            {error && (
              <p id="waitlist-error" role="alert" className="mt-3 text-[14px] text-red-700">
                {error}
              </p>
            )}
            {isLocalOnly && !error && (
              <p className="mt-3 text-[13px] text-[#9a9a9a]">
                Stored on this device until the Mentorly waitlist endpoint is connected.
              </p>
            )}
          </form>
        )}

        {/* 3 features. */}
        <div className="mt-16 grid grid-cols-1 gap-10 sm:grid-cols-3">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <div key={feature.title} className="flex flex-col items-center text-center">
                <div aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-full bg-[#0a0a0a] text-white">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-[15px] font-medium text-[#111111]">{feature.title}</h3>
                <p className="mt-2 max-w-[220px] text-[14px] leading-[1.7] text-[#6b6b6b]">{feature.body}</p>
              </div>
            );
          })}
        </div>

        {/* Mission card — only the fact line that is known is shown. */}
        <div className="mt-20 rounded-[24px] bg-white px-8 py-10 text-left shadow-[0_8px_30px_rgba(0,0,0,0.05)] sm:px-12">
          <p className="text-[13px] font-medium uppercase tracking-[0.08em] text-[#6b6b6b]">Mission</p>
          <h3 className="mt-5 text-[26px] font-medium leading-[1.3] tracking-[-0.02em] text-[#111111] sm:text-[32px]">
            Mentorship every student can reach.
          </h3>
          <p className="mt-5 text-[15px] leading-[1.8] text-[#333333]">
            Mentorly exists because the most useful career advice rarely comes from a classroom. It comes from
            someone a few years ahead who remembers being exactly where you are — and has time for one honest conversation.
          </p>
          <p className="mt-4 text-[15px] leading-[1.8] text-[#333333]">
            We keep it simple on purpose: verified alumni, clear requests, sessions and goals you can actually
            keep track of. No feeds, no noise, no paywalled introductions.
          </p>
          <dl className="mt-8 space-y-2 text-[15px] leading-[1.7]">
            <div className="flex gap-2">
              <dt className="font-semibold text-[#111111]">Built For:</dt>
              <dd className="text-[#333333]">Students and alumni</dd>
            </div>
            {/* Launch Date and Key Benefit intentionally omitted — unknown.
                Add them here only once confirmed (see README-APPLY.md).
                No founder row — no founder is named in Mentorly's copy. */}
          </dl>
        </div>
      </div>
    </section>
  );
}
