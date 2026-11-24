import { Schema, HydratedDocument } from 'mongoose';

export type SystemConfigDocument = HydratedDocument<SystemConfig>;

export interface SystemConfig {
  key: string; // e.g. "MATCHING_WEIGHTS"
  value: any;
}

export const SystemConfigSchema = new Schema<SystemConfig>({
  key: { required: true, unique: true, index: true, type: String },
  value: { type: Schema.Types.Mixed, required: true },
}, { timestamps: true });
