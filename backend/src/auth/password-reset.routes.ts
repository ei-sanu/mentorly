import { Router } from 'express';
import { asyncHandler } from '../common/async-handler';
import { passwordResetService } from './password-reset.service';

export const passwordResetRouter = Router();

// Public by design: the user is locked out and has no session, so
// requireAuth cannot apply. Proof of ownership is the MSG91 OTP sent
// to the account's VERIFIED mobile (see password-reset.service.ts);
// the confirm step additionally requires the single-use reset token
// issued by verify-otp. All three endpoints are rate-limited in the
// service. Never log request bodies here — they carry OTPs/passwords.
passwordResetRouter.post(
  '/auth/password-reset/request-otp',
  asyncHandler(async (req, res) => {
    const body = req.body as { phoneNumber?: string; countryCode?: string };
    const data = await passwordResetService.requestOtp(
      body?.countryCode || '+91',
      body?.phoneNumber || '',
      req.ip,
    );
    res.status(201).json({ success: true, data });
  }),
);

passwordResetRouter.post(
  '/auth/password-reset/verify-otp',
  asyncHandler(async (req, res) => {
    const body = req.body as { phoneNumber?: string; countryCode?: string; otp?: string };
    const data = await passwordResetService.verifyOtp(
      body?.countryCode || '+91',
      body?.phoneNumber || '',
      body?.otp || '',
    );
    res.status(201).json({ success: true, data });
  }),
);

passwordResetRouter.post(
  '/auth/password-reset/confirm',
  asyncHandler(async (req, res) => {
    const body = req.body as { resetToken?: string; newPassword?: string };
    const data = await passwordResetService.confirmReset(
      body?.resetToken || '',
      body?.newPassword || '',
    );
    res.json({ success: true, data });
  }),
);
