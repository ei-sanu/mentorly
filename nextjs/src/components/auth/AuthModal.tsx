'use client';

/**
 * Mentorly — auth popup for the home page (2026-11-11).
 *
 * Somesh asked for the auth form to pop up ON the home page itself
 * instead of navigating to /login, in the dark frosted-glass iOS
 * format of his references (delete-confirm dialog, calendar card,
 * profile card — style only, never their copy/content):
 * dark translucent card, backdrop blur, thin light border, ~32px
 * radius, soft shadow, muted secondary text, pill buttons.
 *
 * BEHAVIOUR
 * - Mounted in HomePage.tsx (only there); the header's Login /
 *   Get Started buttons and the hero / CTA buttons open it via the
 *   onAuthClick prop. `initialTab` picks the tab: 'login' for Login,
 *   'register' for Get Started / Find a mentor.
 * - Escape, backdrop-click and the X button all close it. Body scroll
 *   locks while open; focus moves to the first field on open and
 *   returns to the button that opened it on close.
 * - The form itself lives in AuthForm.tsx — the same component the
 *   standalone /login page renders, so no auth logic is duplicated
 *   and nothing about sign-in/sign-up/OAuth/verification changed.
 * - The rest of the site stays light minimal; this modal is the one
 *   deliberately dark-glass surface (like the 404's peach is the one
 *   warm accent).
 */
import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import AuthForm, { type AuthTab } from './AuthForm';

export interface AuthModalProps {
  initialTab?: AuthTab;
  onClose: () => void;
}

export default function AuthModal({ initialTab = 'login', onClose }: AuthModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  /* Lock body scroll while open; restore focus when it closes. */
  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, []);

  /* Escape closes. Focus goes to the first field on open. */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    cardRef.current?.querySelector('input')?.focus();
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className="auth-modal fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Sign in to Mentorly"
    >
      {/* Backdrop — dim + blur, click closes. */}
      <button
        type="button"
        aria-label="Close sign-in dialog"
        onClick={onClose}
        className="auth-modal-backdrop auth-overlay-enter absolute inset-0 cursor-default bg-black/60 backdrop-blur-md"
      />
      {/* Frosted glass card. */}
      <div
        ref={cardRef}
        className="auth-glass-card auth-modal-card auth-modal-enter relative max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto p-6 sm:p-8"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/70 transition-colors hover:bg-white/20 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
        <AuthForm defaultTab={initialTab} />
      </div>
    </div>
  );
}
