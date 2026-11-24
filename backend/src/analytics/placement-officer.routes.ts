import { Router } from 'express';
import { Types } from 'mongoose';
import { asyncHandler } from '../common/async-handler';
import { requireAuth } from '../auth/require-auth';
import { requireRoles } from '../auth/require-roles';
import { validateObjectIdParam } from '../middleware/validate-object-id';
import { Role } from '../database/schemas/user.schema';
import { globalEventBus } from '../common/event-bus';
import {
  UserModel,
  StudentProfileModel,
  OpportunityModel,
  PlacementApplicationModel,
} from '../database/models';
import { analyticsService } from './analytics.service';

export const placementOfficerRouter = Router();


placementOfficerRouter.get(
  '/placement-officer/dashboard',
  requireAuth,

  requireRoles(Role.PLACEMENT_OFFICER, Role.ADMIN),
  asyncHandler(async (req, res) => {

  const data = await analyticsService.getPlacementOfficerDashboard();
  return res.json({ success: true, data });
  }),
);
  /**
   * Paginated & searchable student career profiles.
   * Contact details (phone, registration numbers) are never returned.
   */
  /**
   * Paginated & searchable student list.
   * Lists every user with role=STUDENT (including those who haven't created
   * a StudentProfile yet) so the directory reflects the full student body.
   * StudentProfile data is joined in via $lookup; missing profiles are
   * returned as null so the frontend can show a "no profile yet" state.
   */
