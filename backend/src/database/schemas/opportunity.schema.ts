import { Schema, HydratedDocument, Types } from 'mongoose';

export type OpportunityDocument = HydratedDocument<Opportunity>;

export enum OpportunityType {
  FULL_TIME = 'FULL_TIME',
  INTERNSHIP = 'INTERNSHIP',
  CO_OP = 'CO_OP',
  HACKATHON = 'HACKATHON',
  REFERRAL = 'REFERRAL',
}

export enum OpportunityStatus {
  UPCOMING = 'UPCOMING',
  ACTIVE = 'ACTIVE',
  CLOSED = 'CLOSED',
}

export interface Opportunity {
  title: string;
  company: string;
  type: OpportunityType;
  location?: string;
  description?: string;
  status: OpportunityStatus;
  postedBy: Types.ObjectId;
  applyBy?: Date;
}

export const OpportunitySchema = new Schema<Opportunity>({
  title: { required: true, trim: true, type: String },
  company: { required: true, trim: true, type: String },
  type: { required: true, enum: OpportunityType, default: OpportunityType.FULL_TIME, type: String },
  location: { default: '', type: String },
  description: { default: '', type: String },
  status: { required: true, default: OpportunityStatus.UPCOMING, enum: OpportunityStatus, index: true, type: String },
  postedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  applyBy: { default: Date.now, type: Date },
}, { timestamps: true });
