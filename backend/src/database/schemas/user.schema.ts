import { Schema, HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

export enum Role {
  STUDENT = 'STUDENT',
  MENTOR = 'MENTOR',
  ALUMNI_OFFICER = 'ALUMNI_OFFICER',
  PLACEMENT_OFFICER = 'PLACEMENT_OFFICER',
  ADMIN = 'ADMIN',
  // PENDING (2026-11-12): a brand-new account provisioned without ANY
  // role signal (e.g. first-time OAuth sign-in, where no role was ever
  // chosen). It means "no role chosen yet" — never a silent STUDENT.
  // The onboarding role gate asks the user, and submitOnboarding writes
  // the chosen role. No pre-existing account holds this value (the
  // guard only assigns it at provisioning time), so adding it is
  // migration-safe: existing users keep their roles untouched.
  PENDING = 'PENDING',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  PENDING = 'PENDING',
}

export interface User {
  clerkUserId: string;
  email: string;
  role: Role;
  status: UserStatus;
  onboardingStatus: string;
  verificationStatus: string;
  phone?: string;
  phoneDetails?: {
    countryCode: string;
    nationalNumber: string;
    e164: string;
    verified: boolean;
    verifiedAt?: Date;
  };
  phoneVerification?: {
    status: 'NOT_STARTED' | 'PENDING' | 'VERIFIED' | 'FAILED' | 'LOCKED';
    attempts: number;
    lastSentAt?: Date;
    verifiedAt?: Date;
  };
  lpuRegistrationNumber?: string;
  lpuRegistrationNumberNormalized?: string;
  lpuEmail?: string;
  rejectionReason?: string;
  changeRequestReason?: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  lastLoginAt?: Date;
}

export const UserSchema = new Schema<User>({
  clerkUserId: { required: true, unique: true, index: true, type: String },
  email: { required: true, unique: true, index: true, type: String },
  role: { required: true, index: true, enum: Role, type: String },
  status: { required: true, default: UserStatus.ACTIVE, index: true, enum: UserStatus, type: String },
  onboardingStatus: { required: true, default: 'NOT_STARTED', index: true, type: String },
  verificationStatus: { required: true, default: 'NOT_SUBMITTED', index: true, type: String },
  phone: { type: String },
  phoneDetails: { type: {
    countryCode: { type: String },
    nationalNumber: { type: String },
    e164: { type: String },
    verified: { type: Boolean, default: false },
    verifiedAt: { type: Date }
  }, _id: false },
  phoneVerification: { type: {
    status: { type: String, default: 'NOT_STARTED', enum: ['NOT_STARTED', 'PENDING', 'VERIFIED', 'FAILED', 'LOCKED'] },
    attempts: { type: Number, default: 0 },
    lastSentAt: { type: Date },
    verifiedAt: { type: Date }
  }, _id: false },
  lpuRegistrationNumber: { type: String },
  lpuRegistrationNumberNormalized: { type: String },
  lpuEmail: { type: String },
  rejectionReason: { type: String },
  changeRequestReason: { type: String },
  firstName: { required: true, type: String },
  lastName: { required: true, type: String },
  avatar: { type: String },
  lastLoginAt: { type: Date },
}, { timestamps: true });

UserSchema.index({ role: 1, createdAt: -1 });
UserSchema.index({ role: 1, onboardingStatus: 1 });
