import { Router } from 'express';
import { asyncHandler } from '../common/async-handler';
import { BadRequestException } from '../common/errors';
import { requireAuth } from '../auth/require-auth';
import { requireRoles } from '../auth/require-roles';
import { Role } from '../database/schemas/user.schema';
import {
  UserModel,
  MentorProfileModel,
  StudentProfileModel,
  AlumniVerificationModel,
  SystemConfigModel,
} from '../database/models';
import { auditService } from '../audit/audit.service';
import { analyticsService } from '../analytics/analytics.service';
import type { MatchingWeights } from '../matching/matching.service';
import { ollamaService } from '../matching/ollama.service';

const userModel = UserModel;
const mentorProfileModel = MentorProfileModel;
const studentProfileModel = StudentProfileModel;
const verificationModel = AlumniVerificationModel;
const configModel = SystemConfigModel;
const audit = auditService;
const analytics = analyticsService;

export const adminRouter = Router();


adminRouter.get(
  '/admin/dashboard',
  requireAuth,

  requireRoles(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const stats = await analytics.getAdminDashboardMetrics();
    res.json({ success: true, data: stats });
  }),
);

adminRouter.get(
  '/admin/users',
  requireAuth,

  requireRoles(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const users = await userModel.find().sort({ createdAt: -1 }).lean();
    res.json({
      success: true,
      data: users.map((u) => ({ ...u, id: u._id.toString() })),
    });
  }),
);

adminRouter.get(
  '/admin/mentors',
  requireAuth,

  requireRoles(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const mentors = await mentorProfileModel
      .find()
      .populate('userId')
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data: mentors.map((m: any) => ({
        ...m,
        id: m._id.toString(),
        user: m.userId ? { ...m.userId, id: m.userId._id?.toString() } : null,
      })),
    });
  }),
);

adminRouter.get(
  '/admin/students',
  requireAuth,

  requireRoles(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const students = await studentProfileModel
      .find()
      .populate('userId')
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data: students.map((s: any) => ({
        ...s,
        id: s._id.toString(),
        user: s.userId ? { ...s.userId, id: s.userId._id?.toString() } : null,
      })),
    });
  }),
);

adminRouter.get(
  '/admin/verification',
  requireAuth,

  requireRoles(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const verifications = await verificationModel
      .find()
      .populate({
        path: 'mentorProfileId',
        populate: { path: 'userId' },
      })
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data: verifications.map((v: any) => ({
        ...v,
        id: v._id.toString(),
        mentorProfile: v.mentorProfileId
          ? {
              ...v.mentorProfileId,
              id: v.mentorProfileId._id?.toString(),
              user: v.mentorProfileId.userId
                ? {
                    ...v.mentorProfileId.userId,
                    id: v.mentorProfileId.userId._id?.toString(),
                  }
                : null,
            }
          : null,
      })),
    });
  }),
);

adminRouter.get(
  '/admin/analytics',
  requireAuth,

  requireRoles(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const stats = await analytics.getAdminDashboardMetrics();
    res.json({ success: true, data: stats });
  }),
);

adminRouter.get(
  '/admin/matching/config',
  requireAuth,

  requireRoles(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const config = await configModel.findOne({ key: 'MATCHING_WEIGHTS' }).lean();

    if (config) {
      res.json({ success: true, data: config.value });
      return;
    }

    res.json({
      success: true,
      data: {
        semanticSimilarity: 35,
        careerGoal: 20,
        expertise: 15,
        industry: 10,
        targetRole: 10,
        availability: 10,
      },
    });
  }),
);

// LLM ranking status (Phase 3, 2026-11-19): model name, whether LLM
// ranking is enabled, and whether the Ollama server is reachable.
// Admin-only, like every other route in this router.
adminRouter.get(
  '/admin/matching/llm-status',
  requireAuth,

  requireRoles(Role.ADMIN),
  asyncHandler(async (_req, res) => {
    const config = ollamaService.getConfig();
    const reachable = await ollamaService.checkHealth();
    res.json({
      success: true,
      data: {
        model: config.model,
        baseUrl: config.baseUrl,
        enabled: config.enabled,
        reachable,
        timeoutMs: config.timeoutMs,
      },
    });
  }),
);

adminRouter.patch(
  '/admin/matching/config',
  requireAuth,

  requireRoles(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const admin = (req as any).user;
    const dto = req.body as MatchingWeights;
    const sum =
      (dto.semanticSimilarity || 0) +
      (dto.careerGoal || 0) +
      (dto.expertise || 0) +
      (dto.industry || 0) +
      (dto.targetRole || 0) +
      (dto.availability || 0);

    if (sum !== 100) {
      throw new BadRequestException(`Matching configuration weights must total exactly 100. Current total: ${sum}`);
    }

    const config = await configModel.findOneAndUpdate(
      { key: 'MATCHING_WEIGHTS' },
      { $set: { value: dto } },
      { upsert: true, new: true },
    ).lean();

    await audit.log(
      admin.id,
      'UPDATE_MATCHING_CONFIG',
      'SystemConfig',
      'MATCHING_WEIGHTS',
      dto,
    );

    res.json({ success: true, data: config.value });
  }),
);

adminRouter.get(
  '/admin/user-growth',
  requireAuth,

  requireRoles(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const days = req.query.days as string | undefined;
    const period = days ? parseInt(days, 10) : 30;
    const growth = await analytics.getUserGrowth(period);
    res.json({ success: true, data: growth });
  }),
);

adminRouter.get(
  '/admin/verification-overview',
  requireAuth,

  requireRoles(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const overview = await analytics.getVerificationOverview();
    res.json({ success: true, data: overview });
  }),
);

adminRouter.get(
  '/admin/mentorship-overview',
  requireAuth,

  requireRoles(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const overview = await analytics.getMentorshipOverview();
    res.json({ success: true, data: overview });
  }),
);

adminRouter.get(
  '/admin/mentor-utilization',
  requireAuth,

  requireRoles(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const utilization = await analytics.getMentorUtilization();
    res.json({ success: true, data: utilization });
  }),
);

adminRouter.get(
  '/admin/matching-overview',
  requireAuth,

  requireRoles(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const overview = await analytics.getMatchingOverview();
    res.json({ success: true, data: overview });
  }),
);

adminRouter.get(
  '/admin/top-skills',
  requireAuth,

  requireRoles(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const skills = await analytics.getTopSkills();
    res.json({ success: true, data: skills });
  }),
);

adminRouter.get(
  '/admin/top-industries',
  requireAuth,

  requireRoles(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const industries = await analytics.getTopIndustries();
    res.json({ success: true, data: industries });
  }),
);

adminRouter.get(
  '/admin/audit-logs',
  requireAuth,

  requireRoles(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const limit = req.query.limit as string | undefined;
    const size = limit ? parseInt(limit, 10) : 50;
    const logs = await audit.findAll(size);
    res.json({ success: true, data: logs });
  }),
);
