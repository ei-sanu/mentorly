'use client';

/**
 * Mentorly — smooth scrolling (dependency-free).
 *
 * No Lenis, no extra package: native smooth scroll + IntersectionObserver
 * is all this landing needs, and it keeps the bundle untouched. (Lenis
 * was considered and rejected: it adds a dependency and a rAF loop for a
 * page whose only smooth-scroll need is anchor navigation past a floating
 * pill. If Somesh later wants inertial scrolling across the whole site,
 * Lenis can be layered on top of this file's offset/active-section logic
 * — the `NAVBAR_OFFSET_PX` and `useActiveSection` API stay the same.)
 *
 * HOW IT WORKS
 * - The floating pill is 58px tall + `top-8` (32px, real in-flow mt-8 —
 *   `top-6` alone never showed as a gap at page load, 2026-11-11) +
 *   breathing room, so every anchor target needs a 98px offset or the
 *   section heading hides under the pill. Two mechanisms, belt and braces:
 *     1. `scrollToSection()` scrolls with `window.scrollTo({ behavior })`
 *        and subtracts NAVBAR_OFFSET_PX (used by Navbar link clicks).
 *     2. `mentorly-minimal.css` sets `scroll-margin-top` from
 *        `--mentorly-navbar-offset` (98px) on sections, so plain
 *        browser `#hash` jumps and back/forward
 *        navigation get the same offset for free.
 * - `prefers-reduced-motion` is respected everywhere: smooth becomes an
 *   instant jump, and the CSS in mentorly-minimal.css disables
 *   `scroll-behavior: smooth` under the same media query.
 * - `useActiveSection(ids)` is the hook Navbar uses for its underline
 *   highlight. `initAnchorSmoothScroll()` is the optional global
 *   fallback: call it once (e.g. in HomePage) and every in-page
 *   `a[href^="#"]` on the page scrolls smoothly with the offset, even
 *   links outside the navbar (footer links, dock links, "back to top").
 *
 * USAGE (HomePage.tsx):
 *   import { initAnchorSmoothScroll } from './smooth-scroll'; // path as placed
 *   useEffect(() => initAnchorSmoothScroll(), []);
 *   // …and make sure the page root has id="main-content" (Navbar skip link).
 */
import { useEffect, useState } from 'react';

/** Pill height (58px) + top offset (32px) + 8px breathing room. */
export const NAVBAR_OFFSET_PX = 98;

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Smooth-scroll to an element by id, stopping clear of the floating pill. */
export function scrollToSection(id: string): void {
  const el = document.getElementById(id);
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY - NAVBAR_OFFSET_PX;
  window.scrollTo({ top: Math.max(top, 0), behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  /* Move keyboard focus to the section so screen-reader users land on it. */
  el.setAttribute('tabindex', '-1');
  el.focus({ preventScroll: true });
}

/** Scroll to the top of the page (used by "back to top" / the About back pill). */
export function scrollToTop(): void {
  window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
}

/**
 * Global fallback: intercept every in-page anchor click on the page and
 * route it through scrollToSection(). Returns a cleanup function.
 * Navbar links already call scrollToSection() directly, so this is only
 * needed for links outside the navbar (footer, dock, body copy).
 */
export function initAnchorSmoothScroll(root: ParentNode = document): () => void {
  const onClick = (e: MouseEvent) => {
    const target = (e.target as HTMLElement | null)?.closest?.('a[href^="#"]');
    if (!target) return;
    const href = target.getAttribute('href');
    if (!href || href === '#') return;
    const id = href.slice(1);
    if (!document.getElementById(id)) return; // let the browser handle unknown hashes
    e.preventDefault();
    scrollToSection(id);
    history.replaceState(null, '', href);
  };
  root.addEventListener('click', onClick as EventListener);
  return () => root.removeEventListener('click', onClick as EventListener);
}

/** On load, if the URL already has a #hash, jump to it with the offset. */
export function scrollToHashOnLoad(): void {
  if (typeof window === 'undefined') return;
  const id = window.location.hash.slice(1);
  if (!id) return;
  /* One frame later, so layout (fonts, hero) has settled. */
  requestAnimationFrame(() => scrollToSection(id));
}

/** Track which of the given section ids is currently in view. */
export function useActiveSection(ids: readonly string[]): string {
  const [active, setActive] = useState('');
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: '-45% 0px -50% 0px' },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [ids]);
  return active;
}
