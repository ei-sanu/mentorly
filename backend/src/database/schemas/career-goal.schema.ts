import { Schema, HydratedDocument } from 'mongoose';

export type CareerGoalDocument = HydratedDocument<CareerGoal>;

export interface CareerGoal {
  name: string;
}

export const CareerGoalSchema = new Schema<CareerGoal>({
  name: { required: true, unique: true, index: true, type: String },
}, { timestamps: true });
