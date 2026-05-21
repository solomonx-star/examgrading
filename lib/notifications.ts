// Server-only notification helpers. Writes never throw — sending a
// notification must never block the business action that triggered it.
//
// Channels are pluggable: an in-app channel that writes to the Notification
// collection is wired now; `email` (nodemailer) and `sms` (twilio) are
// stub transports that will be filled in later. To wire a real sender,
// replace the entry in TRANSPORTS for that channel.

import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import {
  Notification,
  type INotification,
  type NotificationChannel,
} from "@/models/Notification";

export type NotificationPayload = {
  userId: string;
  type: string;
  title: string;
  body: string;
  link?: string | null;
  metadata?: Record<string, unknown>;
  channels?: NotificationChannel[];
};

export type DeliveryContext = {
  payload: NotificationPayload;
  notificationId?: string;
};

export type Transport = (ctx: DeliveryContext) => Promise<void>;

// In-app transport is a no-op here: the Notification row IS the in-app
// delivery, written once per recipient by `notify` / `notifyMany` before
// transports run. We still register it so `deliveredChannels` is consistent.
const inappTransport: Transport = async () => {};

// Stubs for later. Replace with real implementations (nodemailer / twilio)
// without touching call sites.
const emailTransport: Transport = async () => {
  // TODO: wire up nodemailer here. Look up the user's email by
  // ctx.payload.userId, then send a templated message.
};

const smsTransport: Transport = async () => {
  // TODO: wire up Twilio here. Look up the user's phone (add field to User
  // when ready), then send an SMS.
};

const TRANSPORTS: Record<NotificationChannel, Transport> = {
  inapp: inappTransport,
  email: emailTransport,
  sms: smsTransport,
};

function isObjectId(id: string): boolean {
  return mongoose.Types.ObjectId.isValid(id);
}

async function deliver(
  channels: NotificationChannel[],
  ctx: DeliveryContext,
): Promise<{
  delivered: NotificationChannel[];
  failed: NotificationChannel[];
}> {
  const delivered: NotificationChannel[] = [];
  const failed: NotificationChannel[] = [];
  await Promise.all(
    channels.map(async (ch) => {
      try {
        await TRANSPORTS[ch](ctx);
        delivered.push(ch);
      } catch (err) {
        failed.push(ch);
        // eslint-disable-next-line no-console
        console.error(`notification transport ${ch} failed:`, err);
      }
    }),
  );
  return { delivered, failed };
}

/** Send a notification to one user across the chosen channels. */
export async function notify(payload: NotificationPayload): Promise<void> {
  try {
    if (!isObjectId(payload.userId)) return;
    await connectDB();
    const channels = payload.channels ?? ["inapp"];
    const doc = await Notification.create({
      userId: new mongoose.Types.ObjectId(payload.userId),
      type: payload.type,
      title: payload.title,
      body: payload.body,
      link: payload.link ?? null,
      metadata: payload.metadata,
      channels,
      deliveredChannels: [],
      failedChannels: [],
    });
    const { delivered, failed } = await deliver(channels, {
      payload,
      notificationId: String(doc._id),
    });
    await Notification.updateOne(
      { _id: doc._id },
      { $set: { deliveredChannels: delivered, failedChannels: failed } },
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("notify failed:", err);
  }
}

/**
 * Fan a single notification out to multiple users. The DB inserts use
 * `insertMany` so this stays cheap for large cohorts.
 */
export async function notifyMany(
  userIds: string[],
  base: Omit<NotificationPayload, "userId">,
): Promise<void> {
  try {
    const ids = userIds.filter(isObjectId);
    if (ids.length === 0) return;
    await connectDB();
    const channels = base.channels ?? ["inapp"];
    const docs = ids.map((uid) => ({
      userId: new mongoose.Types.ObjectId(uid),
      type: base.type,
      title: base.title,
      body: base.body,
      link: base.link ?? null,
      metadata: base.metadata,
      channels,
      deliveredChannels: [],
      failedChannels: [],
    }));
    const inserted = await Notification.insertMany(docs, { ordered: false });
    await Promise.all(
      inserted.map(async (doc) => {
        const { delivered, failed } = await deliver(channels, {
          payload: { ...base, userId: String(doc.userId) },
          notificationId: String(doc._id),
        });
        await Notification.updateOne(
          { _id: doc._id },
          { $set: { deliveredChannels: delivered, failedChannels: failed } },
        );
      }),
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("notifyMany failed:", err);
  }
}

export type NotificationView = {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  isRead: boolean;
  createdAt: Date;
};

function toView(doc: INotification): NotificationView {
  return {
    id: String(doc._id),
    type: doc.type,
    title: doc.title,
    body: doc.body,
    link: doc.link ?? null,
    isRead: doc.isRead,
    createdAt: doc.createdAt,
  };
}

export async function getRecentNotifications(
  userId: string,
  limit = 10,
): Promise<NotificationView[]> {
  if (!isObjectId(userId)) return [];
  await connectDB();
  const docs = await Notification.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean<INotification[]>();
  return docs.map(toView);
}

export async function getUnreadCount(userId: string): Promise<number> {
  if (!isObjectId(userId)) return 0;
  await connectDB();
  return Notification.countDocuments({ userId, isRead: false });
}
