import { Schema, HydratedDocument, Types } from 'mongoose';

export type ActionItemDocument = HydratedDocument<ActionItem>;

export enum ActionItemStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  OVERDUE = 'OVERDUE',
}

export interface ActionItem {
  mentorshipId: Types.ObjectId;
  goalId?: Types.ObjectId;
  task: string;
  assignedToId: Types.ObjectId;
  createdById: Types.ObjectId;
  dueDate: Date;
  status: ActionItemStatus;
  completedAt?: Date;
}

export const ActionItemSchema = new Schema<ActionItem>({
  mentorshipId: { type: Schema.Types.ObjectId, ref: 'Mentorship', required: true, index: true },
  goalId: { type: Schema.Types.ObjectId, ref: 'Goal', index: true },
  task: { required: true, type: String },
  assignedToId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  createdById: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  dueDate: { required: true, type: Date },
  status: { required: true, default: ActionItemStatus.PENDING, enum: ActionItemStatus, index: true, type: String },
  completedAt: { type: Date },
}, { timestamps: true });
