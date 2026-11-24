import { Router } from 'express';
import { asyncHandler } from '../common/async-handler';
import { requireAuth } from '../auth/require-auth';
import { validateBody } from '../middleware/validate';
import { validateObjectIdParam } from '../middleware/validate-object-id';
import { goalsService } from './goals.service';
import { CreateGoalDto } from './dto/create-goal.dto';

export const goalsRouter = Router();


goalsRouter.get(
  '/mentorships/:id/goals',
  requireAuth,
  validateObjectIdParam('id', 'mentorship'),
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    const list = await goalsService.findGoalsForMentorship((req.params.id as string), user.id);
    res.json({ success: true, data: list });
  }),
);

goalsRouter.post(
  '/mentorships/:id/goals',
  requireAuth,
  validateObjectIdParam('id', 'mentorship'),
  validateBody(CreateGoalDto),
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    const goal = await goalsService.createGoal((req.params.id as string), user.id, req.body);
    res.status(201).json({ success: true, data: goal });
  }),
);

goalsRouter.patch(
  '/goals/:id',
  requireAuth,
  validateObjectIdParam('id', 'goal'),
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    const updated = await goalsService.updateGoal((req.params.id as string), user.id, req.body);
    res.json({ success: true, data: updated });
  }),
);

goalsRouter.delete(
  '/goals/:id',
  requireAuth,
  validateObjectIdParam('id', 'goal'),
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    const result = await goalsService.deleteGoal((req.params.id as string), user.id);
    res.json(result);
  }),
);
