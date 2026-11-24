import { Schema, HydratedDocument, Types } from 'mongoose';

export type MessageDocument = HydratedDocument<Message>;

export interface Message {
  conversationId: Types.ObjectId;
  senderId: Types.ObjectId;
  content: string;
}

export const MessageSchema = new Schema<Message>({
  conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
  senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  content: { required: true, type: String },
}, { timestamps: true });
MessageSchema.index({ conversationId: 1, createdAt: 1 });
