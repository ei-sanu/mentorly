import { Schema, HydratedDocument, Types } from 'mongoose';

export type AvailabilityDocument = HydratedDocument<Availability>;

export interface Availability {
  mentorProfileId: Types.ObjectId;
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  startTime: string; // e.g. "10:00"
  endTime: string; // e.g. "11:00"
  timezone: string;
}

export const AvailabilitySchema = new Schema<Availability>({
  mentorProfileId: { type: Schema.Types.ObjectId, ref: 'MentorProfile', required: true, index: true },
  dayOfWeek: { required: true, type: Number },
  startTime: { required: true, type: String },
  endTime: { required: true, type: String },
  timezone: { required: true, default: 'Asia/Kolkata', type: String },
}, { timestamps: true });
// Avoid duplicate time-slot registration for the same mentor
AvailabilitySchema.index({ mentorProfileId: 1, dayOfWeek: 1, startTime: 1 }, { unique: true });
