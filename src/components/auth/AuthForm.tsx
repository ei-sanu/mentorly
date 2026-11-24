'use client';

/**
 * Mentorly — shared auth form (extracted verbatim from LoginPage.tsx,
 * 2026-11-11; only the presentation changed).
 *
 * WHY IT EXISTS: the auth form used to live only on the /login page.
 * Somesh asked for it to pop up ON the home page as a dark frosted-glass
 * iOS modal (see AuthModal.tsx). Both surfaces now render this one
 * component, so the logic can never drift apart:
 *   - AuthModal.tsx (home-page popup, dark glass)
 *   - LoginPage.tsx (standalone /login route, same glass card, full page)
 *
 * LOGIC — unchanged from LoginPage.tsx, do not "improve" it here:
 * - Tabs: Log In / Register. Register collects first/last name + role
 *   (STUDENT | MENTOR) and goes through Clerk email-code verification.
 * - Clerk email sign-in / sign-up + Google / GitHub OAuth via
 *   authenticateWithRedirect (redirectUrl /login → /onboarding).
 * - Mock login bypass for the test account (same address/password,
 *   same localStorage keys, same /app/admin/dashboard push).
 * - Validation messages and error surfacing (Clerk longMessage first).
 *
 * PRESENTATION — the only thing that changed vs LoginPage.tsx:
 * - Dark frosted-glass iOS styling (white/10 fields, white pill
 *   primary button, segmented tabs). No leftover university branding,
 *   colours or logo, no serif/mono. The host (modal or page) provides the glass card
 *   shell (.auth-glass-card); this file renders the content inside it.
 * - The OAuth-failure banner clears itself after 3.5s and does NOT
 *   navigate: the modal must never yank the user off the home page.
 *   (On /login the old code did router.replace('/login') — a no-op
 *   there, since the page already is /login.)
 *
 * SSO CONFLICT NOTIFICATION (2026-11-12):
 * - Clerk has no single "wrong sign-in method" error code. By default
 *   Clerk AUTO-LINKS a verified OAuth email onto an existing password
 *   account and signs the user in (see Clerk's account-linking docs),
 *   so a same-email Google attempt usually just works. A conflict only
 *   surfaces as an error in the cases below, detected by VERIFIED
 *   Clerk Frontend API error codes (clerk.com/docs/guides/development/
 *   errors/frontend-api; snake_case wire codes, e.g. form_identifier_
 *   exists confirmed in Clerk's own error examples):
 *     form_identifier_exists, oauth_identification_claimed,
 *     identification_claimed, email_address_exists,
 *     external_account_exists.
 *   A narrow message-text fallback covers the same failures when Clerk
 *   returns no code ("That email address is taken", "already
 *   associated", ...). Never a raw Clerk dump: the user sees one
 *   themed sentence naming the method to use.
 * - Reverse direction (Google-created account trying email+password):
 *   Clerk answers a password attempt on a passwordless account with
 *   the generic form_password_incorrect / form_password_or_identifier_
 *   incorrect (enumeration protection), which is indistinguishable
 *   from a wrong password. So on those codes ONLY, the form probes
 *   signIn.create({ identifier }) and reads supportedFirstFactors
 *   (the documented Clerk pattern for listing an account's factors):
 *   factors present + no 'password' factor + an oauth_* factor means
 *   the account is OAuth-only, and the conflict message names the
 *   provider. Any other probe outcome keeps the generic message.
 * - The conflict banner is PERSISTENT: no auto-clear timer. It clears
 *   only when the user dismisses it (X), switches tab/method, starts
 *   a new attempt, or opens the reset flow. The 3.5s OAuth-failure
 *   banner is untouched and still handles all other OAuth failures.
 *
 * LOGIN IS LOGIN-ONLY + ROLE IS REQUIRED (2026-11-12):
 * - A login attempt for an email with no account NEVER creates an
 *   account or a user record. Clerk answers with the documented
 *   `form_identifier_not_found` code (Clerk's sign-in-or-up docs: check
 *   that code, then start sign-up) — directly, or via the factor probe
 *   when the instance returns the enumeration-protected
 *   `form_password_or_identifier_incorrect` instead. The form shows
 *   "No account found" and offers registration right there, with the
 *   typed email carried over to the register tab. (Naming a missing
 *   account does reveal that the email is unregistered; that is the
 *   behaviour Somesh asked for, and it matches Clerk's own hosted UI.)
 * - Registration REQUIRES an explicit role choice: the role select
 *   starts unselected, and sign-up refuses to proceed until Student or
 *   Mentor is picked. The chosen role is passed as unsafeMetadata on
 *   email sign-up AND on register-tab OAuth (Clerk copies sign-up
 *   unsafeMetadata onto the created user), so backend provisioning
 *   honours it. Login-tab OAuth passes no role — new OAuth users meet
 *   the onboarding role gate instead, which persists the choice the
 *   same way. No silent STUDENT default exists on any path.
 *
 * PASSWORD RESET (2026-11-12):
 * - "Forgot password?" (login tab only) opens a reset view inside this
 *   same form. Primary path is MOBILE OTP via the Mentorly backend
 *   (POST /auth/password-reset/* — public, rate-limited, proof is an
 *   MSG91 OTP to the account's VERIFIED mobile; the backend then sets
 *   the password through the Clerk Backend API). Calls are self-
 *   contained fetch() calls here, using the same NEXT_PUBLIC_API_URL
 *   constant as src/services/api.ts — api.ts is untouched.
 * - Fallback is Clerk's own EMAIL reset (legacy client flow matching
 *   this codebase's Clerk API style): signIn.create({ strategy:
 *   'reset_password_email_code', identifier }) →
 *   signIn.attemptFirstFactor({ strategy, code }) →
 *   signIn.resetPassword({ password, signOutOfOtherSessions }).
 *   Offered whenever the mobile path can't proceed, notably when the
 *   account has no verified mobile on file.
 * - No OTP, reset token or password is ever logged or persisted
 *   (state only, cleared on completion / leaving the flow).
 */
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSignIn, useSignUp, useClerk } from '@clerk/clerk-react';
import { CheckCircle2, Lock, Mail, ShieldAlert, X } from 'lucide-react';

