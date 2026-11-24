import { Schema, HydratedDocument } from 'mongoose';

export type IndustryDocument = HydratedDocument<Industry>;

export interface Industry {
  name: string;
}

export const IndustrySchema = new Schema<Industry>({
  name: { required: true, unique: true, index: true, type: String },
}, { timestamps: true });
