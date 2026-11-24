import { Schema, HydratedDocument, Types } from 'mongoose';

export type FeedbackDocument = HydratedDocument<Feedback>;

export interface Feedback {
  mentorshipId: Types.ObjectId;
  submitterId: Types.ObjectId;
  rating: number;
  comments?: string;

  // Student specific feedback fields
  usefulness?: number;
  learningOutcome?: string;

  // Mentor specific feedback fields
  preparedness?: number;
  progressScore?: number;
  engagement?: number;
}

export const FeedbackSchema = new Schema<Feedback>({
  mentorshipId: { type: Schema.Types.ObjectId, ref: 'Mentorship', required: true, index: true },
  submitterId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  rating: { required: true, type: Number },
  comments: { type: String },
  usefulness: { type: Number },
  learningOutcome: { type: String },
  preparedness: { type: Number },
  progressScore: { type: Number },
  engagement: { type: Number },
}, { timestamps: true });
// Ensure single feedback per participant on a mentorship
FeedbackSchema.index({ mentorshipId: 1, submitterId: 1 }, { unique: true });
