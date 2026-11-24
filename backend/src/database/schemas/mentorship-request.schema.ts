import { Schema, HydratedDocument, Types } from 'mongoose';

export type MentorshipRequestDocument = HydratedDocument<MentorshipRequest>;

export enum RequestStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

export interface MentorshipRequest {
  studentId: Types.ObjectId;
  mentorId: Types.ObjectId;
  message: string;
  goal: string;
  status: RequestStatus;
  /**
   * AI-refined summary of the student's goal + message, written by the
   * local Llama model (see requests/request-refinement.service.ts).
   * Present only when aiRefined is true.
   */
  aiRefinedSummary?: string;
  /** Suggested focus areas from the same refinement (max 4). */
  aiFocusAreas?: string[];
  /** True ONLY when the LLM genuinely produced a refinement for this request. */
  aiRefined?: boolean;
  /**
   * Ollama error kind when a refinement was attempted and failed
   * ('unavailable' | 'timeout' | 'invalid_output' | 'disabled').
   * Absent while a refinement is still running.
   */
  aiRefineError?: string;
  /** When the refinement completed. */
  aiRefinedAt?: Date;
}

export const MentorshipRequestSchema = new Schema<MentorshipRequest>({
  studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  mentorId: { type: Schema.Types.ObjectId, ref: 'MentorProfile', required: true, index: true },
  message: { required: true, type: String },
  goal: { required: true, type: String },
  status: { required: true, default: RequestStatus.PENDING, enum: RequestStatus, index: true, type: String },
  aiRefinedSummary: { type: String },
  aiFocusAreas: { type: [String] },
  aiRefined: { type: Boolean, default: false },
  aiRefineError: { type: String },
  aiRefinedAt: { type: Date },
}, { timestamps: true });

MentorshipRequestSchema.index({ studentId: 1, status: 1, createdAt: -1 });
MentorshipRequestSchema.index({ mentorId: 1, status: 1, createdAt: -1 });
MentorshipRequestSchema.index({ studentId: 1, status: 1 });
