import { Router } from 'express';
import { asyncHandler } from '../common/async-handler';
import { requireAuth } from '../auth/require-auth';
import { validateBody } from '../middleware/validate';
import { usersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';

export const usersRouter = Router();


usersRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    const freshUser = await usersService.findOne(user.id);
    res.json({ success: true, data: freshUser });
  }),
);

usersRouter.patch(
  '/me',
  requireAuth,
  validateBody(UpdateUserDto),
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    const updated = await usersService.update(user.id, req.body);
    res.json({ success: true, data: updated });
  }),
);

usersRouter.get(
  '/me/profile',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    const profile = await usersService.getUserProfile(user);
    res.json({ success: true, data: profile });
  }),
);

usersRouter.post(
  '/me/onboard',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    const result = await usersService.submitOnboarding(user.id, req.body);
    res.status(201).json(result);
  }),
);
