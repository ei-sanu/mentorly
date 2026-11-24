/**
 * Password reset via verified-mobile OTP (2026-11-12).
 *
 * WHY THIS EXISTS: passwords live in Clerk, not in this backend, and a
 * user who forgot their password has no session — so the existing
 * phone-OTP endpoints (POST /verification/phone/*) cannot be reused:
 * every one of them sits behind requireAuth. These endpoints are
 * PUBLIC by design and prove ownership a different way: an MSG91 OTP
 * sent to the mobile number the account ALREADY verified during
 * onboarding. Only after that OTP verifies does the backend set a new
 * password, through the Clerk Backend API.
 *
 * FLOW (three calls, all under /auth/password-reset/):
 *   1. request-otp  — normalize phone → find the user whose VERIFIED
 *      mobile matches → rate-limit → MSG91 sendOtp. No verified user
 *      for the number → 404 NO_VERIFIED_MOBILE ("No verified mobile
 *      number on this account — use email reset instead.") and NO SMS
 *      is sent, so arbitrary numbers can never be spammed or probed
 *      into receiving codes.
 *   2. verify-otp   — MSG91 verifyOtp (same widget/standard handling
 *      and reqId bookkeeping as VerificationService) → issues a
 *      single-use reset token (32 random bytes; only its SHA-256 hash
 *      is stored, 10-minute expiry).
 *   3. confirm      — consumes the reset token and ONLY then calls
 *      Clerk: clerkClient.users.updateUser(clerkUserId, { password,
 *      signOutOfOtherSessions: true }).
 *
 * SECURITY RULES (all enforced here, not left to the client):
 * - No OTP proof, no password change: confirm requires a valid,
 *   unexpired, single-use reset token issued by verify-otp.
 * - The mobile must belong to the account: lookup requires
 *   phoneDetails.verified (or the legacy phone + VERIFIED status).
 * - Rate limits mirror VerificationService (same env knobs, same
 *   in-process store): 30s cooldown, 5 sends/hour per phone and per
 *   IP, 5 verify attempts per OTP, 5 confirm attempts per token.
 * - Never logged: OTP codes, reset tokens, new passwords. Logs carry
 *   at most a masked phone and a user id; Clerk failures log the
 *   error CODE only.
 * - Test/mock accounts (clerkUserId starting with mock_user_) cannot
 *   reset here.
 *
 * REUSE: MSG91 calls go through the existing msg91Service (no
 * duplicated provider logic); rate-limit/reqId state lives in the
 * shared inMemoryStore under pwdreset:* keys; phone normalization is
 * the same parse-first logic as VerificationService.normalizePhone
 * (phone-validation fix, 2026-11-11 — a national number starting with
 * the country-code digits, e.g. 9124953636, must NOT be stripped).
 *
 * LIMITS, stated plainly: state is in-process (lost on restart,
 * single instance only — same trade-off as the rest of this backend
 * since the Redis removal). MSG91 is currently returning 418
 * AuthenticationFailure (Somesh's config item); until that is fixed,
 * request-otp fails with the provider's message and users must use
 * the Clerk email-reset fallback in the auth form.
 *
 * VERIFIED CLERK API (installed @clerk/backend, node_modules
 * @clerk/backend/dist/api/endpoints/UserApi.d.ts):
 *   updateUser(userId: string, params?: UpdateUserParams): Promise<User>
 *   UpdateUserParams.password?: string — "The plaintext password to
 *   give the user. Must be at least 8 characters long, and can not be
 *   in any list of hacked passwords."
 *   UpdateUserParams.signOutOfOtherSessions?: boolean — "Set to true
 *   to sign out the user from all their active sessions once their
 *   password is updated. This parameter can only be used when
 *   providing a password."
 * Client construction mirrors require-auth.ts:
 *   const { createClerkClient } = require('@clerk/backend');
 *   createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })
 * (createClerkClient verified in @clerk/backend/dist/index.d.ts).
 */
import * as crypto from 'crypto';
import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '../common/errors';
import { UserModel } from '../database/models';
import { auditService } from '../audit/audit.service';
import { msg91Service } from '../integrations/msg91/msg91.service';
import { inMemoryStore } from '../common/in-memory-store';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { Logger } from '../common/logger';

const logger = new Logger('PasswordReset');

