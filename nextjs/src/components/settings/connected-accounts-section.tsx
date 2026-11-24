'use client';

/**
 * Mentorly — "Sign-in methods" section for Settings → Security
 * (2026-11-12, Item 3: enable SSO login from the profile/settings area).
 *
 * WHY IT LIVES HERE: the profile pages hold no account/sign-in controls
 * (personal + academic/career fields only), while every Settings page has
 * a Security tab — so this one shared section is rendered there for
 * student, mentor and admin alike. No backend endpoint: Clerk
 * external-account linking is entirely client-side.
 *
 * CLERK API — verified against the INSTALLED SDK, not guessed:
 * @clerk/clerk-react 5.61.9 + @clerk/shared 3.47.8, file
 * node_modules/@clerk/clerk-react/node_modules/@clerk/shared/dist/types/index.d.mts:
 *   - UserResource.externalAccounts: ExternalAccountResource[]
 *   - UserResource.passwordEnabled: boolean
 *   - UserResource.createExternalAccount(params: CreateExternalAccountParams)
 *       => Promise<ExternalAccountResource>, where
 *       CreateExternalAccountParams = { strategy: OAuthStrategy;
 *         redirectUrl?: string; ... } and OAuthStrategy includes
 *       'oauth_google' (`oauth_${OAuthProvider}`, GoogleOauthProvider = 'google').
 *   - ExternalAccountResource: { provider: OAuthProvider;
 *       emailAddress: string; verification: VerificationResource | null;
 *       reauthorize(params) => Promise<ExternalAccountResource>; ... }
 *   - VerificationResource.externalVerificationRedirectURL: URL | null
 *   - VerificationStatus includes 'verified'.
 *   - ClerkResource.reload(): Promise<this> (UserResource extends it).
 * Clerk docs (User.createExternalAccount) confirm this is THE flow for an
 * already-signed-in user: it "adds an external account for the user" so
 * they "can sign in with that provider in the future" — it LINKS Google
 * to the existing Clerk user, it does not create a second account. After
 * the call, redirect the user to
 * externalAccount.verification.externalVerificationRedirectURL.
 *
 * RETURN LEG — mirrors the app's existing, working OAuth pattern:
 * AuthForm.tsx uses authenticateWithRedirect with
 * redirectUrl `${origin}/onboarding` and there is NO /sso-callback route
 * and NO handleRedirectCallback call anywhere in the app, so Clerk JS
 * (loaded by ClerkProvider) completes the OAuth return automatically on
 * load. This section does the same: redirectUrl is the settings page
 * itself (?tab=security, so the Security tab re-opens on return), then on
 * mount it reloads the Clerk user and checks the Google account's
 * verification status. A sessionStorage flag marks the round trip.
 *
 * MOCK ACCOUNTS: mock users (localStorage 'mock_user_token', same key
 * mock-auth.tsx uses) have no Clerk user object. The section renders
 * disabled with a short note and NEVER calls a Clerk API for them.
 *
 * No window.alert(): errors show as an inline themed banner, and the
 * post-return success shows via the shared themed dialog
 * (useThemedDialogs / ThemedAlert).
 */
import { useEffect, useRef, useState } from 'react';
import { useUser as useClerkUser } from '@clerk/nextjs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useThemedDialogs } from '@/components/ui/themed-alert';
import { CheckCircle2, Loader2, Mail, ShieldAlert, X } from 'lucide-react';

const PENDING_KEY = 'mentorly_google_link_pending';

function GoogleMark() {
  // Same Google "G" artwork as AuthForm.tsx (the sign-in buttons).
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#EA4335" d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.48 14.98 1 12 1 7.35 1 3.37 3.67 1.39 7.56l3.85 2.99c.9-2.7 3.42-4.51 6.76-4.51z" />
      <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.51h6.46c-.29 1.48-1.14 2.73-2.4 3.58l3.76 2.91c2.2-2.03 3.67-5.01 3.67-8.64z" />
      <path fill="#FBBC05" d="M5.24 14.56c-.23-.69-.36-1.42-.36-2.18s.13-1.49.36-2.18L1.39 7.21C.5 8.99 0 10.94 0 13s.5 4.01 1.39 5.79l3.85-3.23z" />
      <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.76-2.91c-1.1.74-2.5 1.18-4.2 1.18-3.34 0-5.86-1.81-6.76-4.51L1.39 17c1.98 3.89 5.96 6.56 10.61 6.56z" />
    </svg>
  );
}

