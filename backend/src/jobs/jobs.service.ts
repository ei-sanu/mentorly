import { Logger } from '../common/logger';
import { InProcessQueue } from '../common/in-process-queue';
import { MentorshipRequestModel, ActionItemModel, NotificationModel, MentorshipModel, SessionModel, GoalModel, EngagementLogModel, MessageModel, ConversationModel } from '../database/models';
import { matchingService } from '../matching/matching.service';
import { emailService } from '../email/email.service';
import { MentorshipRequest, MentorshipRequestDocument, RequestStatus } from '../database/schemas/mentorship-request.schema';
import { ActionItem, ActionItemDocument, ActionItemStatus } from '../database/schemas/action-item.schema';
import { Notification, NotificationDocument } from '../database/schemas/notification.schema';
import { Mentorship, MentorshipDocument } from '../database/schemas/mentorship.schema';
import { Session, SessionDocument, SessionStatus } from '../database/schemas/session.schema';
import { Goal, GoalDocument, GoalStatus } from '../database/schemas/goal.schema';
import { EngagementLog, EngagementLogDocument, RiskLevel } from '../database/schemas/engagement-log.schema';
import { Message, MessageDocument } from '../database/schemas/message.schema';
import { Conversation, ConversationDocument } from '../database/schemas/conversation.schema';

export class JobsService {
  private readonly logger = new Logger(JobsService.name);
  // In-process queues (was BullMQ over Upstash Redis). Same processors,
  // same concurrency (embeddings 2, emails 3) and retry shape. Jobs are
  // not durable across restarts — see in-process-queue.ts.
  private embeddingQueue: InProcessQueue<{ type: string; profileId: string }>;
  private emailQueue: InProcessQueue<{ userId: string; type: string; title: string; message: string }>;
  private intervalId: NodeJS.Timeout;

  private readonly requestModel = MentorshipRequestModel;
  private readonly actionItemModel = ActionItemModel;
  private readonly notificationModel = NotificationModel;
  private readonly mentorshipModel = MentorshipModel;
  private readonly sessionModel = SessionModel;
  private readonly goalModel = GoalModel;
  private readonly engagementLogModel = EngagementLogModel;
  private readonly messageModel = MessageModel;
  private readonly conversationModel = ConversationModel;
  private get matchingService() { return matchingService; }
  private get emailService() { return emailService; }

    async onModuleInit() {
    // In-process queues — no Redis connection to build, no Upstash host.
    this.embeddingQueue = new InProcessQueue(
      'embeddings',
      async ({ type, profileId }) => {
        this.logger.log(`Processing embedding job for ${type} profile: ${profileId}`);
        if (type === 'student') {
          await this.matchingService.generateAndSaveStudentEmbedding(profileId);
        } else if (type === 'mentor') {
          await this.matchingService.generateAndSaveMentorEmbedding(profileId);
        }
      },
      2,
    );

    this.emailQueue = new InProcessQueue(
      'emails',
      async ({ userId, type, title, message }) => {
        this.logger.log(`Processing email job for user ${userId}: ${title}`);
        await this.emailService.sendNotificationEmail(userId, type, title, message);
      },
      3,
    );

    // Periodic sweep every 1 minute
    this.intervalId = setInterval(async () => {
      await this.checkRequestExpirations();
      await this.checkOverdueActionItems();
      await this.runEngagementEvaluations();
    }, 60000);

    this.logger.log('Background queues initialised (embeddings ×2, emails ×3) — sweeps every 60s');
  }

  async onModuleDestroy() {
    if (this.embeddingQueue) await this.embeddingQueue.close();
    if (this.emailQueue) await this.emailQueue.close();
    if (this.intervalId) clearInterval(this.intervalId);
  }

  // Enqueue Functions
  async queueStudentEmbedding(studentProfileId: string) {
    if (this.embeddingQueue) {
      await this.embeddingQueue.add(
        'student-embedding',
        { type: 'student', profileId: studentProfileId },
        { attempts: 3, backoff: { type: 'exponential', delay: 10000 } },
      );
    }
  }

  async queueMentorEmbedding(mentorProfileId: string) {
    if (this.embeddingQueue) {
      await this.embeddingQueue.add(
        'mentor-embedding',
        { type: 'mentor', profileId: mentorProfileId },
        { attempts: 3, backoff: { type: 'exponential', delay: 10000 } },
      );
    }
  }

  async queueEmail(userId: string, type: string, title: string, message: string) {
    if (this.emailQueue) {
      await this.emailQueue.add(
        'send-email',
        { userId, type, title, message },
        { attempts: 5, backoff: { type: 'exponential', delay: 5000 } },
      );
    }
  }

  // Sweep implementations
  private async checkRequestExpirations() {
    try {
      const expirationThreshold = new Date();
      expirationThreshold.setHours(expirationThreshold.getHours() - 72);

      const expiredRequests = await this.requestModel.find({
        status: RequestStatus.PENDING,
        createdAt: { $lt: expirationThreshold },
      }).lean();

      if (expiredRequests.length === 0) return;

      this.logger.log(`Found ${expiredRequests.length} expired mentorship requests`);

      for (const req of expiredRequests) {
        await this.requestModel.findByIdAndUpdate(req._id, {
          $set: { status: RequestStatus.EXPIRED },
        });

        // Notify Student
        const notification = new this.notificationModel({
          userId: req.studentId,
          type: 'REQUEST_EXPIRED',
          title: 'Mentorship Request Expired',
          message: 'Your request for mentorship has expired as the mentor did not respond within 72 hours.',
        });
        await notification.save();
      }
    } catch (err) {
      this.logger.error(`Error in checkRequestExpirations: ${err.message}`);
    }
  }

