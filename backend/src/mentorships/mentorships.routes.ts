import { Router } from 'express';
import { asyncHandler } from '../common/async-handler';
import { requireAuth } from '../auth/require-auth';
import { validateObjectIdParam } from '../middleware/validate-object-id';
import { mentorshipsService } from './mentorships.service';

export const mentorshipsRouter = Router();


mentorshipsRouter.get(
  '/mentorships',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    const list = await mentorshipsService.findAll(user.id, user.role);
    res.json({ success: true, data: list });
  }),
);

mentorshipsRouter.get(
  '/mentorships/:id',
  requireAuth,
  validateObjectIdParam('id', 'mentorship'),
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    const mentorship = await mentorshipsService.findOne((req.params.id as string), user.id);
    res.json({ success: true, data: mentorship });
  }),
);

mentorshipsRouter.patch(
  '/mentorships/:id',
  requireAuth,
  validateObjectIdParam('id', 'mentorship'),
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    const status = req.body?.status;
    const updated = await mentorshipsService.updateStatus((req.params.id as string), user.id, status);
    res.json({ success: true, data: updated });
  }),
);