const NO_VERIFIED_MOBILE_MESSAGE =
  'No verified mobile number on this account — use email reset instead.';
const TOKEN_TTL_SECONDS = 600; // 10 minutes to set the new password
const MAX_CONFIRM_ATTEMPTS = 5;

export class PasswordResetService {
  private readonly store = inMemoryStore;
  private readonly cooldownSeconds: number;
  private readonly maxSendsPerHour: number;
  private readonly maxAttempts: number;

  constructor() {
    this.cooldownSeconds = parseInt(process.env.MSG91_OTP_RESEND_COOLDOWN_SECONDS || '30', 10);
    this.maxSendsPerHour = parseInt(process.env.MSG91_OTP_MAX_SENDS_PER_HOUR || '5', 10);
    this.maxAttempts = parseInt(process.env.MSG91_OTP_MAX_ATTEMPTS || '5', 10);
  }

  private hashIdentifier(val: string): string {
    return crypto.createHash('sha256').update(val).digest('hex');
  }

  private maskPhoneNumber(phone: string): string {
    if (!phone) return '';
    if (phone.length <= 7) return phone;
    const visibleStart = phone.substring(0, 3);
    const visibleEnd = phone.substring(phone.length - 4);
    const masked = '*'.repeat(phone.length - 7);
    return `${visibleStart} ${masked}${visibleEnd}`;
  }

  /**
   * Same parse-first normalization as VerificationService.normalizePhone.
   * Try +<country code><digits> first; only strip a leading country
   * code from the number field when that fails to parse. Never strip
   * unconditionally: 9124953636 legitimately starts with "91".
   */
  private normalizePhone(countryCode: string, nationalNumber: string) {
    const cleanCC = (countryCode || '').replace(/\+/g, '').trim();
    let cleanNum = (nationalNumber || '').replace(/[\s\-+()]/g, '').trim();

    if (cleanCC === '91' && cleanNum.length === 11 && cleanNum.startsWith('0')) {
      cleanNum = cleanNum.substring(1);
    }

    let parsed = parsePhoneNumberFromString(`+${cleanCC}${cleanNum}`);

    if ((!parsed || !parsed.isValid()) && cleanNum.startsWith(cleanCC)) {
      const stripped = cleanNum.substring(cleanCC.length);
      const retry = parsePhoneNumberFromString(`+${cleanCC}${stripped}`);
      if (retry && retry.isValid()) {
        parsed = retry;
      }
    }

    if (!parsed || !parsed.isValid()) {
      throw new BadRequestException('Invalid phone number format.');
    }
    return {
      countryCode: `+${parsed.countryCallingCode}`,
      nationalNumber: parsed.nationalNumber,
      e164: parsed.format('E.164'),
    };
  }

  /** The account whose VERIFIED mobile matches, or null. Never matches an unverified number. */
  private async findVerifiedUser(e164: string): Promise<any | null> {
    return UserModel.findOne({
      $or: [
        { 'phoneDetails.e164': e164, 'phoneDetails.verified': true },
        { phone: e164, 'phoneVerification.status': 'VERIFIED' },
      ],
    }).lean();
  }

  private noVerifiedMobile(): NotFoundException {
    // Object form so the error handler surfaces code NO_VERIFIED_MOBILE
    // (the frontend keys its email-fallback notice off it).
    return new NotFoundException({
      statusCode: 404,
      message: NO_VERIFIED_MOBILE_MESSAGE,
      error: 'NO_VERIFIED_MOBILE',
    } as any);
  }

  /** Audit failures must never break the reset flow. */
  private async auditSafe(
    actorId: string | null,
    action: string,
    entityId: string,
    metadata?: any,
  ): Promise<void> {
    try {
      await auditService.log(actorId, action, 'User', entityId, metadata);
    } catch {
      /* ignore */
    }
  }

