import { Schema, HydratedDocument } from 'mongoose';

export type MentoringAreaDocument = HydratedDocument<MentoringArea>;

export interface MentoringArea {
  name: string;
}

export const MentoringAreaSchema = new Schema<MentoringArea>({
  name: { required: true, unique: true, index: true, type: String },
}, { timestamps: true });
