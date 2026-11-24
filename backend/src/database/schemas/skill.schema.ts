import { Schema, HydratedDocument } from 'mongoose';

export type SkillDocument = HydratedDocument<Skill>;

export interface Skill {
  name: string;
}

export const SkillSchema = new Schema<Skill>({
  name: { required: true, unique: true, index: true, type: String },
}, { timestamps: true });