  /** Mirrors VerificationService.incrementSendCount, keyed by phone hash (no user id pre-auth). */
  private async incrementSendCount(phoneHash: string, ipAddress?: string): Promise<void> {
    const phoneKey = `pwdreset:send:phone:${phoneHash}`;
    const phoneSends = await this.store.incr(phoneKey);
    if (phoneSends === 1) {
      await this.store.expire(phoneKey, 3600);
    }
    if (phoneSends > this.maxSendsPerHour) {
      throw new BadRequestException(
        'Too many password-reset code requests for this phone number this hour.',
      );
    }

    if (ipAddress) {
      const ipKey = `pwdreset:send:ip:${this.hashIdentifier(ipAddress)}`;
      const ipSends = await this.store.incr(ipKey);
      if (ipSends === 1) {
        await this.store.expire(ipKey, 3600);
      }
      if (ipSends > this.maxSendsPerHour * 2) {
        throw new BadRequestException('Rate limit exceeded for this network.');
      }
    }

    await this.store.set(`pwdreset:cooldown:phone:${phoneHash}`, '1', 'EX', this.cooldownSeconds);
  }

  async requestOtp(
    countryCode: string,
    nationalNumber: string,
    ipAddress?: string,
  ): Promise<any> {
    const normalized = this.normalizePhone(countryCode, nationalNumber);
    const phoneHash = this.hashIdentifier(normalized.e164);

    const cooldown = await this.store.ttl(`pwdreset:cooldown:phone:${phoneHash}`);
    if (cooldown > 0) {
      throw new BadRequestException(
        `Please wait ${cooldown} seconds before requesting a new code.`,
      );
    }

    await this.incrementSendCount(phoneHash, ipAddress);

    // Only a VERIFIED mobile on file receives a code. Anything else —
    // unknown number, unverified number — gets the same answer and no SMS.
    const user: any = await this.findVerifiedUser(normalized.e164);
    if (!user) {
      throw this.noVerifiedMobile();
    }

    let sendResult: any;
    try {
      sendResult = await msg91Service.sendOtp(normalized.e164);
    } catch (err: any) {
      throw new InternalServerErrorException(
        err.message || "We couldn't send a verification code right now. Please try again.",
      );
    }

    const reqId = msg91Service.extractReqId(sendResult);
    if (reqId) {
      await this.store.set(`pwdreset:reqId:phone:${phoneHash}`, reqId, 'EX', 600);
    }
    await this.store.del(`pwdreset:attempts:phone:${phoneHash}`);

    await this.auditSafe(user._id.toString(), 'PASSWORD_RESET_OTP_REQUESTED', user._id.toString(), {
      phone: this.maskPhoneNumber(normalized.e164),
    });
    logger.log(
      `Password-reset OTP requested for user ${user._id.toString()} (${this.maskPhoneNumber(normalized.e164)})`,
    );

    return {
      phone: this.maskPhoneNumber(normalized.e164),
      otpSent: true,
      resendAvailableIn: this.cooldownSeconds,
    };
  }

  async verifyOtp(
    countryCode: string,
    nationalNumber: string,
    otp: string,
  ): Promise<any> {
    if (!otp || !/^\d{4,8}$/.test(String(otp).trim())) {
      throw new BadRequestException('Enter the verification code sent to your phone.');
    }
    const normalized = this.normalizePhone(countryCode, nationalNumber);
    const phoneHash = this.hashIdentifier(normalized.e164);

    const user: any = await this.findVerifiedUser(normalized.e164);
    if (!user) {
      throw this.noVerifiedMobile();
    }

    const attemptsKey = `pwdreset:attempts:phone:${phoneHash}`;
    const attemptsRaw = await this.store.get(attemptsKey);
    if (attemptsRaw && parseInt(attemptsRaw, 10) >= this.maxAttempts) {
      throw new BadRequestException('Too many verification attempts. Please request a new code.');
    }

    const storedReqId = await this.store.get(`pwdreset:reqId:phone:${phoneHash}`);
    // Widget API requires the reqId from sendOtp; without it MSG91 always rejects.
    if (msg91Service.isWidgetMode && !storedReqId) {
      throw new BadRequestException('Your verification session has expired. Please request a new code.');
    }

    const isVerified = await msg91Service.verifyOtp(
      normalized.e164,
      String(otp).trim(),
      storedReqId || undefined,
    );

    if (!isVerified) {
      const attemptsCount = await this.store.incr(attemptsKey);
      if (attemptsCount === 1) {
        await this.store.expire(attemptsKey, 3600);
      }
      await this.auditSafe(
        user._id.toString(),
        'PASSWORD_RESET_OTP_FAILED',
        user._id.toString(),
        { phone: this.maskPhoneNumber(normalized.e164), attempts: attemptsCount },
      );
      if (attemptsCount >= this.maxAttempts) {
        throw new BadRequestException('Too many verification attempts. Please request a new code.');
      }
      throw new BadRequestException('The code is incorrect. Please try again.');
    }

    // OTP verified: issue a single-use reset token. Only the hash is
    // stored; the raw token goes back to the client once, in memory.
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashIdentifier(token);
    await this.store.set(`pwdreset:token:${tokenHash}`, user._id.toString(), 'EX', TOKEN_TTL_SECONDS);
    await this.store.del(
      attemptsKey,
      `pwdreset:cooldown:phone:${phoneHash}`,
      `pwdreset:reqId:phone:${phoneHash}`,
    );

    await this.auditSafe(user._id.toString(), 'PASSWORD_RESET_OTP_VERIFIED', user._id.toString(), {
      phone: this.maskPhoneNumber(normalized.e164),
    });
    logger.log(`Password-reset OTP verified for user ${user._id.toString()}`);

    return { verified: true, resetToken: token, expiresIn: TOKEN_TTL_SECONDS };
  }

