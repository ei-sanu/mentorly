import { Schema, HydratedDocument, Types } from 'mongoose';

export type StudentProfileDocument = HydratedDocument<StudentProfile>;

export interface StudentProfile {
  userId: Types.ObjectId;
  programme: string;
  school: string;
  yearOfStudy: number;
  graduationYear: number;
  currentSkills: string[];
  targetRole: string;
  targetIndustry: string;
  careerGoals: string[];
  interests: string[];
  mentoringNeeds: string;
  preferredFrequency: string;
  onboardingStatus: boolean;
  profileCompletion: number;
  profileVisibility: boolean;

  // MongoDB vector search embedding (array of floats)
  studentEmbedding?: number[];
}

export const StudentProfileSchema = new Schema<StudentProfile>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  programme: { required: true, type: String },
  school: { required: true, type: String },
  yearOfStudy: { required: true, type: Number },
  graduationYear: { required: true, type: Number },
  currentSkills: { type: [String], default: [] },
  targetRole: { required: true, type: String },
  targetIndustry: { required: true, type: String },
  careerGoals: { type: [String], default: [] },
  interests: { type: [String], default: [] },
  mentoringNeeds: { required: true, type: String },
  preferredFrequency: { required: true, type: String },
  onboardingStatus: { default: false, type: Boolean },
  profileCompletion: { type: Number, default: 0 },
  profileVisibility: { default: true, type: Boolean },
  studentEmbedding: { type: [Number], index: false },
}, { timestamps: true });

StudentProfileSchema.index({ targetIndustry: 1 });
StudentProfileSchema.index({ targetRole: 1 });
