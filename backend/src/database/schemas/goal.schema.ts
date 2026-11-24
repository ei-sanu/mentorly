import { Schema, HydratedDocument, Types } from 'mongoose';

export type GoalDocument = HydratedDocument<Goal>;

export enum GoalStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export interface Goal {
  mentorshipId: Types.ObjectId;
  title: string;
  description: string;
  progress: number;
  status: GoalStatus;
  targetDate: Date;
  completedAt?: Date;
}

export const GoalSchema = new Schema<Goal>({
  mentorshipId: { type: Schema.Types.ObjectId, ref: 'Mentorship', required: true, index: true },
  title: { required: true, type: String },
  description: { required: true, type: String },
  progress: { type: Number, default: 0 },
  status: { required: true, default: GoalStatus.NOT_STARTED, enum: GoalStatus, index: true, type: String },
  targetDate: { required: true, type: Date },
  completedAt: { type: Date },
}, { timestamps: true });
