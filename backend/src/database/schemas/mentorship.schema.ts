import { Schema, HydratedDocument, Types } from 'mongoose';

export type MentorshipDocument = HydratedDocument<Mentorship>;

export enum MentorshipStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  AT_RISK = 'AT_RISK',
  INACTIVE = 'INACTIVE',
}

export interface Mentorship {
  studentProfileId: Types.ObjectId;
  mentorProfileId: Types.ObjectId;
  status: MentorshipStatus;
  startDate: Date;
  endDate?: Date;
}

export const MentorshipSchema = new Schema<Mentorship>({
  studentProfileId: { type: Schema.Types.ObjectId, ref: 'StudentProfile', required: true, index: true },
  mentorProfileId: { type: Schema.Types.ObjectId, ref: 'MentorProfile', required: true, index: true },
  status: { required: true, default: MentorshipStatus.ACTIVE, enum: MentorshipStatus, index: true, type: String },
  startDate: { required: true, default: Date.now, type: Date },
  endDate: { type: Date },
}, { timestamps: true });

MentorshipSchema.index({ studentProfileId: 1, status: 1 });
MentorshipSchema.index({ mentorProfileId: 1, status: 1 });