type Status = { type: 'success' | 'error' | 'info'; text: string } | null;

export function ConnectedAccountsSection() {
  const { isLoaded: clerkLoaded, user: clerkUser } = useClerkUser();
  const { showAlert, dialogs } = useThemedDialogs();
  const [connecting, setConnecting] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const returnHandledRef = useRef(false);

  // Mock test-account bypass: same localStorage key mock-auth.tsx checks.
  // Mock users have no Clerk user object, so Clerk APIs must never run.
  const [isMock] = useState(
    () => typeof window !== 'undefined' && !!localStorage.getItem('mock_user_token'),
  );

  const googleAccount = clerkUser?.externalAccounts?.find((a) => a.provider === 'google');
  const googleVerified = googleAccount?.verification?.status === 'verified';
  const googlePending = !!googleAccount && !googleVerified;
  const passwordOn = clerkUser ? clerkUser.passwordEnabled : false;
  const primaryEmail = clerkUser?.primaryEmailAddress?.emailAddress ?? '';

  // Return leg: after Google redirects back to this settings page, reload
  // the Clerk user and confirm whether the Google account verified.
  useEffect(() => {
    if (isMock || !clerkLoaded || !clerkUser || returnHandledRef.current) return;
    let pending = false;
    try {
      pending = sessionStorage.getItem(PENDING_KEY) === '1';
    } catch {}
    if (!pending) return;
    returnHandledRef.current = true;
    try {
      sessionStorage.removeItem(PENDING_KEY);
    } catch {}

    // Same failure signal AuthForm.tsx checks after an OAuth round trip.
    const params = new URLSearchParams(window.location.search);
    const oauthFailed =
      !!params.get('error') ||
      params.get('__clerk_status') === 'error' ||
      window.location.hash.includes('error');
    if (oauthFailed) {
      setStatus({
        type: 'error',
        text: 'Google connection was cancelled or failed. Please try again.',
      });
      return;
    }

    setStatus({ type: 'info', text: 'Checking your Google connection…' });
    // No cancelled/cleanup guard on purpose: React 19 StrictMode double-runs
    // effects in dev, and a cleanup here would swallow this one-shot check.
    // A late setState after unmount is a harmless no-op.
    (async () => {
      try {
        const reloaded = await clerkUser.reload();
        const linked = reloaded.externalAccounts?.find((a) => a.provider === 'google');
        if (linked?.verification?.status === 'verified') {
          setStatus({
            type: 'success',
            text: 'Google sign-in is now enabled. Next time you sign in, choose Google — no password needed.',
          });
          showAlert(
            'Google sign-in is now enabled for this account. Next time you sign in, choose Google and you will go straight in — your password still works too.',
            { title: 'Google connected', tone: 'success' },
          );
        } else {
          setStatus({
            type: 'error',
            text: 'The Google connection did not finish. Please try connecting again.',
          });
        }
      } catch {
        setStatus({
          type: 'error',
          text: 'Could not confirm the Google connection. Refresh the page to check its status.',
        });
      }
    })();
    // showAlert is stable (useCallback); clerkUser identity drives the check.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMock, clerkLoaded, clerkUser]);

  const handleConnectGoogle = async () => {
    if (isMock || !clerkUser || connecting) return;
    setConnecting(true);
    setStatus(null);
    try {
      // Return to this same settings page with the Security tab open.
      const redirectUrl = `${window.location.origin}${window.location.pathname}?tab=security`;
      try {
        sessionStorage.setItem(PENDING_KEY, '1');
      } catch {}
      let redirectTarget: URL | null = null;
      if (googleAccount) {
        // A Google account already exists but never verified: resume it
        // via reauthorize() instead of creating a duplicate.
        const resumed = await googleAccount.reauthorize({ redirectUrl });
        redirectTarget = resumed.verification?.externalVerificationRedirectURL ?? null;
      } else {
        // Links Google to THIS signed-in Clerk user (no second account).
        const created = await clerkUser.createExternalAccount({
          strategy: 'oauth_google',
          redirectUrl,
        });
        redirectTarget = created.verification?.externalVerificationRedirectURL ?? null;
      }
      if (redirectTarget) {
        window.location.href = redirectTarget.href;
        return;
      }
      try {
        sessionStorage.removeItem(PENDING_KEY);
      } catch {}
      setStatus({
        type: 'error',
        text: 'Google did not return a sign-in link. Make sure Google is enabled for sign-in, then try again.',
      });
    } catch (err: any) {
      try {
        sessionStorage.removeItem(PENDING_KEY);
      } catch {}
      setStatus({
        type: 'error',
        text:
          err?.errors?.[0]?.longMessage ||
          err?.message ||
          'Could not start the Google connection. Please try again.',
      });
    } finally {
      setConnecting(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Sign-in methods</CardTitle>
          <CardDescription>
            Choose how you sign in to Mentorly. Connecting Google never removes your password.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status && (
            <div
              className={`flex items-start gap-3 rounded-xl border p-4 text-sm ${
                status.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50/60 text-neutral-700'
                  : status.type === 'error'
                    ? 'border-red-200 bg-red-50/60 text-neutral-700'
                    : 'border-neutral-200 bg-neutral-50 text-neutral-700'
              }`}
            >
              {status.type === 'success' ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              ) : status.type === 'error' ? (
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
              ) : (
                <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-neutral-500" />
              )}
              <p className="flex-1 leading-relaxed">{status.text}</p>
              <button
                type="button"
                onClick={() => setStatus(null)}
                aria-label="Dismiss"
                className="shrink-0 rounded-full p-1 text-neutral-400 hover:bg-white hover:text-neutral-900"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {isMock ? (
            <div className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-neutral-400" />
              <p className="text-sm leading-relaxed text-neutral-600">
                Sign-in methods cannot be changed for the test account. Sign in with a real account to
                connect Google.
              </p>
            </div>
          ) : !clerkLoaded ? (
            <p className="text-sm text-neutral-500">Loading sign-in methods…</p>
          ) : !clerkUser ? (
            <p className="text-sm text-neutral-500">Sign in to manage your sign-in methods.</p>
          ) : (
            <>
              {/* Email + password */}
              <div className="flex items-center justify-between py-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-gray-400" />
                  <div>
                    <h4 className="font-medium text-gray-900">Email + password</h4>
                    <p className="text-sm text-lpu-text-secondary">
                      {primaryEmail || 'Password sign-in'}
                    </p>
                  </div>
                </div>
                {passwordOn ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
                    On
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-500 bg-neutral-100 border border-neutral-200 rounded-full px-3 py-1">
                    Not set
                  </span>
                )}
              </div>

              {/* Google */}
              <div className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3">
                  <GoogleMark />
                  <div>
                    <h4 className="font-medium text-gray-900">Google</h4>
                    <p className="text-sm text-lpu-text-secondary">
                      {googleVerified
                        ? `Connected as ${googleAccount?.emailAddress || 'your Google account'}`
                        : googlePending
                          ? 'Connection started — finish it with Google'
                          : 'Sign in with your Google account'}
                    </p>
                  </div>
                </div>
                {googleVerified ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Connected
                  </span>
                ) : googlePending ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
                    <ShieldAlert className="h-3.5 w-3.5" /> Pending
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-500 bg-neutral-100 border border-neutral-200 rounded-full px-3 py-1">
                    Not connected
                  </span>
                )}
              </div>

              {!googleVerified && (
                <div>
                  <Button
                    onClick={handleConnectGoogle}
                    disabled={connecting}
                    className="rounded-full bg-neutral-900 px-6 text-white hover:bg-neutral-800 disabled:opacity-60"
                  >
                    {connecting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <span className="mr-2 flex">
                        <GoogleMark />
                      </span>
                    )}
                    {connecting
                      ? 'Connecting…'
                      : googlePending
                        ? 'Finish connecting to Google'
                        : 'Enable Google sign-in'}
                  </Button>
                  <p className="mt-3 text-xs leading-relaxed text-neutral-500">
                    Google is linked to this account — it never creates a second account. From your
                    next sign-in you can choose Google and go straight in.
                  </p>
                </div>
              )}
              {googleVerified && (
                <p className="text-xs leading-relaxed text-neutral-500">
                  You can sign in with Google or with your password — whichever you prefer.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
      {dialogs}
    </>
  );
}
