import { Router } from 'express';
import { asyncHandler } from '../common/async-handler';
import { requireAuth } from '../auth/require-auth';
import { validateBody } from '../middleware/validate';
import { validateObjectIdParam } from '../middleware/validate-object-id';
import { requestsService } from './requests.service';
import { CreateRequestDto } from './dto/create-request.dto';

export const requestsRouter = Router();


requestsRouter.post(
  '/requests',
  requireAuth,
  validateBody(CreateRequestDto),
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    const request = await requestsService.create(user.id, req.body);
    res.status(201).json({ success: true, data: request });
  }),
);

requestsRouter.get(
  '/requests',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    const list = await requestsService.findAll(user.id, user.role);
    res.json({ success: true, data: list });
  }),
);

requestsRouter.get(
  '/requests/:id',
  requireAuth,
  validateObjectIdParam('id', 'request'),
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    const request = await requestsService.findOne((req.params.id as string), user.id);
    res.json({ success: true, data: request });
  }),
);

requestsRouter.post(
  '/requests/:id/accept',
  requireAuth,
  validateObjectIdParam('id', 'request'),
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    const mentorship = await requestsService.accept((req.params.id as string), user.id);
    res.status(201).json({ success: true, data: mentorship });
  }),
);

requestsRouter.post(
  '/requests/:id/decline',
  requireAuth,
  validateObjectIdParam('id', 'request'),
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    const declined = await requestsService.decline((req.params.id as string), user.id);
    res.status(201).json({ success: true, data: declined });
  }),
);

requestsRouter.post(
  '/requests/:id/cancel',
  requireAuth,
  validateObjectIdParam('id', 'request'),
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    const cancelled = await requestsService.cancel((req.params.id as string), user.id);
    res.status(201).json({ success: true, data: cancelled });
  }),
);
