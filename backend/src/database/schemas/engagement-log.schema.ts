import { Schema, HydratedDocument, Types } from 'mongoose';

export type EngagementLogDocument = HydratedDocument<EngagementLog>;

export enum RiskLevel {
  HEALTHY = 'HEALTHY',
  NEEDS_ATTENTION = 'NEEDS_ATTENTION',
  AT_RISK = 'AT_RISK',
  INACTIVE = 'INACTIVE',
}

export interface EngagementLog {
  mentorshipId: Types.ObjectId;
  lastInteractionDate: Date;
  sessionsCompletedCount: number;
  sessionsMissedCount: number;
  goalsCompletedCount: number;
  actionItemsCompletedCount: number;
  daysSinceLastInteraction: number;
  riskScore: number;
  riskLevel: RiskLevel;
  reasons: string[];
}

export const EngagementLogSchema = new Schema<EngagementLog>({
  mentorshipId: { type: Schema.Types.ObjectId, ref: 'Mentorship', required: true, unique: true, index: true },
  lastInteractionDate: { required: true, type: Date, default: Date.now },
  sessionsCompletedCount: { type: Number, default: 0 },
  sessionsMissedCount: { type: Number, default: 0 },
  goalsCompletedCount: { type: Number, default: 0 },
  actionItemsCompletedCount: { type: Number, default: 0 },
  daysSinceLastInteraction: { type: Number, default: 0 },
  riskScore: { type: Number, default: 0.0 },
  riskLevel: { required: true, default: RiskLevel.HEALTHY, enum: RiskLevel, index: true, type: String },
  reasons: { type: [String], default: [] },
}, { timestamps: true });
