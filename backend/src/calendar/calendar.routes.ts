import { Router } from 'express';
import { asyncHandler } from '../common/async-handler';
import { requireAuth } from '../auth/require-auth';
import { calendarService } from './calendar.service';

export const calendarRouter = Router();


calendarRouter.get(
  '/calendar/google/callback',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    const code = req.query.code as string;
    const result = await calendarService.saveGoogleCredentials(user.id, code);
    res.json(result);
  }),
);

calendarRouter.post(
  '/calendar/disconnect',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    const result = await calendarService.disconnect(user.id);
    res.status(201).json(result);
  }),
);