  async confirmReset(resetToken: string, newPassword: string): Promise<any> {
    if (!resetToken || typeof resetToken !== 'string') {
      throw new BadRequestException('Reset session expired or already used. Please request a new code.');
    }
    // Clerk requires at least 8 characters (see header). Length is the
    // only rule enforced here; pwned/weak checks are Clerk's, and its
    // rejection is surfaced as a password-policy message below.
    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters long.');
    }

    const tokenHash = this.hashIdentifier(resetToken);
    const tokenKey = `pwdreset:token:${tokenHash}`;
    const userId = await this.store.get(tokenKey);
    if (!userId) {
      throw new BadRequestException('Reset session expired or already used. Please request a new code.');
    }

    const attemptsKey = `pwdreset:confirm-attempts:${tokenHash}`;
    const attemptsRaw = await this.store.get(attemptsKey);
    if (attemptsRaw && parseInt(attemptsRaw, 10) >= MAX_CONFIRM_ATTEMPTS) {
      await this.store.del(tokenKey, attemptsKey);
      throw new BadRequestException('Too many attempts. Please request a new code.');
    }

    const user: any = await UserModel.findById(userId).lean();
    const clerkUserId = user ? String(user.clerkUserId || '') : '';
    if (!user || !clerkUserId || clerkUserId.startsWith('mock_user_')) {
      await this.store.del(tokenKey, attemptsKey);
      throw new BadRequestException('Password reset is not available for this account.');
    }

    let clerkClient: any;
    try {
      const { createClerkClient } = require('@clerk/backend');
      clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
    } catch {
      throw new InternalServerErrorException('Password reset is unavailable right now. Please try again later.');
    }

    try {
      await clerkClient.users.updateUser(clerkUserId, {
        password: newPassword,
        signOutOfOtherSessions: true,
      });
    } catch (err: any) {
      const attemptsCount = await this.store.incr(attemptsKey);
      if (attemptsCount === 1) {
        await this.store.expire(attemptsKey, TOKEN_TTL_SECONDS);
      }
      if (attemptsCount >= MAX_CONFIRM_ATTEMPTS) {
        await this.store.del(tokenKey, attemptsKey);
      }
      // Log the Clerk error CODE only — never the password, token or OTP.
      const clerkCode = String(err?.errors?.[0]?.code || '');
      logger.error(`Password reset Clerk update failed for user ${userId}: ${clerkCode || 'unknown error'}`);
      if (clerkCode.includes('password') || /password/i.test(String(err?.message || ''))) {
        throw new BadRequestException(
          'That password could not be used. It may be too weak or previously compromised — try a stronger, unique password.',
        );
      }
      throw new InternalServerErrorException('Could not update the password. Please try again.');
    }

    // Single-use: the token dies with a successful reset.
    await this.store.del(tokenKey, attemptsKey);

    const masked = this.maskPhoneNumber(user.phoneDetails?.e164 || user.phone || '');
    await this.auditSafe(userId, 'PASSWORD_RESET_COMPLETED', userId, { phone: masked });
    logger.log(`Password reset completed for user ${userId} (mobile OTP)`);

    return { passwordUpdated: true };
  }
}

export const passwordResetService = new PasswordResetService();