export type AuthTab = 'login' | 'register';

const inputClass =
  'h-11 w-full rounded-2xl border border-white/15 bg-white/10 px-4 text-[15px] text-white placeholder:text-white/40 outline-none transition-colors focus:border-white/40 focus:bg-white/[0.12]';
const labelClass =
  'mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-white/50';
const primaryBtnClass =
  'h-12 w-full rounded-full bg-white text-[15px] font-semibold text-black transition-colors hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60';
const oauthBtnClass =
  'flex h-11 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 text-[13px] font-medium text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60';
const textLinkClass =
  'text-[13px] font-medium text-white/60 transition-colors hover:text-white';

// Same base URL constant as src/services/api.ts (Vite `define` in
// vite.config.js replaces process.env.NEXT_PUBLIC_API_URL at build
// time; default is the local backend). Reset calls must NOT go through
// apiFetch: the user is signed out, so there is no token to attach.
const RESET_API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

// ─── SSO conflict detection ─────────────────────────────────────────────────
// Verified Clerk Frontend API error codes (see header). The wire codes
// are the snake_case form of the PascalCase names in Clerk's Frontend
// API errors index; form_identifier_exists is confirmed verbatim in
// Clerk error payloads.
const SSO_CONFLICT_CODES = new Set([
  'form_identifier_exists',
  'oauth_identification_claimed',
  'identification_claimed',
  'email_address_exists',
  'external_account_exists',
]);

function clerkErrorList(err: any): Array<{ code?: string; message?: string; longMessage?: string }> {
  return Array.isArray(err?.errors) ? err.errors : [];
}

/**
 * True when a Clerk error means "this email/account already exists via a
 * different sign-in method". Code match first; a narrow message-text
 * fallback covers the same failure when Clerk returns no code.
 */
function isSsoConflictError(err: any): boolean {
  const errs = clerkErrorList(err);
  if (errs.some((e) => e.code && SSO_CONFLICT_CODES.has(e.code))) return true;
  const text =
    errs
      .map((e) => `${e.message || ''} ${e.longMessage || ''}`)
      .join(' ')
      .toLowerCase() || String(err?.message || '').toLowerCase();
  if (!text) return false;
  const taken = text.includes('taken') && (text.includes('email') || text.includes('account'));
  const already =
    text.includes('already') &&
    ['exists', 'associated', 'claimed', 'registered', 'connected'].some((w) => text.includes(w));
  return taken || already;
}

