import { Router } from 'express';
import { asyncHandler } from '../common/async-handler';
import { requireAuth } from '../auth/require-auth';
import { requireRoles } from '../auth/require-roles';
import { validateBody } from '../middleware/validate';
import { validateObjectIdParam } from '../middleware/validate-object-id';
import { Role } from '../database/schemas/user.schema';
import { verificationService } from './verification.service';
import { SubmitVerificationDto } from './dto/submit-verification.dto';
import { RejectVerificationDto } from './dto/reject-verification.dto';
import { RequestChangesDto } from './dto/request-changes.dto';

export const verificationRouter = Router();


verificationRouter.post(
  '/verification',
  requireAuth,
  validateBody(SubmitVerificationDto),
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    const verification = await verificationService.submit(user.id, req.body);
    res.status(201).json({ success: true, data: verification });
  }),
);

verificationRouter.get(
  '/verification',
  requireAuth,
  requireRoles(Role.ADMIN, Role.ALUMNI_OFFICER),
  asyncHandler(async (req, res) => {
    const list = await verificationService.findAll();
    res.json({ success: true, data: list });
  }),
);

verificationRouter.get(
  '/verification/:id',
  requireAuth,
  requireRoles(Role.ADMIN, Role.ALUMNI_OFFICER),
  validateObjectIdParam('id', 'verification'),
  asyncHandler(async (req, res) => {
    const v = await verificationService.findOne((req.params.id as string));
    res.json({ success: true, data: v });
  }),
);

verificationRouter.patch(
  '/verification/:id/approve',
  requireAuth,
  requireRoles(Role.ADMIN, Role.ALUMNI_OFFICER),
  validateObjectIdParam('id', 'verification'),
  asyncHandler(async (req, res) => {
    const reviewer = (req as any).user;
    const approved = await verificationService.approve((req.params.id as string), reviewer.id);
    res.json({ success: true, data: approved });
  }),
);

verificationRouter.patch(
  '/verification/:id/reject',
  requireAuth,
  requireRoles(Role.ADMIN, Role.ALUMNI_OFFICER),
  validateObjectIdParam('id', 'verification'),
  validateBody(RejectVerificationDto),
  asyncHandler(async (req, res) => {
    const reviewer = (req as any).user;
    const rejected = await verificationService.reject(
      (req.params.id as string),
      reviewer.id,
      req.body.rejectionReason,
    );
    res.json({ success: true, data: rejected });
  }),
);

verificationRouter.patch(
  '/verification/:id/request-changes',
  requireAuth,
  requireRoles(Role.ADMIN, Role.ALUMNI_OFFICER),
  validateObjectIdParam('id', 'verification'),
  validateBody(RequestChangesDto),
  asyncHandler(async (req, res) => {
    const reviewer = (req as any).user;
    const changes = await verificationService.requestChanges(
      (req.params.id as string),
      reviewer.id,
      req.body.explanation,
    );
    res.json({ success: true, data: changes });
  }),
);

verificationRouter.post(
  '/verification/phone/send-otp',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    const body = req.body as { phoneNumber: string; countryCode: string };
    const ip = req.ip;
    const data = await verificationService.sendOtp(user.id, body.countryCode, body.phoneNumber, ip);
    res.status(201).json({ success: true, data });
  }),
);

verificationRouter.post(
  '/verification/phone/resend-otp',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    const ip = req.ip;
    const data = await verificationService.resendOtp(user.id, ip);
    res.status(201).json({ success: true, data });
  }),
);

verificationRouter.post(
  '/verification/phone/verify-otp',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    const body = req.body as { otp: string };
    const data = await verificationService.verifyOtp(user.id, body.otp);
    res.status(201).json({ success: true, data });
  }),
);

verificationRouter.get(
  '/verification/phone/status',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    const data = await verificationService.getPhoneVerificationStatus(user.id);
    res.json({ success: true, data });
  }),
);

verificationRouter.post(
  '/verification/phone/verify-widget-token',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    const body = req.body as { token: string };
    if (!body?.token) {
      res.status(201).json({ success: false, message: 'token is required.' });
      return;
    }
    const data = await verificationService.verifyWidgetToken(user.id, body.token);
    res.status(201).json({ success: true, data });
  }),
);
