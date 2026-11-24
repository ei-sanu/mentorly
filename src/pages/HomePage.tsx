'use client';

import { useEffect, useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  GraduationCap,
  ArrowRight,
  ArrowUpRight,
  Video,
  Target,
  Users,
  Star,
  Briefcase,
  Globe2,
  MessageSquare,
  CalendarCheck,
  TrendingUp,
  Award,
  Quote,
  ChevronDown,
  BookOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'motion/react';
import { LandingHeader } from '@/components/layout/landing-header';
import AuthModal from '@/components/auth/AuthModal';
import { LandingFooter } from '@/components/layout/landing-footer';
import MinimalAbout from '@/components/landing/MinimalAbout';
import { MentorlyHero, TrustStrip } from '@/components/landing/LandingSections';
import Waitlist from '@/components/landing/Waitlist';
import { initAnchorSmoothScroll, scrollToHashOnLoad } from '@/components/layout/smooth-scroll';

const STATS = [
  { icon: Users, value: '500+', label: 'Verified Alumni Mentors' },
  { icon: GraduationCap, value: '2,000+', label: 'Students Guided' },
  { icon: CalendarCheck, value: '8,000+', label: 'Sessions Completed' },
  { icon: Star, value: '4.9/5', label: 'Average Mentor Rating' },
];

const INDUSTRIES = [
  { icon: Briefcase, name: 'Software & IT', detail: 'SDE, Data Science, DevOps & Cloud' },
  { icon: TrendingUp, name: 'Finance & FinTech', detail: 'Investment Banking, Analytics & Audits' },
  { icon: Globe2, name: 'Consulting', detail: 'Strategy, Operations & Management' },
  { icon: Award, name: 'Core Engineering', detail: 'Mechanical, Civil, Electrical & Auto' },
  { icon: MessageSquare, name: 'Marketing & Media', detail: 'Digital Marketing, PR & Content' },
  { icon: BookOpen, name: 'Higher Studies', detail: 'MS, MBA, GRE/GMAT & Scholarships' },
];

const TESTIMONIALS = [
  {
    quote:
      'My mentor helped me restructure my resume and ran two mock interviews before my placement season. I landed an SDE offer at a product-based company in my very first attempt.',
    name: 'Priya Sharma',
    role: 'B.Tech CSE, 2025 Batch',
    highlight: 'Placed at a top product company',
  },
  {
    quote:
      'As an alumnus working abroad, Mentorly makes it effortless to give back. The structured session framework means every call is focused and genuinely useful for the student.',
    name: 'Rahul Verma',
    role: 'Senior Software Engineer, Alumnus',
    highlight: 'Mentoring 12+ students',
  },
  {
    quote:
      'The AI matching suggested a mentor from exactly the domain I wanted — fintech analytics. Within three sessions I had a clear roadmap for internships, projects, and certifications.',
    name: 'Ananya Gupta',
    role: 'B.Com Hons., 2026 Batch',
    highlight: 'Fintech internship secured',
  },
];

const FAQS = [
  {
    question: 'Is Mentorly free for students?',
    answer:
      'Yes. Mentorly is completely free for currently enrolled students. Simply sign up to start browsing and requesting mentorship sessions.',
  },
  {
    question: 'How are mentors verified?',
    answer:
      'Every mentor is a verified alumnus. Our admin team reviews each mentor application — checking graduation records, professional profiles, and employment history — before they can accept mentee requests.',
  },
  {
    question: 'How do mentoring sessions happen?',
    answer:
      'Once a mentor accepts your request, you can chat directly on the platform and schedule 1:1 video sessions at times that work for both of you. All communication stays within the platform for your safety.',
  },
  {
    question: 'Can alumni also join as mentors?',
    answer:
      'Absolutely. We actively welcome graduates from all batches and industries. Submit an onboarding request, complete verification, and start accepting mentees based on your availability.',
  },
  {
    question: 'What if a mentor is not a good fit?',
    answer:
      'No problem — you can end a mentorship anytime and request a different mentor. Our smart matching engine will use your feedback to suggest better-aligned mentors for your goals.',
  },
];

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  /* Auth popup state (2026-11-11): which tab the home-page AuthModal
     opens on, or null when closed. */
  const [authModalTab, setAuthModalTab] = useState<'login' | 'register' | null>(null);

  /* Smooth anchor scrolling past the floating pill (2026-11-10). */
  useEffect(() => {
    const cleanup = initAnchorSmoothScroll();
    scrollToHashOnLoad();
    return cleanup;
  }, []);

  /* For Mentors + Final CTA buttons open the auth popup (register tab)
     on the home page itself — no navigation away (2026-11-11). */
  const handleGetStarted = () => {
    setAuthModalTab('register');
  };

  const fadeIn = (delay: number) => ({
    initial: { opacity: 0, y: 20 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '-80px' },
    transition: { duration: 0.5, delay },
  });

  return (
    <div id="main-content" className="mentorly-light relative flex min-h-screen flex-col bg-[#f2f2f2] text-[#111111]">
      <div className="relative">
        <LandingHeader onAuthClick={(tab) => setAuthModalTab(tab)} />
      </div>

      <main className="relative flex-1">
        {/* Hero (2026-11-11 redesign): two-column Opero-style layout in
            MentorlyHero + quiet TrustStrip. The dot-particle
            ThreeBackground is unmounted from the hero — the component
            file stays in place (src/components/landing/ThreeBackground.tsx). */}
        <MentorlyHero onAuthClick={(tab) => setAuthModalTab(tab)} />
        <TrustStrip />

        {/* Concept — light minimal restyle (2026-11-10): flat white
            section, big sans headline on the left, small text on the
            right, credit line along the bottom. Mentorly copy only. */}
        <section className="relative overflow-hidden border-t border-black/10 bg-white" id="concept">
          <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-1/2 hidden border-l border-dashed border-black/10 md:block" />
          <div className="relative z-10 mx-auto grid max-w-7xl gap-16 px-4 py-24 md:grid-cols-2 md:items-center md:px-8 md:py-32">
            <motion.div {...fadeIn(0.1)}>
              <p className="label-caps mb-6 text-black/50">The concept</p>
              <h2 className="font-display text-6xl leading-[0.95] text-black md:text-7xl">
                <span className="block">Create new</span>
                <span className="block">career.</span>
              </h2>
              <span aria-hidden="true" className="mt-8 block h-[3px] w-12 bg-black" />
            </motion.div>
            <motion.div {...fadeIn(0.2)}>
              <p className="label-caps mb-4 text-[#9a9a9a]">What it is</p>
              <p className="max-w-md text-base leading-relaxed text-[#333333]">
                Mentorly pairs you with verified alumni across industries — so your next step starts with real experience, not guesswork.
              </p>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-[#6b6b6b]">
                Browse mentors, send a request, and meet on the platform. Every mentor is checked before they can accept a mentee.
              </p>
            </motion.div>
          </div>
          <div className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-4 pb-10 md:px-8">
            <p className="label-caps text-black/50">Created for the Mentorly community</p>
            <p className="label-caps text-[#9a9a9a]">Mentorly © 2026</p>
          </div>
        </section>

        {/* Stats */}
        <section className="border-t border-black/10 py-16">
          <div className="container mx-auto max-w-7xl px-4 md:px-8">
            <motion.div
              {...fadeIn(0.15)}
              className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6"
            >
              {STATS.map((stat) => (
                <div
                  key={stat.label}
                  className="flex flex-col items-center rounded-lg border border-black/10 bg-white p-6 text-center"
                >
                  <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-md border border-black/10 bg-white">
                    <stat.icon className="h-5 w-5 text-[#111111]" />
                  </span>
                  <p className="text-3xl font-semibold tracking-tight text-[#111111] tabular-nums">{stat.value}</p>
                  <p className="mt-1 text-sm text-[#6b6b6b]">{stat.label}</p>
                </div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* How It Works */}
        <section className="scroll-mt-28 border-t border-black/10 py-24" id="how-it-works">
          <div className="container mx-auto max-w-7xl px-4 md:px-8">
            <div className="mx-auto mb-16 max-w-3xl text-center">
              <p className="label-caps mb-4 text-[#9a9a9a]">How it works</p>
              <h2 className="font-display text-3xl tracking-tight text-[#111111] sm:text-4xl">
                How Mentorly Works
              </h2>
              <p className="mt-4 text-lg text-[#6b6b6b]">
                Three simple steps to accelerate your career growth with the help of experienced alumni.
              </p>
            </div>

            <div className="relative grid gap-8 md:grid-cols-3">
              <div className="absolute top-1/2 left-[10%] right-[10%] z-0 hidden h-px -translate-y-1/2 bg-black/5 md:block" />

              {[
                {
                  icon: Target,
                  step: '1. Find Your Match',
                  desc: 'Browse verified alumni by industry, role, or company. Our algorithm suggests the best mentors for your specific goals.',
                },
                {
                  icon: ArrowRight,
                  step: '2. Connect & Request',
                  desc: 'Send a personalized mentorship request. Once accepted, you can securely message your mentor directly on the platform.',
                },
                {
                  icon: Video,
                  step: '3. Grow Together',
                  desc: 'Schedule 1:1 sessions, get resume reviews, and track your progress through our structured mentorship framework.',
                },
              ].map((item, i) => (
                <motion.div key={item.step} {...fadeIn(i * 0.1)}>
                  <div className="pulse-card relative z-10 flex h-full flex-col items-center rounded-lg border p-6 text-center">
                    <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-md border border-black/10 bg-white text-[#111111]">
                      <item.icon className="h-8 w-8" />
                    </div>
                    <h3 className="mb-2 text-xl font-bold text-[#111111]">{item.step}</h3>
                    <p className="text-[#6b6b6b]">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Industries */}
        <section className="scroll-mt-28 border-t border-black/10 py-24" id="industries">
          <div className="container mx-auto max-w-7xl px-4 md:px-8">
            <div className="mx-auto mb-16 max-w-3xl text-center">
              <p className="label-caps mb-4 text-[#9a9a9a]">Explore Domains</p>
              <h2 className="font-display text-3xl tracking-tight text-[#111111] sm:text-4xl">
                Find mentors across every career path
              </h2>
              <p className="mt-4 text-lg text-[#6b6b6b]">
                From product engineering to higher studies abroad — our alumni network spans industries, roles, and
                geographies.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {INDUSTRIES.map((industry, i) => (
                <motion.div key={industry.name} {...fadeIn(i * 0.07)}>
                  <div className="pulse-card group flex h-full items-start gap-4 rounded-lg border p-6">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-black/10 bg-white text-[#111111] transition-colors group-hover:bg-black group-hover:text-white group-hover:border-black">
                      <industry.icon className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-[#111111]">{industry.name}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-[#6b6b6b]">{industry.detail}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Benefits / Trust */}
        <section className="scroll-mt-28 border-t border-black/10 py-24" id="benefits">
          <div className="container mx-auto max-w-7xl px-4 md:px-8">
            <div className="mx-auto mb-16 max-w-3xl text-center">
              <p className="label-caps mb-4 text-[#9a9a9a]">Why Mentorly</p>
              <h2 className="font-display text-3xl tracking-tight text-[#111111] sm:text-4xl">
                Why choose Mentorly?
              </h2>
              <p className="mt-4 text-lg text-[#6b6b6b]">
                Designed exclusively for the Mentorly community to foster meaningful professional relationships.
              </p>
            </div>
            <div className="grid gap-12 md:grid-cols-3">
              {[
                {
                  icon: ShieldCheck,
                  title: 'Verified Alumni',
                  desc: 'Every mentor is a verified graduate, ensuring authentic and safe interactions.',
                },
                {
                  icon: CheckCircle2,
                  title: 'AI-Powered Matches',
                  desc: 'Our smart matching engine connects you with mentors whose expertise perfectly aligns with your career trajectory.',
                },
                {
                  icon: GraduationCap,
                  title: 'Structured Growth',
                  desc: 'Manage sessions, set actionable milestones, and track your career progress in one unified workspace.',
                },
              ].map((benefit, i) => (
                <motion.div key={benefit.title} {...fadeIn(i * 0.1)} className="flex flex-col items-center text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-md border border-black/10 bg-white text-[#111111]">
                    <benefit.icon className="h-8 w-8" />
                  </div>
                  <h3 className="mb-2 text-xl font-bold text-[#111111]">{benefit.title}</h3>
                  <p className="text-[#6b6b6b]">{benefit.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="scroll-mt-28 border-t border-black/10 py-24" id="testimonials">
          <div className="container mx-auto max-w-7xl px-4 md:px-8">
            <div className="mx-auto mb-16 max-w-3xl text-center">
              <p className="label-caps mb-4 text-[#9a9a9a]">Success Stories</p>
              <h2 className="font-display text-3xl tracking-tight text-[#111111] sm:text-4xl">
                Loved by students and mentors alike
              </h2>
              <p className="mt-4 text-lg text-[#6b6b6b]">
                Real stories from the Mentorly community — placements secured, careers accelerated, and knowledge passed on.
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-3">
              {TESTIMONIALS.map((t, i) => (
                <motion.figure key={t.name} {...fadeIn(i * 0.1)}>
                  <div className="pulse-card flex h-full flex-col rounded-lg border p-8">
                    <Quote className="mb-4 h-8 w-8 text-[#9a9a9a]" fill="currentColor" />
                    <blockquote className="flex-1 leading-relaxed text-[#555555]">
                      &ldquo;{t.quote}&rdquo;
                    </blockquote>
                    <figcaption className="mt-6 flex items-center gap-3 border-t border-black/10 pt-6">
                      <div className="flex h-11 w-11 items-center justify-center rounded-md border border-black/10 bg-white text-[#111111]">
                        <GraduationCap className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-bold text-[#111111]">{t.name}</p>
                        <p className="text-sm text-[#9a9a9a]">{t.role}</p>
                      </div>
                    </figcaption>
                    <div className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-sm border border-black/10 bg-black/5 px-3 py-1 text-xs font-semibold text-[#111111]">
                      <TrendingUp className="h-3.5 w-3.5" />
                      {t.highlight}
                    </div>
                  </div>
                </motion.figure>
              ))}
            </div>
          </div>
        </section>

        {/* For Mentors */}
        <section className="border-t border-black/10 py-24" id="for-mentors">
          <div className="container mx-auto max-w-7xl px-4 md:px-8">
            <div className="relative overflow-hidden rounded-lg bg-white text-black">
              <div className="relative grid items-center gap-10 p-10 md:p-16 lg:grid-cols-2">
                <div>
                  <span className="mb-6 inline-flex items-center gap-2 bg-black/10 px-3 py-1 text-sm font-medium">
                    <Users className="h-4 w-4" />
                    For Alumni
                  </span>
                  <h2 className="font-display text-3xl leading-tight tracking-tight sm:text-4xl">
                    Give back. Guide the next generation of Chardi Kala professionals.
                  </h2>
                  <p className="mt-4 text-lg leading-relaxed text-zinc-700">
                    Share your industry experience with students walking the path you once did. Choose your own
                    availability, pick mentees who match your expertise, and make a measurable impact — just an hour a
                    week.
                  </p>
                  <ul className="mt-8 space-y-3">
                    {[
                      'Set your own availability and mentee capacity',
                      'Choose requests that match your expertise',
                      'Build your mentoring track record and profile',
                    ].map((point) => (
                      <li key={point} className="flex items-center gap-3 text-zinc-800">
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-black" />
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex flex-col items-center lg:items-end">
                  <div className="w-full max-w-sm rounded-lg bg-black p-8 text-center text-white">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-md border border-white/20 bg-white/10 text-white">
                      <Award className="h-7 w-7" />
                    </div>
                    <h3 className="text-xl font-bold">Become a Verified Mentor</h3>
                    <p className="mt-2 text-sm leading-relaxed text-white/70">
                      Complete a quick verification of your degree and professional profile. Most applications are
                      reviewed within 48 hours.
                    </p>
                    <Button
                      size="lg"
                      className="glass-pill-active mt-6 h-12 w-full rounded-md text-base font-bold"
                      onClick={handleGetStarted}
                    >
                      Start Mentor Onboarding
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                    <p className="mt-3 text-xs text-white/60">Free forever for alumni volunteers</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="scroll-mt-28 border-t border-black/10 py-24" id="faq">
          <div className="container mx-auto max-w-3xl px-4 md:px-8">
            <div className="mb-16 text-center">
              <p className="label-caps mb-4 text-[#9a9a9a]">FAQ</p>
              <h2 className="font-display text-3xl tracking-tight text-[#111111] sm:text-4xl">
                Frequently asked questions
              </h2>
              <p className="mt-4 text-lg text-[#6b6b6b]">
                Everything you need to know about getting started with Mentorly.
              </p>
            </div>

            <div className="space-y-4">
              {FAQS.map((faq, i) => {
                const isOpen = openFaq === i;
                return (
                  <motion.div key={faq.question} {...fadeIn(i * 0.05)}>
                    <button
                      onClick={() => setOpenFaq(isOpen ? null : i)}
                      className={`pulse-card w-full rounded-lg border p-6 text-left transition-all ${
                        isOpen ? 'ring-1 ring-black/20' : ''
                      }`}
                      aria-expanded={isOpen}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <h3 className="font-bold text-[#111111]">{faq.question}</h3>
                        <ChevronDown
                          className={`h-5 w-5 shrink-0 text-[#111111] transition-transform duration-200 ${
                            isOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </div>
                      <div
                        className={`grid transition-all duration-200 ease-in-out ${
                          isOpen ? 'grid-rows-[1fr] opacity-100 mt-3' : 'grid-rows-[0fr] opacity-0'
                        }`}
                      >
                        <div className="overflow-hidden">
                          <p className="leading-relaxed text-[#6b6b6b]">{faq.answer}</p>
                        </div>
                      </div>
                    </button>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Minimal About + Waitlist (2026-11-10 minimal theme). */}
        <MinimalAbout />
        <Waitlist />

        {/* Final CTA */}
        <section className="border-t border-black/10 py-24">
          <div className="container mx-auto max-w-4xl px-4 text-center md:px-8">
            <motion.div {...fadeIn(0)}>
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-md border border-black/10 bg-white">
                <GraduationCap className="h-8 w-8 text-[#111111]" />
              </div>
              <h2 className="font-display text-3xl leading-tight tracking-tight text-[#111111] sm:text-4xl md:text-5xl">
                Your career deserves a great mentor.
              </h2>
              <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-[#6b6b6b]">
                Join thousands of students already accelerating their journeys with guidance from verified alumni.
                Sign up today — your first mentorship request takes less than two minutes.
              </p>
              <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
                <Button
                  size="lg"
                  className="h-14 rounded-md px-10 text-base font-bold"
                  onClick={handleGetStarted}
                >
                  Get Started — It&apos;s Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
              <p className="mt-4 text-sm text-[#9a9a9a]">
                No credit card required · Open to all students and alumni
              </p>
            </motion.div>
          </div>
        </section>
      </main>

      <div className="relative">
        <LandingFooter />
      </div>

      {/* Auth popup (2026-11-11): dark frosted-glass iOS modal on the home
          page itself — Login / Get Started / hero / CTA buttons open it,
          Escape / backdrop / X close it, no navigation away. Mounted only
          while open, so the form remounts fresh on the requested tab. */}
      {authModalTab !== null && (
        <AuthModal initialTab={authModalTab} onClose={() => setAuthModalTab(null)} />
      )}
    </div>
  );
}
