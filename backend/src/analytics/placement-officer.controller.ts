import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AnalyticsService } from '../analytics/analytics.service';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import {
  StudentProfile,
  StudentProfileDocument,
} from '../database/schemas/student-profile.schema';
import { User, UserDocument, Role } from '../database/schemas/user.schema';
import { Opportunity, OpportunityDocument, OpportunityStatus } from '../database/schemas/opportunity.schema';
import { PlacementApplication, PlacementApplicationDocument, PlacementStatus } from '../database/schemas/placement-application.schema';
import { globalEventBus } from '../common/event-bus';

@ApiTags('Placement Officer')
@ApiBearerAuth()
@UseGuards(ClerkAuthGuard, RolesGuard)
@Roles(Role.PLACEMENT_OFFICER, Role.ADMIN)
@Controller('placement-officer')
export class PlacementOfficerController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(StudentProfile.name)
    private readonly studentProfileModel: Model<StudentProfileDocument>,
    @InjectModel(Opportunity.name)
    private readonly opportunityModel: Model<OpportunityDocument>,
    @InjectModel(PlacementApplication.name)
    private readonly placementApplicationModel: Model<PlacementApplicationDocument>,
  ) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Placement officer overview metrics (real aggregates)' })
  async getDashboard(): Promise<any> {
    const data = await this.analyticsService.getPlacementOfficerDashboard();
    return { success: true, data };
  }

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
  @Get('students')
  @ApiOperation({ summary: 'List students (paginated, searchable)' })
  async getStudents(
    @Query('page') page = '1',
    @Query('limit') limit = '10',
    @Query('q') q?: string,
    @Query('industry') industry?: string,
  ): Promise<any> {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));

    const profileCollection = this.studentProfileModel.collection.name;

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

    const [result] = await this.userModel.aggregate([
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
    const industries = await this.studentProfileModel.aggregate([
      { $match: { targetIndustry: { $ne: '' } } },
      { $group: { _id: '$targetIndustry', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 15 },
    ]);

    return {
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
    };
  }

  @Get('opportunities')
  @ApiOperation({ summary: 'List all placement opportunities (paginated)' })
  async getOpportunities(
    @Query('page') page = '1',
    @Query('limit') limit = '10',
    @Query('status') status?: string,
  ): Promise<any> {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));

    const filter: Record<string, any> = {};
    if (status) {
      filter.status = status;
    }

    const [items, total] = await Promise.all([
      this.opportunityModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      this.opportunityModel.countDocuments(filter),
    ]);

    return {
      success: true,
      data: items.map((i: any) => ({ ...i, id: i._id.toString() })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }

  @Post('opportunities')
  @ApiOperation({ summary: 'Create a new placement opportunity' })
  async createOpportunity(@Body() body: any): Promise<any> {
    const opp = new this.opportunityModel(body);
    await opp.save();
    globalEventBus.emit('dashboard_update', { type: 'OPPORTUNITY_CREATED' });
    return { success: true, data: opp };
  }

  @Get('applications')
  @ApiOperation({ summary: 'List student placement applications' })
  async getApplications(
    @Query('page') page = '1',
    @Query('limit') limit = '10',
  ): Promise<any> {
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

    const [result] = await this.placementApplicationModel.aggregate(pipeline);

    return {
      success: true,
      data: result.items.map((i: any) => ({ ...i, id: i._id.toString() })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: result.total[0]?.count ?? 0,
        totalPages: Math.ceil((result.total[0]?.count ?? 0) / limitNum),
      },
    };
  }

  @Patch('applications/:id')
  @ApiOperation({ summary: 'Update student application status' })
  async updateApplication(@Param('id') id: string, @Body() body: any): Promise<any> {
    const updated = await this.placementApplicationModel.findByIdAndUpdate(
      id,
      { $set: body },
      { new: true }
    );
    globalEventBus.emit('dashboard_update', { type: 'APPLICATION_UPDATED' });
    return { success: true, data: updated };
  }

  @Get('students/:id')
  @ApiOperation({ summary: 'Get single student career profile detail' })
  async getStudentDetail(@Param('id') id: string): Promise<any> {
    const userCollection = this.userModel.collection.name;
    const profileCollection = this.studentProfileModel.collection.name;

    // The directory may pass either a profileId (for students with profiles)
    // or a userId (for students who registered but never completed onboarding).
    // Try to resolve it as a profile first; if none, try as a user.
    const isObjectId = Types.ObjectId.isValid(id);
    if (!isObjectId) {
      return { success: false, message: 'Student profile not found.' };
    }
    const objectId = new Types.ObjectId(id);

    // First try: it's a StudentProfile _id
    const [profileHit] = await this.studentProfileModel.aggregate([
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
      return { success: true, data: { ...profileHit, id: profileHit._id.toString() } };
    }

    // Second try: it's a User _id with role=STUDENT
    const [userHit] = await this.userModel.aggregate([
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
      return { success: false, message: 'Student not found.' };
    }

    return { success: true, data: { ...userHit, id: userHit._id.toString() } };
  }
}
