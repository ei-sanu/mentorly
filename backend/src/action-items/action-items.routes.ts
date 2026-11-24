import { Router } from 'express';
import { asyncHandler } from '../common/async-handler';
import { requireAuth } from '../auth/require-auth';
import { validateBody } from '../middleware/validate';
import { validateObjectIdParam } from '../middleware/validate-object-id';
import { actionItemsService } from './action-items.service';
import { CreateActionItemDto } from './dto/create-action-item.dto';

export const actionItemsRouter = Router();


actionItemsRouter.get(
  '/mentorships/:id/action-items',
  requireAuth,
  validateObjectIdParam('id', 'mentorship'),
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    const list = await actionItemsService.findActionItemsForMentorship((req.params.id as string), user.id);
    res.json({ success: true, data: list });
  }),
);

actionItemsRouter.post(
  '/mentorships/:id/action-items',
  requireAuth,
  validateObjectIdParam('id', 'mentorship'),
  validateBody(CreateActionItemDto),
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    const item = await actionItemsService.createActionItem((req.params.id as string), user.id, req.body);
    res.status(201).json({ success: true, data: item });
  }),
);

actionItemsRouter.patch(
  '/action-items/:id',
  requireAuth,
  validateObjectIdParam('id', 'action item'),
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    const updated = await actionItemsService.updateActionItem((req.params.id as string), user.id, req.body);
    res.json({ success: true, data: updated });
  }),
);
