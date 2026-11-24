'use client';

import Link from 'next/link';
import { LpuLogo } from '@/components/ui/lpu-logo';
import { Facebook, Twitter, Linkedin, Instagram } from 'lucide-react';

const SOCIALS = [
  { icon: Facebook, label: 'Facebook' },
  { icon: Twitter, label: 'Twitter' },
  { icon: Linkedin, label: 'LinkedIn' },
  { icon: Instagram, label: 'Instagram' },
];

const COLUMNS = [
  {
    heading: 'Platform',
    links: [
      { href: '/#how-it-works', label: 'How it works' },
      { href: '/#benefits', label: 'Benefits' },
      { href: '/#demo-login', label: 'Demo Login' },
    ],
  },
  {
    heading: 'Resources',
    links: [
      { href: '#', label: 'Help Center' },
      { href: '#', label: 'Career Guides' },
      { href: '#', label: 'Alumni Network' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { href: '/terms', label: 'Terms of Service' },
      { href: '/privacy', label: 'Privacy Policy' },
      { href: '#', label: 'Cookie Policy' },
    ],
  },
];

export function LandingFooter() {
  return (
    <footer className="relative border-t border-black/10 bg-white">
      <div className="container mx-auto max-w-7xl px-4 py-16 md:px-8">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-4 md:gap-8">
          <div className="space-y-6 md:col-span-1">
            <Link href="/" className="inline-block" aria-label="Mentorly home">
              <span className="logo-pill flex items-center rounded-full bg-white px-3 py-1 shadow-sm">
                <LpuLogo className="h-9 w-auto" />
              </span>
            </Link>
            <p className="text-sm leading-relaxed text-[#6b6b6b]">
              The alumni mentorship platform connecting students with verified industry experts.
            </p>
            <div className="flex items-center gap-2">
              {SOCIALS.map((social) => (
                <a
                  key={social.label}
                  href="#"
                  aria-label={social.label}
                  className="flex h-9 w-9 items-center justify-center rounded-md border border-black/10 bg-[#f2f2f2] text-[#6b6b6b] transition-colors hover:bg-black/5 hover:text-[#111111]"
                >
                  <social.icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.heading} className="space-y-4">
              <h4 className="text-[11px] font-medium uppercase tracking-wider text-[#9a9a9a]">{column.heading}</h4>
              <ul className="space-y-3">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-sm text-[#6b6b6b] transition-colors hover:text-[#111111]">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-black/10 pt-8 md:flex-row">
          <p className="text-center text-sm text-[#9a9a9a] md:text-left">
            © {new Date().getFullYear()} Mentorly. All rights reserved.
          </p>
          <p className="text-center text-sm text-[#9a9a9a] md:text-right">
            Designed for the Mentorly community.
          </p>
        </div>
      </div>
    </footer>
  );
}
