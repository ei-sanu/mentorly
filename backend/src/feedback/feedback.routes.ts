import { Router } from 'express';
import { asyncHandler } from '../common/async-handler';
import { requireAuth } from '../auth/require-auth';
import { validateBody } from '../middleware/validate';
import { validateObjectIdParam } from '../middleware/validate-object-id';
import { feedbackService } from './feedback.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';

export const feedbackRouter = Router();


feedbackRouter.post(
  '/mentorships/:id/feedback',
  requireAuth,
  validateObjectIdParam('id', 'mentorship'),
  validateBody(CreateFeedbackDto),
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    const feedback = await feedbackService.createFeedback((req.params.id as string), user.id, req.body);
    res.status(201).json({ success: true, data: feedback });
  }),
);

feedbackRouter.get(
  '/mentorships/:id/feedback',
  requireAuth,
  validateObjectIdParam('id', 'mentorship'),
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    const list = await feedbackService.getFeedback((req.params.id as string), user.id);
    res.json({ success: true, data: list });
  }),
);