placementOfficerRouter.get(
  '/placement-officer/students',
  requireAuth,

  requireRoles(Role.PLACEMENT_OFFICER, Role.ADMIN),
  asyncHandler(async (req, res) => {
    const page = (req.query.page as string) || '1';
    const limit = (req.query.limit as string) || '10';
    const q = req.query.q as string | undefined;
    const industry = req.query.industry as string | undefined;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));

  const profileCollection = StudentProfileModel.collection.name;

  const baseMatch: any = { role: Role.STUDENT };

  const postMatch: any[] = [];
  if (industry && industry.trim()) {
    postMatch.push({ $match: { 'sp.targetIndustry': industry.trim() } });
  }
  if (q && q.trim()) {
    const rx = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    baseMatch.$or = [
      { firstName: rx },
      { lastName: rx },
      { email: rx },
    ];
    postMatch.push({
      $match: {
        $or: [
          { 'sp.targetRole': rx },
          { 'sp.targetIndustry': rx },
          { 'sp.currentSkills': rx },
          { 'sp.programme': rx },
          { 'sp.school': rx },
        ],
      },
    });
  }

  const [result] = await UserModel.aggregate([
    { $match: baseMatch },
    { $sort: { createdAt: -1 } },
    {
      $lookup: {
        from: profileCollection,
        localField: '_id',
        foreignField: 'userId',
        as: 'sp',
      },
    },
    { $unwind: { path: '$sp', preserveNullAndEmptyArrays: true } },
    ...postMatch,
    {
      $facet: {
        items: [
          { $skip: (pageNum - 1) * limitNum },
          {
            $addFields: {
              profileCompletion: {
                $add: [
                  { $cond: [{ $and: [{ $ne: ['$firstName', null] }, { $ne: ['$firstName', ''] }, { $ne: ['$lastName', null] }, { $ne: ['$lastName', ''] }, { $ne: ['$phone', null] }, { $ne: ['$phone', ''] }] }, 20, 0] },
                  { $cond: [{ $and: [{ $ne: ['$sp.programme', null] }, { $ne: ['$sp.programme', ''] }, { $ne: ['$sp.school', null] }, { $ne: ['$sp.school', ''] }, { $gt: ['$sp.yearOfStudy', null] }] }, 25, 0] },
                  { $cond: [{ $and: [{ $gt: [{ $size: { $ifNull: ['$sp.currentSkills', []] } }, 0] }, { $ne: ['$sp.targetRole', null] }, { $ne: ['$sp.targetRole', ''] }] }, 20, 0] },
                  { $cond: [{ $and: [{ $ne: ['$sp.preferredFrequency', null] }, { $ne: ['$sp.preferredFrequency', ''] }, { $ne: ['$sp.mentoringNeeds', null] }, { $ne: ['$sp.mentoringNeeds', ''] }] }, 20, 0] },
                  { $cond: [{ $in: ['$onboardingStatus', ['APPROVED', 'SUBMITTED', 'UNDER_REVIEW']] }, 15, 0] },
                ],
              },
            },
          },
          { $limit: limitNum },
          {
            $project: {
              _id: 1,
              userId: '$_id',
              studentName: { $trim: { input: { $concat: ['$firstName', ' ', '$lastName'] } } },
              email: '$email',
              phone: '$phone',
              firstName: '$firstName',
              lastName: '$lastName',
              userCreatedAt: '$createdAt',
              userOnboardingStatus: '$onboardingStatus',
              userVerificationStatus: '$verificationStatus',
              hasProfile: { $cond: [{ $ifNull: ['$sp._id', false] }, true, false] },
              profileId: '$sp._id',
              programme: '$sp.programme',
              school: '$sp.school',
              yearOfStudy: '$sp.yearOfStudy',
              graduationYear: '$sp.graduationYear',
              currentSkills: '$sp.currentSkills',
              targetRole: '$sp.targetRole',
              targetIndustry: '$sp.targetIndustry',
              careerGoals: '$sp.careerGoals',
              interests: '$sp.interests',
              mentoringNeeds: '$sp.mentoringNeeds',
              preferredFrequency: '$sp.preferredFrequency',
              profileCompletion: 1,
              profileCreatedAt: '$sp.createdAt',
            },
          },
        ],
        total: [{ $count: 'count' }],
      },
    },
  ]);

  // Industry filter options derived from real student data
  const industries = await StudentProfileModel.aggregate([
    { $match: { targetIndustry: { $ne: '' } } },
    { $group: { _id: '$targetIndustry', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 15 },
  ]);

  return res.json({
    success: true,
    data: result.items.map((i: any) => ({
      ...i,
      id: (i.profileId || i._id).toString(),
      userId: i.userId.toString(),
      profileId: i.profileId?.toString(),
    })),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total: result.total[0]?.count ?? 0,
      totalPages: Math.ceil((result.total[0]?.count ?? 0) / limitNum),
    },
    industryFilters: industries.map((i) => ({ industry: i._id, count: i.count })),
  });
  }),
);
placementOfficerRouter.get(
  '/placement-officer/opportunities',
  requireAuth,

  requireRoles(Role.PLACEMENT_OFFICER, Role.ADMIN),
  asyncHandler(async (req, res) => {
    const page = (req.query.page as string) || '1';
    const limit = (req.query.limit as string) || '10';
    const status = req.query.status as string | undefined;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));

  const filter: Record<string, any> = {};
  if (status) {
    filter.status = status;
  }

  const [items, total] = await Promise.all([
    OpportunityModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean(),
    OpportunityModel.countDocuments(filter),
  ]);

  return res.json({
    success: true,
    data: items.map((i: any) => ({ ...i, id: i._id.toString() })),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  });
  }),
);
placementOfficerRouter.post(
  '/placement-officer/opportunities',
  requireAuth,

  requireRoles(Role.PLACEMENT_OFFICER, Role.ADMIN),
  asyncHandler(async (req, res) => {
    const body = req.body;

  const opp = new OpportunityModel(body);
  await opp.save();
  globalEventBus.emit('dashboard_update', { type: 'OPPORTUNITY_CREATED' });
  return res.status(201).json({ success: true, data: opp });
  }),
);
placementOfficerRouter.get(
  '/placement-officer/applications',
  requireAuth,

  requireRoles(Role.PLACEMENT_OFFICER, Role.ADMIN),
  asyncHandler(async (req, res) => {
    const page = (req.query.page as string) || '1';
    const limit = (req.query.limit as string) || '10';

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));

  const pipeline: any[] = [
    {
      $lookup: {
        from: 'users',
        localField: 'studentId',
        foreignField: '_id',
        as: 'student',
      },
    },
    { $unwind: '$student' },
    {
      $lookup: {
        from: 'opportunities',
        localField: 'opportunityId',
        foreignField: '_id',
        as: 'opportunity',
      },
    },
    { $unwind: '$opportunity' },
    { $sort: { createdAt: -1 } },
    {
      $facet: {
        items: [
          { $skip: (pageNum - 1) * limitNum },
          { $limit: limitNum },
          {
            $project: {
              _id: 1,
              status: 1,
              interviewDate: 1,
              notes: 1,
              createdAt: 1,
              studentName: { $concat: ['$student.firstName', ' ', '$student.lastName'] },
              studentEmail: '$student.email',
              opportunityTitle: '$opportunity.title',
              opportunityCompany: '$opportunity.company',
            },
          },
        ],
        total: [{ $count: 'count' }],
      },
    },
  ];

  const [result] = await PlacementApplicationModel.aggregate(pipeline);

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
placementOfficerRouter.patch(
  '/placement-officer/applications/:id',
  requireAuth,

  requireRoles(Role.PLACEMENT_OFFICER, Role.ADMIN),
  validateObjectIdParam('id', 'application'),
  asyncHandler(async (req, res) => {
    const id = (req.params.id as string);
    const body = req.body;

  const updated = await PlacementApplicationModel.findByIdAndUpdate(
    id,
    { $set: body },
    { new: true }
  );
  globalEventBus.emit('dashboard_update', { type: 'APPLICATION_UPDATED' });
  return res.json({ success: true, data: updated });
  }),
);
placementOfficerRouter.get(
  '/placement-officer/students/:id',
  requireAuth,

  requireRoles(Role.PLACEMENT_OFFICER, Role.ADMIN),
  asyncHandler(async (req, res) => {
    const id = (req.params.id as string);

  const userCollection = UserModel.collection.name;
  const profileCollection = StudentProfileModel.collection.name;

  // The directory may pass either a profileId (for students with profiles)
  // or a userId (for students who registered but never completed onboarding).
  // Try to resolve it as a profile first; if none, try as a user.
  const isObjectId = Types.ObjectId.isValid(id);
  if (!isObjectId) {
    return res.json({ success: false, message: 'Student profile not found.' });
  }
  const objectId = new Types.ObjectId(id);

  // First try: it's a StudentProfile _id
  const [profileHit] = await StudentProfileModel.aggregate([
    { $match: { _id: objectId } },
    {
      $lookup: { from: userCollection, localField: 'userId', foreignField: '_id', as: 'u' },
    },
    { $unwind: '$u' },
    {
      $addFields: {
        profileCompletion: {
          $add: [
            { $cond: [{ $and: [{ $ne: ['$u.firstName', null] }, { $ne: ['$u.firstName', ''] }, { $ne: ['$u.lastName', null] }, { $ne: ['$u.lastName', ''] }, { $ne: ['$u.phone', null] }, { $ne: ['$u.phone', ''] }] }, 20, 0] },
            { $cond: [{ $and: [{ $ne: ['$programme', null] }, { $ne: ['$programme', ''] }, { $ne: ['$school', null] }, { $ne: ['$school', ''] }, { $gt: ['$yearOfStudy', null] }] }, 25, 0] },
            { $cond: [{ $and: [{ $gt: [{ $size: { $ifNull: ['$currentSkills', []] } }, 0] }, { $ne: ['$targetRole', null] }, { $ne: ['$targetRole', ''] }] }, 20, 0] },
            { $cond: [{ $and: [{ $ne: ['$preferredFrequency', null] }, { $ne: ['$preferredFrequency', ''] }, { $ne: ['$mentoringNeeds', null] }, { $ne: ['$mentoringNeeds', ''] }] }, 20, 0] },
            { $cond: [{ $in: ['$u.onboardingStatus', ['APPROVED', 'SUBMITTED', 'UNDER_REVIEW']] }, 15, 0] },
          ],
        },
      },
    },
    {
      $project: {
        _id: 1,
        userId: '$u._id',
        studentName: { $concat: ['$u.firstName', ' ', '$u.lastName'] },
        email: '$u.email',
        phone: '$u.phone',
        firstName: '$u.firstName',
        lastName: '$u.lastName',
        userOnboardingStatus: '$u.onboardingStatus',
        userVerificationStatus: '$u.verificationStatus',
        userCreatedAt: '$u.createdAt',
        hasProfile: { $literal: true },
        programme: 1,
        school: 1,
        yearOfStudy: 1,
        graduationYear: 1,
        currentSkills: 1,
        targetRole: 1,
        targetIndustry: 1,
        careerGoals: 1,
        interests: 1,
        mentoringNeeds: 1,
        preferredFrequency: 1,
        profileCompletion: 1,
        profileCreatedAt: '$createdAt',
        profileUpdatedAt: '$updatedAt',
      },
    },
  ]);

  if (profileHit) {
    return res.json({ success: true, data: { ...profileHit, id: profileHit._id.toString() } });
  }

  // Second try: it's a User _id with role=STUDENT
  const [userHit] = await UserModel.aggregate([
    { $match: { _id: objectId, role: Role.STUDENT } },
    {
      $lookup: { from: profileCollection, localField: '_id', foreignField: 'userId', as: 'sp' },
    },
    { $unwind: { path: '$sp', preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        profileCompletion: {
          $add: [
            { $cond: [{ $and: [{ $ne: ['$firstName', null] }, { $ne: ['$firstName', ''] }, { $ne: ['$lastName', null] }, { $ne: ['$lastName', ''] }, { $ne: ['$phone', null] }, { $ne: ['$phone', ''] }] }, 20, 0] },
            { $cond: [{ $and: [{ $ne: ['$sp.programme', null] }, { $ne: ['$sp.programme', ''] }, { $ne: ['$sp.school', null] }, { $ne: ['$sp.school', ''] }, { $gt: ['$sp.yearOfStudy', null] }] }, 25, 0] },
            { $cond: [{ $and: [{ $gt: [{ $size: { $ifNull: ['$sp.currentSkills', []] } }, 0] }, { $ne: ['$sp.targetRole', null] }, { $ne: ['$sp.targetRole', ''] }] }, 20, 0] },
            { $cond: [{ $and: [{ $ne: ['$sp.preferredFrequency', null] }, { $ne: ['$sp.preferredFrequency', ''] }, { $ne: ['$sp.mentoringNeeds', null] }, { $ne: ['$sp.mentoringNeeds', ''] }] }, 20, 0] },
            { $cond: [{ $in: ['$onboardingStatus', ['APPROVED', 'SUBMITTED', 'UNDER_REVIEW']] }, 15, 0] },
          ],
        },
      },
    },
    {
      $project: {
        _id: 1,
        userId: '$_id',
        studentName: { $trim: { input: { $concat: ['$firstName', ' ', '$lastName'] } } },
        email: '$email',
        phone: '$phone',
        firstName: '$firstName',
        lastName: '$lastName',
        userOnboardingStatus: '$onboardingStatus',
        userVerificationStatus: '$verificationStatus',
        userCreatedAt: '$createdAt',
        hasProfile: { $cond: [{ $ifNull: ['$sp._id', false] }, true, false] },
        programme: '$sp.programme',
        school: '$sp.school',
        yearOfStudy: '$sp.yearOfStudy',
        graduationYear: '$sp.graduationYear',
        currentSkills: '$sp.currentSkills',
        targetRole: '$sp.targetRole',
        targetIndustry: '$sp.targetIndustry',
        careerGoals: '$sp.careerGoals',
        interests: '$sp.interests',
        mentoringNeeds: '$sp.mentoringNeeds',
        preferredFrequency: '$sp.preferredFrequency',
        profileCompletion: 1,
        profileCreatedAt: '$sp.createdAt',
      },
    },
  ]);

  if (!userHit) {
    return res.json({ success: false, message: 'Student not found.' });
  }

  return res.json({ success: true, data: { ...userHit, id: userHit._id.toString() } });
  }),
);
