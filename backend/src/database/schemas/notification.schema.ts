import { Schema, HydratedDocument, Types } from 'mongoose';

export type NotificationDocument = HydratedDocument<Notification>;

export interface Notification {
  userId: Types.ObjectId;
  type: string;
  title: string;
  message: string;
  read: boolean;
  metadata?: any;
  // (Item 4, 2026-11-20) Proper details: who it is from, what it is about,
  // and where it links. All optional — legacy rows predate them and are
  // backfilled at read time in notifications.service.ts.
  actorName?: string;
  entityType?: string;
  entityId?: string;
  link?: string;
}

export const NotificationSchema = new Schema<Notification>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { required: true, type: String },
  title: { required: true, type: String },
  message: { required: true, type: String },
  read: { required: true, default: false, index: true, type: Boolean },
  metadata: { type: Schema.Types.Mixed },
  actorName: { type: String },
  entityType: { type: String },
  entityId: { type: String },
  link: { type: String },
}, { timestamps: true });
NotificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
