import { Schema, HydratedDocument, Types } from 'mongoose';

export type AuditLogDocument = HydratedDocument<AuditLog>;

export interface AuditLog {
  actorId?: Types.ObjectId;
  action: string; // e.g. "ROLE_CHANGE", "APPROVE_VERIFICATION"
  entity: string; // e.g. "User", "AlumniVerification"
  entityId: string;
  metadata?: any;
  ipAddress?: string;
}

export const AuditLogSchema = new Schema<AuditLog>({
  actorId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  action: { required: true, index: true, type: String },
  entity: { required: true, index: true, type: String },
  entityId: { required: true, index: true, type: String },
  metadata: { type: Schema.Types.Mixed },
  ipAddress: { type: String },
}, { timestamps: { createdAt: true, updatedAt: false } });
