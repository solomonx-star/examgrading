import mongoose, { Schema, Model, Types } from "mongoose";

export type NotificationChannel = "inapp" | "email" | "sms";

export interface INotification {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  type: string;
  title: string;
  body: string;
  link?: string | null;
  metadata?: Record<string, unknown>;
  channels: NotificationChannel[];
  deliveredChannels: NotificationChannel[];
  failedChannels: NotificationChannel[];
  isRead: boolean;
  readAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: { type: String, required: true, trim: true, index: true },
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },
    link: { type: String, trim: true, default: null },
    metadata: { type: Schema.Types.Mixed },
    channels: {
      type: [{ type: String, enum: ["inapp", "email", "sms"] }],
      default: ["inapp"],
    },
    deliveredChannels: {
      type: [{ type: String, enum: ["inapp", "email", "sms"] }],
      default: [],
    },
    failedChannels: {
      type: [{ type: String, enum: ["inapp", "email", "sms"] }],
      default: [],
    },
    isRead: { type: Boolean, default: false, index: true },
    readAt: { type: Date, default: null },
  },
  { timestamps: true },
);

NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

export const Notification: Model<INotification> =
  (mongoose.models.Notification as Model<INotification>) ||
  mongoose.model<INotification>("Notification", NotificationSchema);
