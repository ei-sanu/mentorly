import { Router } from 'express';
import { asyncHandler } from '../common/async-handler';
import { requireAuth } from '../auth/require-auth';
import { validateObjectIdParam } from '../middleware/validate-object-id';
import { notificationsService } from './notifications.service';

export const notificationsRouter = Router();


notificationsRouter.get(
  '/notifications',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    const list = await notificationsService.findAll(user.id);
    res.json({ success: true, data: list });
  }),
);

notificationsRouter.patch(
  '/notifications/:id/read',
  requireAuth,
  validateObjectIdParam('id', 'notification'),
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    const updated = await notificationsService.markAsRead((req.params.id as string), user.id);
    res.json({ success: true, data: updated });
  }),
);

notificationsRouter.post(
  '/notifications/read-all',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    await notificationsService.markAllAsRead(user.id);
    res.status(201).json({ success: true, message: 'All notifications marked as read' });
  }),
);
