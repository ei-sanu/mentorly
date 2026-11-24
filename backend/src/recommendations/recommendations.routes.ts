import { Router } from 'express';
import { asyncHandler } from '../common/async-handler';
import { requireAuth } from '../auth/require-auth';
import { validateObjectIdParam } from '../middleware/validate-object-id';
import { recommendationsService } from './recommendations.service';

export const recommendationsRouter = Router();


recommendationsRouter.get(
  '/recommendations/mentors',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    const list = await recommendationsService.getRecommendedMentors(user.id);
    res.json({ success: true, data: list });
  }),
);

recommendationsRouter.get(
  '/recommendations/mentors/:id',
  requireAuth,
  validateObjectIdParam('id', 'mentor'),
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    const details = await recommendationsService.getMentorMatchDetails(user.id, (req.params.id as string));
    res.json({ success: true, data: details });
  }),
);

recommendationsRouter.post(
  '/recommendations/recalculate',
  requireAuth,
  asyncHandler(async (req, res) => {
    await recommendationsService.invalidateAllCaches();
    res.status(201).json({ success: true, message: 'Recommendations cache invalidated.' });
  }),
);
