import { Schema, HydratedDocument, Types } from 'mongoose';

export type MentorProfileDocument = HydratedDocument<MentorProfile>;

export enum VerificationStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
}

export enum MentorStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  INACTIVE = 'INACTIVE',
}

export interface MentorProfile {
  userId: Types.ObjectId;
  graduationYear: number;
  programme: string;
  currentCompany: string;
  currentDesignation: string;
  yearsOfExperience: number;
  industry: string;
  expertise: string[];
  mentoringAreas: string[];
  bio: string;
  careerSummary: string;
  maxCapacity: number;
  currentMenteesCount: number;
  acceptingMentees: boolean;
  verificationStatus: VerificationStatus;
  status: MentorStatus;
  profileVisibility: boolean;

  // MongoDB vector search embedding
  mentorEmbedding?: number[];
}

export const MentorProfileSchema = new Schema<MentorProfile>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  graduationYear: { required: true, type: Number },
  programme: { required: true, type: String },
  currentCompany: { required: true, type: String },
  currentDesignation: { required: true, type: String },
  yearsOfExperience: { required: true, type: Number },
  industry: { required: true, index: true, type: String },
  expertise: { type: [String], default: [], index: true },
  mentoringAreas: { type: [String], default: [] },
  bio: { required: true, type: String },
  careerSummary: { required: true, type: String },
  maxCapacity: { type: Number, default: 3 },
  currentMenteesCount: { type: Number, default: 0 },
  acceptingMentees: { default: true, index: true, type: Boolean },
  verificationStatus: { required: true, default: VerificationStatus.PENDING, index: true, enum: VerificationStatus, type: String },
  status: { required: true, default: MentorStatus.INACTIVE, index: true, enum: MentorStatus, type: String },
  profileVisibility: { default: true, type: Boolean },
  mentorEmbedding: { type: [Number], index: false },
}, { timestamps: true });

MentorProfileSchema.index({
  verificationStatus: 1,
  status: 1,
  acceptingMentees: 1,
  profileVisibility: 1,
});
