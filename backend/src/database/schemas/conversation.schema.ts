import { Schema, HydratedDocument, Types } from 'mongoose';

export type ConversationDocument = HydratedDocument<Conversation>;

export interface Conversation {
  mentorshipId: Types.ObjectId;
  participants: Types.ObjectId[];
}

export const ConversationSchema = new Schema<Conversation>({
  mentorshipId: { type: Schema.Types.ObjectId, ref: 'Mentorship', required: true, unique: true, index: true },
  participants: { type: [{ type: Schema.Types.ObjectId, ref: 'User' }], required: true, index: true },
}, { timestamps: true });