  private async checkOverdueActionItems() {
    try {
      const now = new Date();

      const overdueItems = await this.actionItemModel.find({
        status: { $in: [ActionItemStatus.PENDING, ActionItemStatus.IN_PROGRESS] },
        dueDate: { $lt: now },
      }).lean();

      if (overdueItems.length === 0) return;

      this.logger.log(`Found ${overdueItems.length} overdue action items`);

      for (const item of overdueItems) {
        await this.actionItemModel.findByIdAndUpdate(item._id, {
          $set: { status: ActionItemStatus.OVERDUE },
        });

        // Notify Assignee
        const notification = new this.notificationModel({
          userId: item.assignedToId,
          type: 'ACTION_ITEM_OVERDUE',
          title: 'Action Item Overdue',
          message: `Your action item "${item.task}" is overdue. Please update your progress.`,
        });
        await notification.save();
      }
    } catch (err) {
      this.logger.error(`Error in checkOverdueActionItems: ${err.message}`);
    }
  }

  private async runEngagementEvaluations() {
    try {
      const mentorships = await this.mentorshipModel.find({ status: 'ACTIVE' }).lean();
      const now = new Date();

      for (const m of mentorships) {
        const mId = m._id;

        // Fetch children
        const sessions = await this.sessionModel.find({ mentorshipId: mId }).lean();
        const goals = await this.goalModel.find({ mentorshipId: mId }).lean();
        const actionItems = await this.actionItemModel.find({ mentorshipId: mId }).lean();
        const conversation = await this.conversationModel.findOne({ mentorshipId: mId }).lean();

        let latestMessage = null;
        if (conversation) {
          latestMessage = await this.messageModel
            .findOne({ conversationId: conversation._id })
            .sort({ createdAt: -1 })
            .lean();
        }

        let lastInteractionDate = m.startDate || new Date();

        if (sessions.length > 0) {
          const sortedSessions = [...sessions].sort(
            (a, b) => b.startTime.getTime() - a.startTime.getTime(),
          );
          if (sortedSessions[0].startTime > lastInteractionDate) {
            lastInteractionDate = sortedSessions[0].startTime;
          }
        }

        if (latestMessage && (latestMessage as any).createdAt > lastInteractionDate) {
          lastInteractionDate = (latestMessage as any).createdAt;
        }

        const daysSinceLastInteraction = Math.floor(
          (now.getTime() - lastInteractionDate.getTime()) / (1000 * 60 * 60 * 24),
        );

        let riskLevel = RiskLevel.HEALTHY;
        let riskScore = 0.0;
        const reasons: string[] = [];

        if (daysSinceLastInteraction >= 30) {
          riskLevel = RiskLevel.INACTIVE;
          riskScore = 1.0;
          reasons.push('No interaction for 30+ days');
        } else if (daysSinceLastInteraction >= 21) {
          riskLevel = RiskLevel.AT_RISK;
          riskScore = 0.8;
          reasons.push('No interaction for 21+ days');
        } else if (daysSinceLastInteraction >= 14) {
          riskLevel = RiskLevel.NEEDS_ATTENTION;
          riskScore = 0.5;
          reasons.push('No interaction for 14+ days');
        }

        const overdueCount = actionItems.filter((item) => item.status === ActionItemStatus.OVERDUE).length;
        if (overdueCount > 0) {
          riskScore += overdueCount * 0.1;
          reasons.push(`${overdueCount} overdue action item(s)`);
        }

        riskScore = Math.min(riskScore, 1.0);
        if (riskScore >= 0.7 && riskLevel !== RiskLevel.INACTIVE) {
          riskLevel = RiskLevel.AT_RISK;
        } else if (riskScore >= 0.4 && riskLevel === RiskLevel.HEALTHY) {
          riskLevel = RiskLevel.NEEDS_ATTENTION;
        }

        const logData = {
          mentorshipId: mId,
          lastInteractionDate,
          sessionsCompletedCount: sessions.filter((s) => s.status === SessionStatus.COMPLETED).length,
          sessionsMissedCount: sessions.filter((s) => s.status === SessionStatus.NO_SHOW).length,
          goalsCompletedCount: goals.filter((g) => g.status === GoalStatus.COMPLETED).length,
          actionItemsCompletedCount: actionItems.filter((a) => a.status === ActionItemStatus.COMPLETED).length,
          daysSinceLastInteraction,
          riskScore,
          riskLevel,
          reasons,
        };

        await this.engagementLogModel.findOneAndUpdate(
          { mentorshipId: mId },
          { $set: logData },
          { upsert: true, new: true },
        );
      }
    } catch (err) {
      this.logger.error(`Error in runEngagementEvaluations: ${err.message}`);
    }
  }
}

export const jobsService = new JobsService();
