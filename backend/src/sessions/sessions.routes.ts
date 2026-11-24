import { Router } from 'express';
import { asyncHandler } from '../common/async-handler';
import { requireAuth } from '../auth/require-auth';
import { validateBody } from '../middleware/validate';
import { validateObjectIdParam } from '../middleware/validate-object-id';
import { sessionsService } from './sessions.service';
import { CreateSessionDto } from './dto/create-session.dto';

export const sessionsRouter = Router();


sessionsRouter.get(
  '/mentorships/:id/sessions',
  requireAuth,
  validateObjectIdParam('id', 'mentorship'),
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    const list = await sessionsService.findSessionsForMentorship((req.params.id as string), user.id);
    res.json({ success: true, data: list });
  }),
);

sessionsRouter.post(
  '/mentorships/:id/sessions',
  requireAuth,
  validateObjectIdParam('id', 'mentorship'),
  validateBody(CreateSessionDto),
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    const session = await sessionsService.createSession((req.params.id as string), user.id, req.body);
    res.status(201).json({ success: true, data: session });
  }),
);

sessionsRouter.patch(
  '/sessions/:id',
  requireAuth,
  validateObjectIdParam('id', 'session'),
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    const updated = await sessionsService.updateSession((req.params.id as string), user.id, req.body);
    res.json({ success: true, data: updated });
  }),
);

// (2026-11-20, workspace slice Item 3) Mentor decision on a student's
// schedule request. The service enforces mentor-only + REQUESTED-only;
// the routes carry no body.
sessionsRouter.post(
  '/sessions/:id/approve',
  requireAuth,
  validateObjectIdParam('id', 'session'),
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    const approved = await sessionsService.approveSession((req.params.id as string), user.id);
    res.json({ success: true, data: approved });
  }),
);

sessionsRouter.post(
  '/sessions/:id/decline',
  requireAuth,
  validateObjectIdParam('id', 'session'),
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    const declined = await sessionsService.declineSession((req.params.id as string), user.id);
    res.json({ success: true, data: declined });
  }),
);

sessionsRouter.delete(
  '/sessions/:id',
  requireAuth,
  validateObjectIdParam('id', 'session'),
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    const cancelled = await sessionsService.cancelSession((req.params.id as string), user.id);
    res.json({ success: true, data: cancelled });
  }),
);
