'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { userService } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Clock, ShieldAlert, Check, CheckCircle, HelpCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '@/lib/mock-auth';

/**
 * Status polling: the page checks /me once on mount, then re-checks
 * every 60s so an approval (or rejection) moves the user on without a
 * manual refresh — and the Refresh button forces an immediate re-check.
 * Never poll faster: each /me costs the backend a full auth + DB round.
 */
const STATUS_POLL_MS = 60_000;

type StageState = 'done' | 'active' | 'pending';

// Circular checklist indicator, styled after the reference card:
// completed = filled black circle + white check; in progress = ring
// with a pulsing centre dot (same language as the status dot in the
// gradient band); pending = hollow grey ring.
function StageIndicator({ state }: { state: StageState }) {
  if (state === 'done') {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-900">
        <Check className="h-3 w-3 text-white" strokeWidth={3.5} />
      </span>
    );
  }
  if (state === 'active') {
    return (
      <span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neutral-400 opacity-40"></span>
        <span className="relative flex h-5 w-5 items-center justify-center rounded-full border-[1.5px] border-neutral-500 bg-[#fffdf4]">
          <span className="h-1.5 w-1.5 rounded-full bg-neutral-900"></span>
        </span>
      </span>
    );
  }
  return <span className="h-5 w-5 shrink-0 rounded-full border-[1.5px] border-neutral-300"></span>;
}

// Same masking as the backend's maskPhoneNumber (verification.service):
// first 3 characters, asterisks, last 4 — e.g. "+91 ******3636". The
// full number is never rendered.
function maskPhone(e164: string): string {
  if (!e164) return '';
  if (e164.length <= 7) return e164;
  return `${e164.slice(0, 3)} ${'*'.repeat(e164.length - 7)}${e164.slice(-4)}`;
}

// Same masking as the profile pages (StudentProfile / MentorProfile):
// first 3 characters + XXXXX — e.g. "123XXXXX". The full number is
// never rendered.
function maskRegNo(regNo: string): string {
  if (!regNo) return '';
  if (regNo.length <= 3) return regNo;
  return `${regNo.slice(0, 3)}XXXXX`;
}

