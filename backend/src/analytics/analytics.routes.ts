import { Router } from 'express';
import { asyncHandler } from '../common/async-handler';
import { requireAuth } from '../auth/require-auth';
import { requireRoles } from '../auth/require-roles';
import { Role } from '../database/schemas/user.schema';
import { analyticsService } from './analytics.service';

export const analyticsRouter = Router();


analyticsRouter.get(
  '/analytics/dashboard',
  requireAuth,
  requireRoles(Role.ADMIN, Role.ALUMNI_OFFICER, Role.PLACEMENT_OFFICER),
  asyncHandler(async (req, res) => {
    const metrics = await analyticsService.getAdminDashboardMetrics();
    res.json({ success: true, data: metrics });
  }),
);
