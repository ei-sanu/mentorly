import { Router } from 'express';
import { asyncHandler } from '../common/async-handler';
import { requireAuth } from '../auth/require-auth';
import { validateBody, validateQuery } from '../middleware/validate';
import { validateObjectIdParam } from '../middleware/validate-object-id';
import { mentorsService } from './mentors.service';
import { MentorQueryDto } from './dto/mentor-query.dto';
import { UpdateMentorProfileDto } from './dto/update-mentor-profile.dto';
import { CreateAvailabilityDto } from './dto/create-availability.dto';
import { CreateLeaveDto } from './dto/create-leave.dto';

export const mentorsRouter = Router();


mentorsRouter.get(
  '/mentors',
  requireAuth,
  validateQuery(MentorQueryDto),
  asyncHandler(async (req, res) => {
    const result = await mentorsService.findMany((req as any).queryDto);
    res.json(result);
  }),
);

mentorsRouter.get(
  '/mentors/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    const profile = await mentorsService.getProfileByUserId(user.id);
    res.json({ success: true, data: profile });
  }),
);

mentorsRouter.patch(
  '/mentors/me',
  requireAuth,
  validateBody(UpdateMentorProfileDto),
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    const updated = await mentorsService.updateProfile(user.id, req.body);
    res.json({ success: true, data: updated });
  }),
);

// (Item 5, 2026-11-20) Availability + leave — all under /mentors/me,
// resolved from auth. These MUST be registered before '/mentors/:id'
// below: Express matches in order, and ':id' would otherwise swallow
// 'me' on the three-segment paths ('/mentors/me/availability' vs
// '/mentors/:id/availability').
mentorsRouter.get(
  '/mentors/me/availability',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    const availability = await mentorsService.getMyAvailability(user.id);
    res.json({ success: true, data: availability });
  }),
);

mentorsRouter.post(
  '/mentors/me/availability',
  requireAuth,
  validateBody(CreateAvailabilityDto),
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    const created = await mentorsService.addAvailability(user.id, req.body);
    res.status(201).json({ success: true, data: created });
  }),
);

mentorsRouter.delete(
  '/mentors/me/availability/:slotId',
  requireAuth,
  validateObjectIdParam('slotId', 'availability slot'),
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    const result = await mentorsService.deleteAvailability(user.id, (req.params.slotId as string));
    res.json({ success: true, data: result });
  }),
);

mentorsRouter.get(
  '/mentors/me/leaves',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    const leaves = await mentorsService.getMyLeaves(user.id);
    res.json({ success: true, data: leaves });
  }),
);

mentorsRouter.post(
  '/mentors/me/leaves',
  requireAuth,
  validateBody(CreateLeaveDto),
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    const created = await mentorsService.addLeave(user.id, req.body);
    res.status(201).json({ success: true, data: created });
  }),
);

mentorsRouter.delete(
  '/mentors/me/leaves/:leaveId',
  requireAuth,
  validateObjectIdParam('leaveId', 'leave'),
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    const result = await mentorsService.deleteLeave(user.id, (req.params.leaveId as string));
    res.json({ success: true, data: result });
  }),
);

mentorsRouter.get(
  '/mentors/:id',
  requireAuth,
  validateObjectIdParam('id', 'mentor'),
  asyncHandler(async (req, res) => {
    const mentor = await mentorsService.findOne((req.params.id as string));
    res.json({ success: true, data: mentor });
  }),
);

mentorsRouter.get(
  '/mentors/:id/availability',
  requireAuth,
  validateObjectIdParam('id', 'mentor'),
  asyncHandler(async (req, res) => {
    const availability = await mentorsService.getAvailability((req.params.id as string));
    res.json({ success: true, data: availability });
  }),
);

// (Item 5, 2026-11-20) Public upcoming leaves for a mentor — the
// student-facing read. Registered after the /mentors/me/leaves route
// above, so '/mentors/me/leaves' is never caught by ':id'.
mentorsRouter.get(
  '/mentors/:id/leaves',
  requireAuth,
  validateObjectIdParam('id', 'mentor'),
  asyncHandler(async (req, res) => {
    const leaves = await mentorsService.getLeavesByMentorId((req.params.id as string));
    res.json({ success: true, data: leaves });
  }),
);
