import { Router } from 'express';
import { asyncHandler } from '../common/async-handler';
import { requireAuth } from '../auth/require-auth';
import { validateBody } from '../middleware/validate';
import { studentsService } from './students.service';
import { UpdateStudentProfileDto } from './dto/update-student-profile.dto';
import { UpdateStudentCareerDto } from './dto/update-student-career.dto';

export const studentsRouter = Router();


studentsRouter.get(
  '/students/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    const profile = await studentsService.getProfileByUserId(user.id);
    res.json({ success: true, data: profile });
  }),
);

studentsRouter.patch(
  '/students/me',
  requireAuth,
  validateBody(UpdateStudentProfileDto),
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    const updated = await studentsService.updateProfile(user.id, req.body);
    res.json({ success: true, data: updated });
  }),
);

studentsRouter.patch(
  '/students/me/career',
  requireAuth,
  validateBody(UpdateStudentCareerDto),
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    const updated = await studentsService.updateCareer(user.id, req.body);
    res.json({ success: true, data: updated });
  }),
);
