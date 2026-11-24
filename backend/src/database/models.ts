import mongoose from 'mongoose';
import { Logger } from '../common/logger';

const logger = new Logger('Database');
import { User, UserSchema, UserDocument } from './schemas/user.schema';
import { StudentProfile, StudentProfileSchema, StudentProfileDocument } from './schemas/student-profile.schema';
import { MentorProfile, MentorProfileSchema, MentorProfileDocument } from './schemas/mentor-profile.schema';
import { AlumniVerification, AlumniVerificationSchema, AlumniVerificationDocument } from './schemas/alumni-verification.schema';
import { Availability, AvailabilitySchema, AvailabilityDocument } from './schemas/availability.schema';
import { MentorLeave, MentorLeaveSchema, MentorLeaveDocument } from './schemas/mentor-leave.schema';
import { CalendarNote, CalendarNoteSchema, CalendarNoteDocument } from './schemas/calendar-note.schema';
import { MentorshipRequest, MentorshipRequestSchema, MentorshipRequestDocument } from './schemas/mentorship-request.schema';
import { Mentorship, MentorshipSchema, MentorshipDocument } from './schemas/mentorship.schema';
import { Session, SessionSchema, SessionDocument } from './schemas/session.schema';
import { Goal, GoalSchema, GoalDocument } from './schemas/goal.schema';
import { ActionItem, ActionItemSchema, ActionItemDocument } from './schemas/action-item.schema';
import { Conversation, ConversationSchema, ConversationDocument } from './schemas/conversation.schema';
import { Message, MessageSchema, MessageDocument } from './schemas/message.schema';
import { Notification, NotificationSchema, NotificationDocument } from './schemas/notification.schema';
import { Feedback, FeedbackSchema, FeedbackDocument } from './schemas/feedback.schema';
import { EngagementLog, EngagementLogSchema, EngagementLogDocument } from './schemas/engagement-log.schema';
import { SystemConfig, SystemConfigSchema, SystemConfigDocument } from './schemas/system-config.schema';
import { AuditLog, AuditLogSchema, AuditLogDocument } from './schemas/audit-log.schema';
import { CalendarIntegration, CalendarIntegrationSchema, CalendarIntegrationDocument } from './schemas/calendar-integration.schema';
import { Skill, SkillSchema, SkillDocument } from './schemas/skill.schema';
import { Industry, IndustrySchema, IndustryDocument } from './schemas/industry.schema';
import { CareerGoal, CareerGoalSchema, CareerGoalDocument } from './schemas/career-goal.schema';
import { MentoringArea, MentoringAreaSchema, MentoringAreaDocument } from './schemas/mentoring-area.schema';
import { Opportunity, OpportunitySchema, OpportunityDocument } from './schemas/opportunity.schema';
import { OpportunityApplication, OpportunityApplicationSchema, OpportunityApplicationDocument } from './schemas/opportunity-application.schema';
import { PlacementApplication, PlacementApplicationSchema, PlacementApplicationDocument } from './schemas/placement-application.schema';

/**
 * Central mongoose model registry — replaces @nestjs/mongoose's
 * MongooseModule.forFeature(...) + @InjectModel(...) wiring.
 */
export const UserModel = mongoose.model<User>('User', UserSchema);
export const StudentProfileModel = mongoose.model<StudentProfile>('StudentProfile', StudentProfileSchema);
export const MentorProfileModel = mongoose.model<MentorProfile>('MentorProfile', MentorProfileSchema);
export const AlumniVerificationModel = mongoose.model<AlumniVerification>('AlumniVerification', AlumniVerificationSchema);
export const AvailabilityModel = mongoose.model<Availability>('Availability', AvailabilitySchema);
export const MentorLeaveModel = mongoose.model<MentorLeave>('MentorLeave', MentorLeaveSchema);
export const CalendarNoteModel = mongoose.model<CalendarNote>('CalendarNote', CalendarNoteSchema);
export const MentorshipRequestModel = mongoose.model<MentorshipRequest>('MentorshipRequest', MentorshipRequestSchema);
export const MentorshipModel = mongoose.model<Mentorship>('Mentorship', MentorshipSchema);
export const SessionModel = mongoose.model<Session>('Session', SessionSchema);
export const GoalModel = mongoose.model<Goal>('Goal', GoalSchema);
export const ActionItemModel = mongoose.model<ActionItem>('ActionItem', ActionItemSchema);
export const ConversationModel = mongoose.model<Conversation>('Conversation', ConversationSchema);
export const MessageModel = mongoose.model<Message>('Message', MessageSchema);
export const NotificationModel = mongoose.model<Notification>('Notification', NotificationSchema);
export const FeedbackModel = mongoose.model<Feedback>('Feedback', FeedbackSchema);
export const EngagementLogModel = mongoose.model<EngagementLog>('EngagementLog', EngagementLogSchema);
export const SystemConfigModel = mongoose.model<SystemConfig>('SystemConfig', SystemConfigSchema);
export const AuditLogModel = mongoose.model<AuditLog>('AuditLog', AuditLogSchema);
export const CalendarIntegrationModel = mongoose.model<CalendarIntegration>('CalendarIntegration', CalendarIntegrationSchema);
export const SkillModel = mongoose.model<Skill>('Skill', SkillSchema);
export const IndustryModel = mongoose.model<Industry>('Industry', IndustrySchema);
export const CareerGoalModel = mongoose.model<CareerGoal>('CareerGoal', CareerGoalSchema);
export const MentoringAreaModel = mongoose.model<MentoringArea>('MentoringArea', MentoringAreaSchema);
export const OpportunityModel = mongoose.model<Opportunity>('Opportunity', OpportunitySchema);
export const OpportunityApplicationModel = mongoose.model<OpportunityApplication>('OpportunityApplication', OpportunityApplicationSchema);
export const PlacementApplicationModel = mongoose.model<PlacementApplication>('PlacementApplication', PlacementApplicationSchema);

export async function connectDatabase(): Promise<void> {
  const uri = process.env.DATABASE_URL || 'mongodb://localhost:27017/mentorconnect';
  await mongoose.connect(uri);
  logger.log(`MongoDB connected (database: ${mongoose.connection.name})`);
}