// ─── Password-reset backend calls (self-contained, pre-auth) ────────────────
async function resetFetch(path: string, body: unknown): Promise<any> {
  let res: Response;
  try {
    res = await fetch(`${RESET_API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    // Backend down/unreachable: same friendly wording as apiFetch.
    const err: any = new Error(
      `Could not reach the Mentorly server at ${RESET_API_BASE_URL}. Start the backend first (Terminal 1: npm run server in mentorconnectlpu/backend) and try again.`,
    );
    err.code = 'NETWORK_ERROR';
    throw err;
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err: any = new Error(
      json?.error?.message || json?.message || `Request failed (${res.status}).`,
    );
    err.code = json?.error?.code;
    err.status = res.status;
    throw err;
  }
  return json.data ?? json;
}

function GoogleMark() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#EA4335" d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.48 14.98 1 12 1 7.35 1 3.37 3.67 1.39 7.56l3.85 2.99c.9-2.7 3.42-4.51 6.76-4.51z" />
      <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.51h6.46c-.29 1.48-1.14 2.73-2.4 3.58l3.76 2.91c2.2-2.03 3.67-5.01 3.67-8.64z" />
      <path fill="#FBBC05" d="M5.24 14.56c-.23-.69-.36-1.42-.36-2.18s.13-1.49.36-2.18L1.39 7.21C.5 8.99 0 10.94 0 13s.5 4.01 1.39 5.79l3.85-3.23z" />
      <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.76-2.91c-1.1.74-2.5 1.18-4.2 1.18-3.34 0-5.86-1.81-6.76-4.51L1.39 17c1.98 3.89 5.96 6.56 10.61 6.56z" />
    </svg>
  );
}

function GitHubMark() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin text-white/60" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
  );
}

type ResetView = 'none' | 'mobile' | 'email';
type MobileResetStep = 'phone' | 'otp' | 'password' | 'done';
type EmailResetStep = 'email' | 'code' | 'password';

export default function AuthForm({ defaultTab = 'login' }: { defaultTab?: AuthTab }) {
  const router = useRouter();

  const clerkObj = useClerk() as any;
  const { isLoaded: signInLoaded, signIn, setActive: setSignInActive } = useSignIn() as any;
  const { isLoaded: signUpLoaded, signUp, setActive: setSignUpActive } = useSignUp() as any;

  const [activeTab, setActiveTab] = useState<AuthTab>(defaultTab);

  // Custom Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  // Starts UNSELECTED: registration must ask for an explicit role
  // choice — a pre-selected STUDENT silently captured users who never
  // noticed the dropdown. Sign-up refuses to proceed until one is
  // picked (see handleEmailSignUp); register-tab OAuth passes the
  // choice through as unsafeMetadata only when one was made.
  const [role, setRole] = useState<'STUDENT' | 'MENTOR' | ''>('');

  // Verification States
  const [verifying, setVerifying] = useState(false);
  const [otpCode, setOtpCode] = useState('');

  // Error/Message States
  const [errorMsg, setErrorMsg] = useState('');
  const [authError, setAuthError] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return !!(
        params.get('error') ||
        params.get('__clerk_status') === 'error' ||
        window.location.hash.includes('error')
      );
    }
    return false;
  });
  const [loading, setLoading] = useState(false);

  // SSO conflict message — PERSISTENT (no timer). Cleared only on
  // dismiss, tab/method change, a new attempt, or entering reset.
  const [conflictMsg, setConflictMsg] = useState('');

  // No-account notice (login tab only): Clerk answered the sign-in with
  // form_identifier_not_found, i.e. no account exists for the typed
  // email. Login never creates an account — the notice offers
  // registration right here, with the email carried over to the
  // register tab. Cleared on tab switch, a new attempt, or editing the
  // email field.
  const [noAccountFound, setNoAccountFound] = useState(false);

  // Password-reset flow state (state only — never persisted/logged).
  const [resetView, setResetView] = useState<ResetView>('none');
  const [resetStep, setResetStep] = useState<MobileResetStep>('phone');
  const [resetPhone, setResetPhone] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [resetMsg, setResetMsg] = useState('');
  const [resetInfo, setResetInfo] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [noVerifiedMobile, setNoVerifiedMobile] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetEmailCode, setResetEmailCode] = useState('');
  const [resetEmailStep, setResetEmailStep] = useState<EmailResetStep>('email');

  // A cancelled/failed OAuth redirect shows the banner briefly, then it
  // clears. No navigation here — the modal must stay on the home page.
  useEffect(() => {
    if (!authError) return;
    const timer = setTimeout(() => setAuthError(false), 3500);
    return () => clearTimeout(timer);
  }, [authError]);

  // Best-effort: if Clerk surfaces a conflict code in the return URL
  // after an OAuth redirect, show the persistent conflict message
  // instead of the generic 3.5s banner. Clerk may or may not put the
  // code in the URL — the in-form catches below are the primary path.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const haystack = `${window.location.search} ${window.location.hash}`;
    if ([...SSO_CONFLICT_CODES].some((code) => haystack.includes(code))) {
      setConflictMsg(
        'This email is already associated with an account that uses a different sign-in method. Please sign in with the method you originally used.',
      );
      setAuthError(false);
    }
    // Run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchTab = (tab: AuthTab) => {
    setActiveTab(tab);
    setErrorMsg('');
    setConflictMsg('');
    setNoAccountFound(false);
  };

  const handleSocialLogin = async (provider: 'oauth_google' | 'oauth_github') => {
    setLoading(true);
    setErrorMsg('');
    setConflictMsg('');
    setNoAccountFound(false);
    try {
      // window.Clerk is set by Clerk's script as soon as it loads — most reliable source
      const wClerk = (window as any).Clerk;
      const isSignUp = activeTab === 'register';

      if (isSignUp) {
        // Register-tab OAuth carries the chosen role as unsafeMetadata
        // (Clerk copies sign-up unsafeMetadata onto the created user),
        // so backend provisioning honours the choice. No role chosen
        // yet → pass nothing: the onboarding role gate asks instead.
        // Login-tab OAuth deliberately passes no role — existing users
        // must not be asked, and new users meet the same gate.
        const oauthParams: any = {
          strategy: provider,
          redirectUrl: `${window.location.origin}/onboarding`,
          redirectUrlComplete: `${window.location.origin}/onboarding`,
        };
        if (role) oauthParams.unsafeMetadata = { role };
        if (wClerk?.client?.signUp?.authenticateWithRedirect) {
          await wClerk.client.signUp.authenticateWithRedirect(oauthParams);
        } else if (signUp?.authenticateWithRedirect) {
          await signUp.authenticateWithRedirect(oauthParams);
        } else {
          throw new Error('Google / GitHub registration is not available yet. Please refresh the page.');
        }
      } else {
        if (wClerk?.client?.signIn?.authenticateWithRedirect) {
          await wClerk.client.signIn.authenticateWithRedirect({
            strategy: provider,
            redirectUrl: `${window.location.origin}/onboarding`,
            redirectUrlComplete: `${window.location.origin}/onboarding`,
          });
        } else if (signIn?.authenticateWithRedirect) {
          await signIn.authenticateWithRedirect({
            strategy: provider,
            redirectUrl: `${window.location.origin}/onboarding`,
            redirectUrlComplete: `${window.location.origin}/onboarding`,
          });
        } else if (clerkObj?.redirectToSignIn) {
          // Fallback: Clerk's own redirect helper
          clerkObj.redirectToSignIn({ redirectUrl: `${window.location.origin}/onboarding` });
        } else {
          throw new Error('Google / GitHub sign-in is not available yet. Please refresh the page.');
        }
      }
    } catch (err: any) {
      console.error('OAuth error:', err);
      if (isSsoConflictError(err)) {
        // Password-created account colliding with an OAuth attempt.
        // The OAuth account was NOT linked; tell the user to use the
        // method the account was created with. Stays until dismissed
        // or the user changes method — never the 3.5s banner.
        setConflictMsg(
          activeTab === 'register'
            ? 'An account with this email already exists. Please sign in with your email and password.'
            : 'This account was created with email and password. Please sign in with your email and password.',
        );
        setErrorMsg('');
      } else {
        setErrorMsg(err.errors?.[0]?.longMessage || err.message || 'Authentication failed. Please try again.');
      }
      setLoading(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setConflictMsg('');
    setNoAccountFound(false);

    // Custom Mock Login Bypass for specific test account
    if (cleanEmail === 'someshranjanbiswal13678@gmail.com' && cleanPassword === 'Sanu@123') {
      try {
        localStorage.setItem('mock_user_token', 'mock_token_someshranjanbiswal13678@gmail.com_roleADMIN');
        localStorage.setItem('mock_user_email', 'someshranjanbiswal13678@gmail.com');
        localStorage.setItem('active_role', 'ADMIN');

        // Push directly to admin dashboard
        router.push('/app/admin/dashboard');
        setLoading(false);
        return;
      } catch (err: any) {
        console.error('Mock login failed:', err);
        setErrorMsg('Mock login failed. Please try again.');
        setLoading(false);
        return;
      }
    }

    if (!signInLoaded || !signIn) return;

    try {
      const result = await signIn.create({
        identifier: cleanEmail,
        password: cleanPassword,
      });

      if (result.status === 'complete') {
        await setSignInActive({ session: result.createdSessionId });
        router.push('/onboarding');
      } else {
        setErrorMsg('Sign-in incomplete. Please verify your credentials.');
        setLoading(false);
      }
    } catch (err: any) {
      console.error('Sign-in error:', err);
      const clerkCode = err.errors?.[0]?.code as string | undefined;

      // No such account: Clerk's documented sign-in-or-up signal
      // (form_identifier_not_found — "a required identifier is not
      // found"). Login must NEVER create an account: show the notice
      // and offer registration from here, with the typed email carried
      // over to the register tab.
      if (clerkCode === 'form_identifier_not_found') {
        setNoAccountFound(true);
        setErrorMsg('');
        setLoading(false);
        return;
      }

      // Direct conflict codes on the password path (rare, but cheap).
      if (isSsoConflictError(err)) {
        setConflictMsg(
          'This account uses social sign-in. Please continue with the provider you signed up with.',
        );
        setErrorMsg('');
        setLoading(false);
        return;
      }

      // Reverse direction: an OAuth-only account answers a password
      // attempt with the generic incorrect-password code. Probe the
      // account's factors (documented Clerk pattern) — ONLY on those
      // generic codes, so a genuinely wrong password on a password
      // account is never mislabelled. Any probe failure or a password
      // factor present keeps the generic message.
      if (
        clerkCode === 'form_password_incorrect' ||
        clerkCode === 'form_password_or_identifier_incorrect' ||
        clerkCode === 'invalid_strategy_for_user'
      ) {
        try {
          const probe = await signIn.create({ identifier: cleanEmail });
          const strategies: string[] = (probe?.supportedFirstFactors || []).map(
            (f: any) => f.strategy,
          );
          if (strategies.length > 0 && !strategies.includes('password')) {
            const oauthStrategy = strategies.find((s) => s.startsWith('oauth_'));
            const providerName =
              oauthStrategy === 'oauth_google'
                ? 'Google'
                : oauthStrategy === 'oauth_github'
                  ? 'GitHub'
                  : null;
            setConflictMsg(
              providerName
                ? `This account uses ${providerName} sign-in. Please continue with ${providerName}.`
                : 'This account uses social sign-in. Please continue with the provider you signed up with.',
            );
            setErrorMsg('');
            setLoading(false);
            return;
          }
        } catch (probeErr: any) {
          // Probe failed. An identifier-not-found probe failure means
          // no account exists for this email (the instance answered the
          // password attempt with the enumeration-protected generic
          // code instead) — same no-account notice as the direct code
          // above. Any other probe failure falls through to the generic
          // message below.
          if (probeErr?.errors?.[0]?.code === 'form_identifier_not_found') {
            setNoAccountFound(true);
            setErrorMsg('');
            setLoading(false);
            return;
          }
        }
      }

      setErrorMsg(err.errors?.[0]?.longMessage || err.message || 'Authentication failed.');
      setLoading(false);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signUpLoaded || !signUp) return;
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password.trim()) {
      setErrorMsg('Please fill out all fields.');
      return;
    }
    if (!role) {
      setErrorMsg('Please choose an account type — Student or Alumni / Mentor.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setConflictMsg('');
    setNoAccountFound(false);
    try {
      await signUp.create({
        emailAddress: email.trim(),
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        unsafeMetadata: {
          role,
        },
      });

      // Prepare email verification
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setVerifying(true);
      setLoading(false);
    } catch (err: any) {
      console.error('Sign-up error:', err);
      if (isSsoConflictError(err)) {
        // Taken email on sign-up: neutral wording — the existing
        // account may be password- or OAuth-created, and this error
        // does not say which. Persistent, like other conflict notices.
        setConflictMsg('An account with this email already exists. Please sign in instead.');
        setErrorMsg('');
      } else {
        setErrorMsg(err.errors?.[0]?.longMessage || err.message || 'Registration failed.');
      }
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signUpLoaded || !signUp) return;
    if (!otpCode.trim()) {
      setErrorMsg('Please enter the verification code.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    try {
      const result = await signUp.attemptEmailAddressVerification({ code: otpCode.trim() });
      if (result.status === 'complete') {
        // Store user role in localstorage
        localStorage.setItem(`clerk_role_${result.createdUserId}`, role);
        await setSignUpActive({ session: result.createdSessionId });
        router.push('/onboarding');
      } else {
        setErrorMsg('Verification failed. Try again.');
        setLoading(false);
      }
    } catch (err: any) {
      console.error('Verification error:', err);
      setErrorMsg(err.errors?.[0]?.longMessage || err.message || 'Verification failed.');
      setLoading(false);
    }
  };

  // ─── Password reset: view switching ───────────────────────────────────────
  const clearResetSecrets = () => {
    setResetOtp('');
    setResetToken('');
    setResetNewPassword('');
    setResetConfirmPassword('');
    setResetEmailCode('');
  };

  const openMobileReset = () => {
    setConflictMsg('');
    setErrorMsg('');
    setResetMsg('');
    setResetInfo('');
    setNoVerifiedMobile(false);
    setResetStep('phone');
    setResetView('mobile');
  };

  const openEmailReset = () => {
    setConflictMsg('');
    setErrorMsg('');
    setResetMsg('');
    setResetInfo('');
    setNoVerifiedMobile(false);
    // Pre-fill from the login email field when the user already typed it.
    setResetEmail((prev) => prev || email.trim());
    setResetEmailStep('email');
    setResetView('email');
  };

  const closeReset = () => {
    setResetView('none');
    setResetStep('phone');
    setResetEmailStep('email');
    setResetMsg('');
    setResetInfo('');
    setNoVerifiedMobile(false);
    clearResetSecrets();
  };

  // ─── Password reset: mobile OTP (Mentorly backend) ────────────────────────
  const resetDigits = (): string => {
    let digits = resetPhone.replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
    if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
    return digits;
  };

  // Accepts a synthetic event so the same handler serves both the form
  // submit and the "Resend code" button.
  const handleResetSendOtp = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    const digits = resetDigits();
    if (!/^\d{10}$/.test(digits)) {
      setResetMsg('Enter a valid 10-digit mobile number.');
      return;
    }
    setResetLoading(true);
    setResetMsg('');
    setResetInfo('');
    setNoVerifiedMobile(false);
    try {
      const data = await resetFetch('/auth/password-reset/request-otp', {
        countryCode: '+91',
        phoneNumber: digits,
      });
      setResetStep('otp');
      setResetInfo(
        data?.phone
          ? `We sent a verification code to ${data.phone}.`
          : 'We sent a verification code to your mobile number.',
      );
    } catch (err: any) {
      // No verified mobile on file: show the dedicated notice + email
      // fallback instead of a bare error line.
      if (err?.code === 'NO_VERIFIED_MOBILE') {
        setNoVerifiedMobile(true);
        setResetMsg('');
      } else {
        setResetMsg(err.message || 'Could not send a verification code. Please try again.');
      }
    } finally {
      setResetLoading(false);
    }
  };

  const handleResetVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = resetDigits();
    if (!/^\d{4,8}$/.test(resetOtp.trim())) {
      setResetMsg('Enter the verification code sent to your phone.');
      return;
    }
    setResetLoading(true);
    setResetMsg('');
    setResetInfo('');
    try {
      const data = await resetFetch('/auth/password-reset/verify-otp', {
        countryCode: '+91',
        phoneNumber: digits,
        otp: resetOtp.trim(),
      });
      // The reset token proves OTP verification to the confirm step.
      // State only; cleared on completion or when leaving the flow.
      setResetToken(data?.resetToken || '');
      setResetOtp('');
      setResetStep('password');
      setResetInfo('Code verified. Choose a new password.');
    } catch (err: any) {
      if (err?.code === 'NO_VERIFIED_MOBILE') {
        setNoVerifiedMobile(true);
        setResetStep('phone');
        setResetMsg('');
      } else {
        setResetMsg(err.message || 'Verification failed. Please try again.');
      }
    } finally {
      setResetLoading(false);
    }
  };

  const handleResetSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    // Trimmed to match sign-in, which trims the password before
    // submitting — an untrimmed reset password would lock the user out
    // again on their next sign-in.
    const next = resetNewPassword.trim();
    if (next.length < 8) {
      setResetMsg('Password must be at least 8 characters long.');
      return;
    }
    if (next !== resetConfirmPassword.trim()) {
      setResetMsg('Passwords do not match.');
      return;
    }
    if (!resetToken) {
      setResetMsg('Your reset session expired. Please request a new code.');
      setResetStep('phone');
      return;
    }
    setResetLoading(true);
    setResetMsg('');
    setResetInfo('');
    try {
      await resetFetch('/auth/password-reset/confirm', {
        resetToken,
        newPassword: next,
      });
      clearResetSecrets();
      setResetStep('done');
      setResetInfo('');
    } catch (err: any) {
      setResetMsg(err.message || 'Could not update the password. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  // ─── Password reset: Clerk email fallback (legacy client flow) ────────────
  // Matches this codebase's Clerk API style (throwing calls + setActive).
  // Verified against Clerk's legacy custom-flow docs and the
  // reset_password_email_code strategy: create → attemptFirstFactor →
  // resetPassword. If the loaded Clerk runtime lacks resetPassword, the
  // user is directed back to the mobile OTP path instead of failing
  // silently.
  // Accepts a synthetic event so the same handler serves both the form
  // submit and the "Resend code" button.
  const handleEmailResetSendCode = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    const clean = resetEmail.trim();
    if (!clean) {
      setResetMsg('Enter your email address.');
      return;
    }
    if (!signInLoaded || !signIn) {
      setResetMsg('Sign-in is not ready yet. Please refresh the page and try again.');
      return;
    }
    setResetLoading(true);
    setResetMsg('');
    setResetInfo('');
    try {
      await signIn.create({ strategy: 'reset_password_email_code', identifier: clean });
      setResetEmailStep('code');
      setResetInfo(`We sent a password reset code to ${clean}.`);
    } catch (err: any) {
      console.error('Email reset error:', err);
      setResetMsg(
        err.errors?.[0]?.longMessage || err.message || 'Could not send a reset code. Please try again.',
      );
    } finally {
      setResetLoading(false);
    }
  };

  const handleEmailResetVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmailCode.trim()) {
      setResetMsg('Enter the reset code sent to your email.');
      return;
    }
    if (!signInLoaded || !signIn) return;
    setResetLoading(true);
    setResetMsg('');
    setResetInfo('');
    try {
      const attempt = await signIn.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code: resetEmailCode.trim(),
      });
      if (attempt.status === 'needs_new_password') {
        setResetEmailStep('password');
        setResetInfo('Code verified. Choose a new password.');
      } else if (attempt.status === 'complete') {
        await setSignInActive({ session: attempt.createdSessionId });
        router.push('/onboarding');
      } else {
        setResetMsg('Additional verification is required. Please try signing in another way.');
      }
    } catch (err: any) {
      console.error('Email reset verification error:', err);
      setResetMsg(
        err.errors?.[0]?.longMessage || err.message || 'Verification failed. Please try again.',
      );
    } finally {
      setResetLoading(false);
    }
  };

  const handleEmailResetSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const next = resetNewPassword.trim();
    if (next.length < 8) {
      setResetMsg('Password must be at least 8 characters long.');
      return;
    }
    if (next !== resetConfirmPassword.trim()) {
      setResetMsg('Passwords do not match.');
      return;
    }
    if (!signInLoaded || !signIn) return;
    if (typeof signIn.resetPassword !== 'function') {
      setResetMsg(
        'Email password reset is not available here. Please use the mobile OTP reset instead.',
      );
      return;
    }
    setResetLoading(true);
    setResetMsg('');
    setResetInfo('');
    try {
      const result = await signIn.resetPassword({
        password: next,
        signOutOfOtherSessions: true,
      });
      if (result.status === 'complete') {
        clearResetSecrets();
        await setSignInActive({ session: result.createdSessionId });
        router.push('/onboarding');
      } else if (result.status === 'needs_second_factor') {
        setResetMsg(
          'Additional verification is required before the new password takes effect. Please complete sign-in verification.',
        );
      } else {
        setResetMsg('Password reset did not complete. Please try again.');
      }
    } catch (err: any) {
      console.error('Email reset password error:', err);
      setResetMsg(
        err.errors?.[0]?.longMessage || err.message || 'Could not update the password. Please try again.',
      );
    } finally {
      setResetLoading(false);
    }
  };

  const resetHeading =
    resetView === 'mobile'
      ? 'Reset your password'
      : resetView === 'email'
        ? 'Reset via email'
        : verifying
          ? 'Verify your email'
          : activeTab === 'login'
            ? 'Welcome back'
            : 'Create your account';
  const resetSubheading =
    resetView === 'mobile'
      ? 'We’ll send a code to the verified mobile number on your account.'
      : resetView === 'email'
        ? 'We’ll send a reset code to your email address.'
        : verifying
          ? `We sent a verification code to ${email}.`
          : activeTab === 'login'
            ? 'Sign in to continue to Mentorly.'
            : 'Find a mentor who has walked your path.';

  return (
    <div className="w-full">
      {/* Heading — follows the active step. */}
      <div className="mb-6 flex flex-col items-center text-center">
        <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white text-[20px] font-semibold text-black">
          M
        </span>
        <h2 className="text-[22px] font-semibold leading-tight text-white">{resetHeading}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-white/60">{resetSubheading}</p>
      </div>

      {/* OAuth Fail Banner — 3.5s auto-clear, auth view only (unchanged). */}
      {authError && resetView === 'none' && (
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-red-400/30 bg-red-500/15 px-4 py-3 text-white">
          <ShieldAlert className="h-5 w-5 shrink-0 text-red-300" />
          <p className="text-[13px] font-medium text-red-200">
            Authentication cancelled or failed. Please try again.
          </p>
        </div>
      )}

      {/* SSO conflict banner — PERSISTENT: no timer. Dismiss via X, or it
          clears when the user switches tab/method, starts a new attempt,
          or opens the reset flow. */}
      {conflictMsg && !verifying && resetView === 'none' && (
        <div
          role="alert"
          className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-400/30 bg-amber-500/15 px-4 py-3 text-white"
        >
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
          <p className="flex-1 text-[13px] font-medium leading-relaxed text-amber-100">
            {conflictMsg}
          </p>
          <button
            type="button"
            onClick={() => setConflictMsg('')}
            aria-label="Dismiss"
            className="shrink-0 rounded-full p-1 text-amber-200/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {verifying ? (
        /* Email verification step */
        <form onSubmit={handleVerifyOTP} className="flex flex-col items-center space-y-5">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white">
            <Mail className="h-6 w-6" />
          </span>
          <div className="w-full">
            <label htmlFor="auth-otp" className={`${labelClass} text-center`}>
              Enter Verification Code
            </label>
            <input
              id="auth-otp"
              type="text"
              inputMode="numeric"
              placeholder="123456"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              className={`${inputClass} text-center text-lg font-bold tracking-[0.3em]`}
            />
          </div>
          {errorMsg && <p className="text-[13px] font-medium text-red-300">{errorMsg}</p>}
          <div className="w-full space-y-3">
            <button type="submit" disabled={loading} className={primaryBtnClass}>
              {loading ? 'Verifying...' : 'Verify Code'}
            </button>
            <button
              type="button"
              onClick={() => setVerifying(false)}
              className="w-full text-center text-[13px] text-white/60 transition-colors hover:text-white"
            >
              Back to registration
            </button>
          </div>
        </form>
      ) : resetView !== 'none' ? (
        /* ─── Password reset views ─── */
        <>
          {resetView === 'mobile' && resetStep === 'phone' && (
            <form onSubmit={handleResetSendOtp} className="space-y-4">
              <div>
                <label htmlFor="reset-phone" className={labelClass}>
                  Mobile Number
                </label>
                <div className="flex items-center gap-2">
                  <span className="flex h-11 shrink-0 items-center rounded-2xl border border-white/15 bg-white/5 px-3 text-[15px] text-white/70">
                    +91
                  </span>
                  <input
                    id="reset-phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    placeholder="10-digit mobile number"
                    value={resetPhone}
                    onChange={(e) => setResetPhone(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <p className="mt-2 text-xs leading-relaxed text-white/40">
                  We only send codes to the verified mobile number on your account.
                </p>
              </div>
              {noVerifiedMobile && (
                <div className="flex items-start gap-3 rounded-2xl border border-amber-400/30 bg-amber-500/15 px-4 py-3 text-white">
                  <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium leading-relaxed text-amber-100">
                      No verified mobile number on this account — use email reset instead.
                    </p>
                    <button
                      type="button"
                      onClick={openEmailReset}
                      className="mt-1.5 text-[13px] font-semibold text-white underline underline-offset-2"
                    >
                      Use email reset instead
                    </button>
                  </div>
                </div>
              )}
              {resetMsg && <p className="text-[13px] font-medium text-red-300">{resetMsg}</p>}
              {resetInfo && <p className="text-[13px] font-medium text-emerald-300">{resetInfo}</p>}
              <button type="submit" disabled={resetLoading} className={primaryBtnClass}>
                {resetLoading ? 'Sending...' : 'Send code'}
              </button>
            </form>
          )}

          {resetView === 'mobile' && resetStep === 'otp' && (
            <form onSubmit={handleResetVerifyOtp} className="space-y-4">
              <div>
                <label htmlFor="reset-otp" className={labelClass}>
                  Enter Verification Code
                </label>
                <input
                  id="reset-otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  value={resetOtp}
                  onChange={(e) => setResetOtp(e.target.value)}
                  className={`${inputClass} text-center text-lg font-bold tracking-[0.3em]`}
                />
              </div>
              {resetMsg && <p className="text-[13px] font-medium text-red-300">{resetMsg}</p>}
              {resetInfo && <p className="text-[13px] font-medium text-emerald-300">{resetInfo}</p>}
              <button type="submit" disabled={resetLoading} className={primaryBtnClass}>
                {resetLoading ? 'Verifying...' : 'Verify code'}
              </button>
              <div className="flex items-center justify-between">
                <button type="button" onClick={() => setResetStep('phone')} className={textLinkClass}>
                  Change number
                </button>
                <button type="button" onClick={handleResetSendOtp} disabled={resetLoading} className={textLinkClass}>
                  Resend code
                </button>
              </div>
            </form>
          )}

          {resetView === 'mobile' && resetStep === 'password' && (
            <form onSubmit={handleResetSetPassword} className="space-y-4">
              <div>
                <label htmlFor="reset-new-password" className={labelClass}>
                  New Password
                </label>
                <input
                  id="reset-new-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  value={resetNewPassword}
                  onChange={(e) => setResetNewPassword(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="reset-confirm-password" className={labelClass}>
                  Confirm New Password
                </label>
                <input
                  id="reset-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Repeat the new password"
                  value={resetConfirmPassword}
                  onChange={(e) => setResetConfirmPassword(e.target.value)}
                  className={inputClass}
                />
              </div>
              {resetMsg && <p className="text-[13px] font-medium text-red-300">{resetMsg}</p>}
              {resetInfo && <p className="text-[13px] font-medium text-emerald-300">{resetInfo}</p>}
              <button type="submit" disabled={resetLoading} className={primaryBtnClass}>
                {resetLoading ? 'Updating...' : 'Update password'}
              </button>
            </form>
          )}

          {resetView === 'mobile' && resetStep === 'done' && (
            <div className="flex flex-col items-center space-y-4 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
                <CheckCircle2 className="h-6 w-6" />
              </span>
              <div>
                <p className="text-[15px] font-semibold text-white">Your password has been updated.</p>
                <p className="mt-1 text-sm text-white/60">Sign in with your new password.</p>
              </div>
              <button type="button" onClick={closeReset} className={primaryBtnClass}>
                Back to sign in
              </button>
            </div>
          )}

          {resetView === 'email' && resetEmailStep === 'email' && (
            <form onSubmit={handleEmailResetSendCode} className="space-y-4">
              <div>
                <label htmlFor="reset-email" className={labelClass}>
                  Email Address
                </label>
                <input
                  id="reset-email"
                  type="email"
                  placeholder="e.g. yourname@email.com"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className={inputClass}
                />
              </div>
              {resetMsg && <p className="text-[13px] font-medium text-red-300">{resetMsg}</p>}
              {resetInfo && <p className="text-[13px] font-medium text-emerald-300">{resetInfo}</p>}
              <button type="submit" disabled={resetLoading} className={primaryBtnClass}>
                {resetLoading ? 'Sending...' : 'Send reset code'}
              </button>
            </form>
          )}

          {resetView === 'email' && resetEmailStep === 'code' && (
            <form onSubmit={handleEmailResetVerifyCode} className="space-y-4">
              <div>
                <label htmlFor="reset-email-code" className={labelClass}>
                  Enter Reset Code
                </label>
                <input
                  id="reset-email-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  value={resetEmailCode}
                  onChange={(e) => setResetEmailCode(e.target.value)}
                  className={`${inputClass} text-center text-lg font-bold tracking-[0.3em]`}
                />
              </div>
              {resetMsg && <p className="text-[13px] font-medium text-red-300">{resetMsg}</p>}
              {resetInfo && <p className="text-[13px] font-medium text-emerald-300">{resetInfo}</p>}
              <button type="submit" disabled={resetLoading} className={primaryBtnClass}>
                {resetLoading ? 'Verifying...' : 'Verify code'}
              </button>
              <div className="flex items-center justify-between">
                <button type="button" onClick={() => setResetEmailStep('email')} className={textLinkClass}>
                  Change email
                </button>
                <button type="button" onClick={handleEmailResetSendCode} disabled={resetLoading} className={textLinkClass}>
                  Resend code
                </button>
              </div>
            </form>
          )}

          {resetView === 'email' && resetEmailStep === 'password' && (
            <form onSubmit={handleEmailResetSetPassword} className="space-y-4">
              <div>
                <label htmlFor="reset-email-new-password" className={labelClass}>
                  New Password
                </label>
                <input
                  id="reset-email-new-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  value={resetNewPassword}
                  onChange={(e) => setResetNewPassword(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="reset-email-confirm-password" className={labelClass}>
                  Confirm New Password
                </label>
                <input
                  id="reset-email-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Repeat the new password"
                  value={resetConfirmPassword}
                  onChange={(e) => setResetConfirmPassword(e.target.value)}
                  className={inputClass}
                />
              </div>
              {resetMsg && <p className="text-[13px] font-medium text-red-300">{resetMsg}</p>}
              {resetInfo && <p className="text-[13px] font-medium text-emerald-300">{resetInfo}</p>}
              <button type="submit" disabled={resetLoading} className={primaryBtnClass}>
                {resetLoading ? 'Updating...' : 'Set new password'}
              </button>
            </form>
          )}

          {/* Reset footer: switch method / back to sign in. */}
          {resetStep !== 'done' && (
            <div className="mt-5 flex flex-col items-center gap-2">
              {resetView === 'mobile' ? (
                <button type="button" onClick={openEmailReset} className={textLinkClass}>
                  Use email reset instead
                </button>
              ) : (
                <button type="button" onClick={openMobileReset} className={textLinkClass}>
                  Use mobile OTP instead
                </button>
              )}
              <button type="button" onClick={closeReset} className={textLinkClass}>
                Back to sign in
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Tabs */}
          <div className="mb-5 flex gap-1 rounded-full border border-white/10 bg-white/5 p-1">
            <button
              type="button"
              onClick={() => switchTab('login')}
              className={`h-9 flex-1 rounded-full text-sm font-semibold transition-colors ${
                activeTab === 'login' ? 'bg-white text-black' : 'text-white/60 hover:text-white'
              }`}
            >
              Log In
            </button>
            <button
              type="button"
              onClick={() => switchTab('register')}
              className={`h-9 flex-1 rounded-full text-sm font-semibold transition-colors ${
                activeTab === 'register' ? 'bg-white text-black' : 'text-white/60 hover:text-white'
              }`}
            >
              Register
            </button>
          </div>

          {/* OAuth */}
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => handleSocialLogin('oauth_google')} disabled={loading} className={oauthBtnClass}>
              {loading ? <Spinner /> : <GoogleMark />}
              Google
            </button>
            <button type="button" onClick={() => handleSocialLogin('oauth_github')} disabled={loading} className={oauthBtnClass}>
              {loading ? <Spinner /> : <GitHubMark />}
              GitHub
            </button>
          </div>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-white/40">or use email</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          {activeTab === 'login' ? (
            <form onSubmit={handleEmailSignIn} className="space-y-4">
              <div>
                <label htmlFor="auth-email" className={labelClass}>
                  Email Address
                </label>
                <input
                  id="auth-email"
                  type="email"
                  placeholder="e.g. yourname@email.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setNoAccountFound(false);
                  }}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="auth-password" className={labelClass}>
                  Password
                </label>
                <input
                  id="auth-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="flex justify-end">
                <button type="button" onClick={openMobileReset} className={textLinkClass}>
                  Forgot password?
                </button>
              </div>
              {errorMsg && <p className="text-[13px] font-medium text-red-300">{errorMsg}</p>}
              {noAccountFound && (
                <div
                  role="alert"
                  className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3"
                >
                  <p className="text-[13px] font-medium leading-relaxed text-white">
                    No account found for {email.trim() || 'this email'}. Create one — it takes a
                    minute, and you&apos;ll pick whether you&apos;re joining as a student or a
                    mentor.
                  </p>
                  <button
                    type="button"
                    onClick={() => switchTab('register')}
                    className="mt-2 text-[13px] font-semibold text-white underline underline-offset-2"
                  >
                    Create an account with this email
                  </button>
                </div>
              )}
              <button type="submit" disabled={loading} className={primaryBtnClass}>
                {loading ? 'Signing In...' : 'Sign In'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleEmailSignUp} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="auth-first-name" className={labelClass}>
                    First Name
                  </label>
                  <input
                    id="auth-first-name"
                    type="text"
                    placeholder="First"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="auth-last-name" className={labelClass}>
                    Last Name
                  </label>
                  <input
                    id="auth-last-name"
                    type="text"
                    placeholder="Last"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="auth-email" className={labelClass}>
                  Email Address
                </label>
                <input
                  id="auth-email"
                  type="email"
                  placeholder="e.g. yourname@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="auth-password" className={labelClass}>
                  Password
                </label>
                <input
                  id="auth-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="auth-role" className={labelClass}>
                  Choose Account Role
                </label>
                <select
                  id="auth-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'STUDENT' | 'MENTOR' | '')}
                  className={`${inputClass} cursor-pointer appearance-none [&>option]:text-black`}
                >
                  <option value="" disabled>
                    Choose your account type
                  </option>
                  <option value="STUDENT">Student (I want a mentor)</option>
                  <option value="MENTOR">Alumni / Mentor (I want to guide)</option>
                </select>
              </div>
              {errorMsg && <p className="text-[13px] font-medium text-red-300">{errorMsg}</p>}
              <button type="submit" disabled={loading} className={primaryBtnClass}>
                {loading ? 'Creating Account...' : 'Sign Up & Join'}
              </button>
            </form>
          )}
        </>
      )}

      <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-white/40">
        <Lock className="h-3.5 w-3.5" aria-hidden="true" />
        Your account stays on Mentorly — sign in once, pick up where you left off.
      </p>
    </div>
  );
}
