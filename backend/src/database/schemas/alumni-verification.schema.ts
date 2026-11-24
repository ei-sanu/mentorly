import { Schema, HydratedDocument, Types } from 'mongoose';
import { VerificationStatus } from './mentor-profile.schema';

export type AlumniVerificationDocument = HydratedDocument<AlumniVerification>;

export interface AlumniVerification {
  mentorProfileId?: Types.ObjectId;
  studentProfileId?: Types.ObjectId;
  submittedData: any;
  status: VerificationStatus;
  reviewerId?: Types.ObjectId;
  reviewedAt?: Date;
  rejectionReason?: string;
}

export const AlumniVerificationSchema = new Schema<AlumniVerification>({
  mentorProfileId: { type: Schema.Types.ObjectId, ref: 'MentorProfile', index: true },
  studentProfileId: { type: Schema.Types.ObjectId, ref: 'StudentProfile', index: true },
  submittedData: { type: Schema.Types.Mixed, required: true },
  status: { required: true, default: VerificationStatus.PENDING, enum: VerificationStatus, index: true, type: String },
  reviewerId: { type: Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: { type: Date },
  rejectionReason: { type: String },
}, { timestamps: true });