export default function OnboardingStatusPage() {
  const router = useRouter();
  const { signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userState, setUserState] = useState<any>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  // One logical status check. `background` keeps the full-page spinner
  // off for polls / manual refreshes (only the button spins).
  // NOTE: `router` is intentionally NOT a dep of this callback. The
  // useRouter shim (src/compat/next-navigation.ts) returns a fresh
  // object on every render, so depending on it re-created this
  // callback — and re-ran every effect using it — on every render.
  // The underlying navigate() is stable, so the captured router still
  // works (same reasoning as the AppLayout dep fix, 2026-11-11).
  const checkStatus = useCallback(async (opts?: { forceRefresh?: boolean; background?: boolean }) => {
    if (opts?.background) setRefreshing(true);
    try {
      const fresh = await userService.getMe({ forceRefresh: opts?.forceRefresh });
      if (fresh) {
        setUserState(fresh);
        setLastChecked(new Date());
        // If approved, redirect to dashboard
        if (fresh.onboardingStatus === 'APPROVED') {
          router.push(`/app/${fresh.role.toLowerCase().replace('_', '-')}/dashboard`);
        } else if (fresh.onboardingStatus === 'REJECTED' || fresh.onboardingStatus === 'CHANGES_REQUESTED') {
          router.push('/onboarding/review');
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Fetch ONCE on mount. The old effect listed `router` as a dep, so it
  // re-ran — and re-called getMe() — on every render: 11 GET /me calls
  // in ~7s, each preceded by a ClerkAuthGuard DEBUG line. The ref guard
  // makes this one-shot even under StrictMode's double-invoke (same
  // pattern as OnboardingPage's initial auth check).
  const initialCheckDone = useRef(false);
  useEffect(() => {
    if (initialCheckDone.current) return;
    initialCheckDone.current = true;
    checkStatus();
  }, [checkStatus]);

  // Slow status poll (60s): picks up an approval/rejection while the
  // user waits, without pressuring the backend.
  useEffect(() => {
    const id = setInterval(() => {
      checkStatus({ background: true });
    }, STATUS_POLL_MS);
    return () => clearInterval(id);
  }, [checkStatus]);

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{
          backgroundColor: '#f6f5f1',
          backgroundImage:
            'repeating-linear-gradient(45deg, rgba(0,0,0,0.045) 0 1px, transparent 1px 26px), repeating-linear-gradient(-45deg, rgba(0,0,0,0.045) 0 1px, transparent 1px 26px)',
        }}
      >
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-neutral-900 border-t-transparent mx-auto"></div>
      </div>
    );
  }

  // Checklist indicators for the Review / Approval rows, derived ONLY
  // from the live onboardingStatus this page already holds. A check
  // appears only when the backend reported APPROVED (this page
  // redirects away on APPROVED, so in practice the rows render while
  // UNDER_REVIEW / SUBMITTED: review in progress, approval pending).
  // REJECTED / CHANGES_REQUESTED also redirect away; if ever rendered
  // here, both rows stay pending rather than faking a completed stage.
  const liveStatus = (userState?.onboardingStatus ?? 'UNDER_REVIEW') as string;
  const reviewStage: StageState =
    liveStatus === 'APPROVED' ? 'done' : liveStatus === 'UNDER_REVIEW' || liveStatus === 'SUBMITTED' ? 'active' : 'pending';
  const approvalStage: StageState = liveStatus === 'APPROVED' ? 'done' : 'pending';

  // Verification details, derived ONLY from fields the /me response
  // this page already polls carries (users.service findOne returns the
  // full User document). No extra fetch, and no state is claimed that
  // the backend did not report:
  //
  // - Basic details: the onboarding form (name + identity fields) was
  //   submitted when submitOnboarding ran, which sets onboardingStatus
  //   to UNDER_REVIEW. "Submitted" is the honest word — the team
  //   review that verifies those details is the Review row above,
  //   not this one. The name check guards the UNDER_REVIEW default
  //   when /me has not returned anything yet.
  // - Mobile number: verified only when the backend recorded it —
  //   phoneDetails.verified (set by verifyOtp / verifyWidgetToken)
  //   or phoneVerification.status VERIFIED. PENDING (OTP sent, code
  //   not yet entered) renders in progress; anything else renders
  //   pending. The number is shown masked with the backend's own
  //   maskPhoneNumber algorithm, the same masked form every
  //   verification API response returns.
  // - Email address: deliberately absent. Neither the User document
  //   nor the app's auth layer exposes an email-verification flag,
  //   so it cannot be shown truthfully.
  const detailsSubmitted =
    (liveStatus === 'UNDER_REVIEW' || liveStatus === 'SUBMITTED' || liveStatus === 'APPROVED') &&
    Boolean(userState?.firstName && userState?.lastName);
  const detailsStage: StageState = detailsSubmitted ? 'done' : 'pending';

  const phoneVerified =
    userState?.phoneDetails?.verified === true || userState?.phoneVerification?.status === 'VERIFIED';
  const phoneAwaiting = userState?.phoneVerification?.status === 'PENDING';
  const phoneStage: StageState = phoneVerified ? 'done' : phoneAwaiting ? 'active' : 'pending';
  const maskedPhone = maskPhone(userState?.phoneDetails?.e164 ?? '');

  // Registration number: on file when submitOnboarding recorded it
  // (lpuRegistrationNumber on the User document, written only when
  // provided — the backend never requires it, so absence is not a
  // failure state). "Provided" is the honest word: the number being
  // on file is not a verification; the team review that checks it
  // is the Review row above. Applies to students and mentors alike
  // (submitOnboarding writes it before the role branch, and both
  // profile pages display it). Shown masked with the profile pages'
  // own masking.
  const regNoValue =
    typeof userState?.lpuRegistrationNumber === 'string' ? userState.lpuRegistrationNumber.trim() : '';
  const regNoStage: StageState = regNoValue ? 'done' : 'pending';
  const maskedRegNo = maskRegNo(regNoValue);

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-8"
      style={{
        backgroundColor: '#f6f5f1',
        backgroundImage:
          'repeating-linear-gradient(45deg, rgba(0,0,0,0.045) 0 1px, transparent 1px 26px), repeating-linear-gradient(-45deg, rgba(0,0,0,0.045) 0 1px, transparent 1px 26px)',
      }}
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-[28px] border border-[#e4e1d6] bg-[#fffdf4]"
        style={{ boxShadow: '0 24px 48px -24px rgba(60,50,20,0.28), 0 2px 6px rgba(60,50,20,0.06)' }}
      >
        {/* Pastel gradient band: pale yellow blending into lavender into soft pink. */}
        <div
          className="h-[132px] px-6 pt-7 text-center"
          style={{ background: 'linear-gradient(100deg, #fdf2bd 0%, #f6e3f2 34%, #ddd0fb 62%, #f9c6e0 100%)' }}
        >
          <div className="flex items-center justify-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neutral-500 opacity-60"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-neutral-900"></span>
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-800">
              {((userState?.onboardingStatus ?? 'UNDER_REVIEW') as string).toLowerCase().replace(/_/g, ' ')}
            </span>
          </div>
        </div>

        {/* Cream body overlapping the gradient, with the folded-corner notch
            where the two meet: the top edge runs flat, steps diagonally up,
            then flat again, revealing the gradient through the cut. */}
        <div
          className="relative -mt-14 bg-[#fffdf4] px-6 pb-6 pt-[52px]"
          style={{ clipPath: 'polygon(0 36px, 43% 36px, 54% 0px, 100% 0px, 100% 100%, 0 100%)' }}
        >
          <div className="space-y-5 text-center text-sm">
            <div className="space-y-2">
              <h1 className="text-[22px] font-bold tracking-tight text-neutral-900">Application under review</h1>
              <p className="text-sm leading-relaxed text-neutral-500">Your identity and profile details are being reviewed by our team.</p>
            </div>

            <div className="space-y-2.5 border-t border-[#ece8db] pt-5 text-left">
              <div className="flex gap-3">
                <StageIndicator state={reviewStage} />
                <span className="w-[74px] shrink-0 pt-px text-[11px] font-medium uppercase tracking-wide text-neutral-400">Review</span>
                <span className={reviewStage === 'done' ? 'text-neutral-900' : reviewStage === 'pending' ? 'text-neutral-400' : 'text-neutral-700'}>Typically processed within 24–48 business hours.</span>
              </div>
              <div className="flex gap-3">
                <StageIndicator state={approvalStage} />
                <span className="w-[74px] shrink-0 pt-px text-[11px] font-medium uppercase tracking-wide text-neutral-400">Approval</span>
                <span className={approvalStage === 'done' ? 'text-neutral-900' : approvalStage === 'pending' ? 'text-neutral-400' : 'text-neutral-700'}>Full platform credentials and access on approval.</span>
              </div>
            </div>

            <div className="space-y-2.5 border-t border-[#ece8db] pt-5 text-left">
              <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">Verification details</p>
              <div className="flex gap-3">
                <StageIndicator state={detailsStage} />
                <span className="w-[98px] shrink-0 pt-px text-[11px] font-medium uppercase tracking-wide text-neutral-400">Basic details</span>
                <span className={detailsStage === 'done' ? 'text-neutral-900' : 'text-neutral-400'}>{detailsSubmitted ? 'Submitted for review.' : 'Not submitted yet.'}</span>
              </div>
              <div className="flex gap-3">
                <StageIndicator state={phoneStage} />
                <span className="w-[98px] shrink-0 pt-px text-[11px] font-medium uppercase tracking-wide text-neutral-400">Mobile number</span>
                <span className={phoneStage === 'done' ? 'text-neutral-900' : phoneStage === 'pending' ? 'text-neutral-400' : 'text-neutral-700'}>
                  {phoneVerified
                    ? `Verified${maskedPhone ? ` · ${maskedPhone}` : ''}.`
                    : phoneAwaiting
                      ? `Awaiting verification${maskedPhone ? ` · ${maskedPhone}` : ''}.`
                      : `Not verified${maskedPhone ? ` · ${maskedPhone}` : ''}.`}
                </span>
              </div>
              <div className="flex gap-3">
                <StageIndicator state={regNoStage} />
                <span className="w-[98px] shrink-0 pt-px text-[11px] font-medium uppercase tracking-wide text-neutral-400">Registration number</span>
                <span className={regNoStage === 'done' ? 'text-neutral-900' : 'text-neutral-400'}>
                  {regNoValue ? `Provided · ${maskedRegNo}.` : 'Not provided.'}
                </span>
              </div>
            </div>

            <p className="text-xs text-neutral-400">
              {userState?.firstName} {userState?.lastName}
              {userState?.role ? <> · <span className="uppercase">{userState.role}</span></> : null}
            </p>

            <div className="flex items-center justify-between border-t border-[#ece8db] pt-4 text-left">
              <div className="text-xs leading-relaxed text-neutral-400">
                {lastChecked && (
                  <p>Last checked {lastChecked.toLocaleTimeString()}</p>
                )}
                <p>Refreshes automatically every minute.</p>
              </div>
              <Button
                onClick={() => checkStatus({ forceRefresh: true, background: true })}
                disabled={refreshing}
                variant="ghost"
                className="h-8 px-2 text-sm font-medium text-neutral-900 hover:bg-[#f5f1e6]"
              >
                <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Checking…' : 'Refresh'}
              </Button>
            </div>

            <div className="flex items-center justify-center gap-1">
              <Button onClick={() => router.push('/')} variant="ghost" className="h-8 px-2 text-xs text-neutral-400 hover:text-neutral-900 hover:bg-transparent">
                Back to home
              </Button>
              <span className="text-neutral-300">·</span>
              <Button
                onClick={() => {
                  signOut();
                  router.push('/');
                }}
                variant="ghost"
                className="h-8 px-2 text-xs text-neutral-400 hover:text-red-600 hover:bg-transparent"
              >
                Sign out
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
