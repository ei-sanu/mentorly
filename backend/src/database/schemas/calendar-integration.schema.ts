import { Schema, HydratedDocument, Types } from 'mongoose';

export type CalendarIntegrationDocument = HydratedDocument<CalendarIntegration>;

export interface CalendarIntegration {
  userId: Types.ObjectId;
  provider: string; // "GOOGLE" | "MICROSOFT"
  accessToken: string; // encrypted
  refreshToken: string; // encrypted
  expiryDate: Date;
  scopes: string[];
}

export const CalendarIntegrationSchema = new Schema<CalendarIntegration>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  provider: { required: true, type: String },
  accessToken: { required: true, type: String },
  refreshToken: { required: true, type: String },
  expiryDate: { required: true, type: Date },
  scopes: { type: [String], default: [] },
}, { timestamps: true });
// Single provider integration per user
CalendarIntegrationSchema.index({ userId: 1, provider: 1 }, { unique: true });
