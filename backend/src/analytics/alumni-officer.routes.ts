import { Router } from 'express';
import { asyncHandler } from '../common/async-handler';
import { requireAuth } from '../auth/require-auth';
import { requireRoles } from '../auth/require-roles';
import { Role } from '../database/schemas/user.schema';
import { VerificationStatus } from '../database/schemas/mentor-profile.schema';
import { AlumniVerificationModel, MentorProfileModel } from '../database/models';
import { analyticsService } from './analytics.service';

export const alumniOfficerRouter = Router();


alumniOfficerRouter.get(
  '/alumni-officer/dashboard',
  requireAuth,

  requireRoles(Role.ALUMNI_OFFICER, Role.ADMIN),
  asyncHandler(async (req, res) => {

  const data = await analyticsService.getAlumniOfficerDashboard();
  return res.json({ success: true, data });
  }),
);
  /**
   * Paginated & searchable alumni verifications.
   * Sensitive fields (registration numbers, document URLs) are never returned.
   */
alumniOfficerRouter.get(
  '/alumni-officer/verifications',
  requireAuth,

  requireRoles(Role.ALUMNI_OFFICER, Role.ADMIN),
  asyncHandler(async (req, res) => {
    const page = (req.query.page as string) || '1';
    const limit = (req.query.limit as string) || '10';
    const status = req.query.status as string | undefined;
    const q = req.query.q as string | undefined;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));

  const validStatuses = Object.values(VerificationStatus);
  const statusFilter = status && validStatuses.includes(status as VerificationStatus) ? status : undefined;

  const mentorProfiles = MentorProfileModel.collection.name;
  const users = AlumniVerificationModel.db.model('User').collection.name;

  const pipeline: any[] = [
    {
      $lookup: {
        from: mentorProfiles,
        localField: 'mentorProfileId',
        foreignField: '_id',
        as: 'mp',
      },
    },
    { $unwind: { path: '$mp', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: users,
        localField: 'mp.userId',
        foreignField: '_id',
        as: 'u',
      },
    },
    { $unwind: { path: '$u', preserveNullAndEmptyArrays: true } },
  ];

  if (statusFilter) {
    pipeline.push({ $match: { status: statusFilter } });
  }

  if (q && q.trim()) {
    const rx = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    pipeline.push({
      $match: {
        $or: [
          { 'u.firstName': rx },
          { 'u.lastName': rx },
          { 'u.email': rx },
          { 'mp.currentCompany': rx },
          { 'mp.currentDesignation': rx },
        ],
      },
    });
  }

  pipeline.push({ $sort: { createdAt: -1 } });

  const [result] = await AlumniVerificationModel.aggregate([
    ...pipeline,
    {
      $facet: {
        items: [
          { $skip: (pageNum - 1) * limitNum },
          { $limit: limitNum },
          {
            $project: {
              _id: 1,
              status: 1,
              createdAt: 1,
              updatedAt: 1,
              mentorName: {
                $trim: { input: { $concat: ['$u.firstName', ' ', '$u.lastName'] } },
              },
              email: '$u.email',
              company: { $ifNull: ['$mp.currentCompany', '—'] },
              designation: { $ifNull: ['$mp.currentDesignation', '—'] },
              programme: { $ifNull: ['$mp.programme', '—'] },
              graduationYear: '$mp.graduationYear',
            },
          },
        ],
        total: [{ $count: 'count' }],
      },
    },
  ]);

  // Status breakdown counts for filter tabs
  const statusCounts = await AlumniVerificationModel.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);
  const countsByStatus: Record<string, number> = {};
  for (const row of statusCounts) countsByStatus[row._id] = row.count;

  return res.json({
    success: true,
    data: result.items.map((i: any) => ({ ...i, id: i._id.toString(), _id: undefined })),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total: result.total[0]?.count ?? 0,
      totalPages: Math.ceil((result.total[0]?.count ?? 0) / limitNum),
    },
    statusCounts: countsByStatus,
  });
  }),
);
  /** Paginated & searchable verified alumni mentors. */
alumniOfficerRouter.get(
  '/alumni-officer/mentors',
  requireAuth,

  requireRoles(Role.ALUMNI_OFFICER, Role.ADMIN),
  asyncHandler(async (req, res) => {
    const page = (req.query.page as string) || '1';
    const limit = (req.query.limit as string) || '10';
    const q = req.query.q as string | undefined;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));

  const users = MentorProfileModel.db.model('User').collection.name;

  const matchStage: any[] = [];
  if (q && q.trim()) {
    const rx = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    matchStage.push({
      $match: {
        $or: [
          { 'u.firstName': rx },
          { 'u.lastName': rx },
          { 'u.email': rx },
          { '$mp.currentCompany': rx },
          { currentCompany: rx },
          { industry: rx },
          { currentDesignation: rx },
        ],
      },
    });
  }

  const [result] = await MentorProfileModel.aggregate([
    {
      $lookup: {
        from: users,
        localField: 'userId',
        foreignField: '_id',
        as: 'u',
      },
    },
    { $unwind: { path: '$u', preserveNullAndEmptyArrays: true } },
    ...matchStage,
    { $sort: { createdAt: -1 } },
    {
      $facet: {
        items: [
          { $skip: (pageNum - 1) * limitNum },
          { $limit: limitNum },
          {
            $project: {
              _id: 1,
              mentorName: {
                $trim: { input: { $concat: ['$u.firstName', ' ', '$u.lastName'] } },
              },
              email: '$u.email',
              currentCompany: 1,
              currentDesignation: 1,
              industry: 1,
              yearsOfExperience: 1,
              verificationStatus: 1,
              acceptingMentees: 1,
              maxCapacity: 1,
              currentMenteesCount: 1,
              graduationYear: 1,
              createdAt: 1,
            },
          },
        ],
        total: [{ $count: 'count' }],
      },
    },
  ]);

  return res.json({
    success: true,
    data: result.items.map((i: any) => ({ ...i, id: i._id.toString() })),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total: result.total[0]?.count ?? 0,
      totalPages: Math.ceil((result.total[0]?.count ?? 0) / limitNum),
    },
  });
  }),
);
