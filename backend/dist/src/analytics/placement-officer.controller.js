"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlacementOfficerController = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const analytics_service_1 = require("../analytics/analytics.service");
const clerk_auth_guard_1 = require("../auth/clerk-auth.guard");
const roles_guard_1 = require("../auth/roles.guard");
const roles_decorator_1 = require("../auth/roles.decorator");
const swagger_1 = require("@nestjs/swagger");
const student_profile_schema_1 = require("../database/schemas/student-profile.schema");
const user_schema_1 = require("../database/schemas/user.schema");
const opportunity_schema_1 = require("../database/schemas/opportunity.schema");
const placement_application_schema_1 = require("../database/schemas/placement-application.schema");
const event_bus_1 = require("../common/event-bus");
let PlacementOfficerController = class PlacementOfficerController {
    constructor(analyticsService, userModel, studentProfileModel, opportunityModel, placementApplicationModel) {
        this.analyticsService = analyticsService;
        this.userModel = userModel;
        this.studentProfileModel = studentProfileModel;
        this.opportunityModel = opportunityModel;
        this.placementApplicationModel = placementApplicationModel;
    }
    async getDashboard() {
        const data = await this.analyticsService.getPlacementOfficerDashboard();
        return { success: true, data };
    }
    async getStudents(page = '1', limit = '10', q, industry) {
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
        const profileCollection = this.studentProfileModel.collection.name;
        const baseMatch = { role: user_schema_1.Role.STUDENT };
        const postMatch = [];
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
        const industries = await this.studentProfileModel.aggregate([
            { $match: { targetIndustry: { $ne: '' } } },
            { $group: { _id: '$targetIndustry', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 15 },
        ]);
        return {
            success: true,
            data: result.items.map((i) => ({
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
    async getOpportunities(page = '1', limit = '10', status) {
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
        const filter = {};
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
            data: items.map((i) => ({ ...i, id: i._id.toString() })),
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
            },
        };
    }
    async createOpportunity(body) {
        const opp = new this.opportunityModel(body);
        await opp.save();
        event_bus_1.globalEventBus.emit('dashboard_update', { type: 'OPPORTUNITY_CREATED' });
        return { success: true, data: opp };
    }
    async getApplications(page = '1', limit = '10') {
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
        const pipeline = [
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
            data: result.items.map((i) => ({ ...i, id: i._id.toString() })),
            pagination: {
                page: pageNum,
                limit: limitNum,
                total: result.total[0]?.count ?? 0,
                totalPages: Math.ceil((result.total[0]?.count ?? 0) / limitNum),
            },
        };
    }
    async updateApplication(id, body) {
        const updated = await this.placementApplicationModel.findByIdAndUpdate(id, { $set: body }, { new: true });
        event_bus_1.globalEventBus.emit('dashboard_update', { type: 'APPLICATION_UPDATED' });
        return { success: true, data: updated };
    }
    async getStudentDetail(id) {
        const userCollection = this.userModel.collection.name;
        const profileCollection = this.studentProfileModel.collection.name;
        const isObjectId = mongoose_2.Types.ObjectId.isValid(id);
        if (!isObjectId) {
            return { success: false, message: 'Student profile not found.' };
        }
        const objectId = new mongoose_2.Types.ObjectId(id);
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
        const [userHit] = await this.userModel.aggregate([
            { $match: { _id: objectId, role: user_schema_1.Role.STUDENT } },
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
};
exports.PlacementOfficerController = PlacementOfficerController;
__decorate([
    (0, common_1.Get)('dashboard'),
    (0, swagger_1.ApiOperation)({ summary: 'Placement officer overview metrics (real aggregates)' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], PlacementOfficerController.prototype, "getDashboard", null);
__decorate([
    (0, common_1.Get)('students'),
    (0, swagger_1.ApiOperation)({ summary: 'List students (paginated, searchable)' }),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('q')),
    __param(3, (0, common_1.Query)('industry')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String, String]),
    __metadata("design:returntype", Promise)
], PlacementOfficerController.prototype, "getStudents", null);
__decorate([
    (0, common_1.Get)('opportunities'),
    (0, swagger_1.ApiOperation)({ summary: 'List all placement opportunities (paginated)' }),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], PlacementOfficerController.prototype, "getOpportunities", null);
__decorate([
    (0, common_1.Post)('opportunities'),
    (0, swagger_1.ApiOperation)({ summary: 'Create a new placement opportunity' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PlacementOfficerController.prototype, "createOpportunity", null);
__decorate([
    (0, common_1.Get)('applications'),
    (0, swagger_1.ApiOperation)({ summary: 'List student placement applications' }),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], PlacementOfficerController.prototype, "getApplications", null);
__decorate([
    (0, common_1.Patch)('applications/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'Update student application status' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], PlacementOfficerController.prototype, "updateApplication", null);
__decorate([
    (0, common_1.Get)('students/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'Get single student career profile detail' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PlacementOfficerController.prototype, "getStudentDetail", null);
exports.PlacementOfficerController = PlacementOfficerController = __decorate([
    (0, swagger_1.ApiTags)('Placement Officer'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(clerk_auth_guard_1.ClerkAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(user_schema_1.Role.PLACEMENT_OFFICER, user_schema_1.Role.ADMIN),
    (0, common_1.Controller)('placement-officer'),
    __param(1, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __param(2, (0, mongoose_1.InjectModel)(student_profile_schema_1.StudentProfile.name)),
    __param(3, (0, mongoose_1.InjectModel)(opportunity_schema_1.Opportunity.name)),
    __param(4, (0, mongoose_1.InjectModel)(placement_application_schema_1.PlacementApplication.name)),
    __metadata("design:paramtypes", [analytics_service_1.AnalyticsService,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model])
], PlacementOfficerController);
//# sourceMappingURL=placement-officer.controller.js.map