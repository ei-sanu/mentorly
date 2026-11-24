import { Schema, HydratedDocument, Types } from 'mongoose';

export type PlacementApplicationDocument = HydratedDocument<PlacementApplication>;

export enum PlacementStatus {
  APPLIED = 'APPLIED',
  SHORTLISTED = 'SHORTLISTED',
  INTERVIEW_SCHEDULED = 'INTERVIEW_SCHEDULED',
  OFFERED = 'OFFERED',
  REJECTED = 'REJECTED',
  PLACED = 'PLACED',
}

export interface PlacementApplication {
  studentId: Types.ObjectId;
  opportunityId: Types.ObjectId;
  status: PlacementStatus;
  interviewDate?: Date;
  notes: string;
}

export const PlacementApplicationSchema = new Schema<PlacementApplication>({
  studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  opportunityId: { type: Schema.Types.ObjectId, ref: 'Opportunity', required: true, index: true },
  status: { type: String, enum: PlacementStatus, default: PlacementStatus.APPLIED, index: true },
  interviewDate: { type: Date },
  notes: { type: String, default: '' },
}, { timestamps: true });
