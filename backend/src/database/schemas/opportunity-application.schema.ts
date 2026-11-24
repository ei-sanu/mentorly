import { Schema, HydratedDocument, Types } from 'mongoose';

export type OpportunityApplicationDocument = HydratedDocument<OpportunityApplication>;

export enum ApplicationStatus {
  APPLIED = 'APPLIED',
  SHORTLISTED = 'SHORTLISTED',
  INTERVIEW = 'INTERVIEW',
  SELECTED = 'SELECTED',
  REJECTED = 'REJECTED',
}

export interface OpportunityApplication {
  opportunityId: Types.ObjectId;
  userId: Types.ObjectId;
  status: ApplicationStatus;
  notes?: string;
}

export const OpportunityApplicationSchema = new Schema<OpportunityApplication>({
  opportunityId: { type: Schema.Types.ObjectId, ref: 'Opportunity', required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  status: { required: true, default: ApplicationStatus.APPLIED, enum: ApplicationStatus, index: true, type: String },
  notes: { default: '', type: String },
}, { timestamps: true });
// A student can apply to an opportunity only once
OpportunityApplicationSchema.index({ opportunityId: 1, userId: 1 }, { unique: true });
