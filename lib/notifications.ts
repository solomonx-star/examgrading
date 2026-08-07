// Server-only notification helpers. Writes never throw — sending a
// notification must never block the business action that triggered it.
//
// Channels are pluggable: an in-app channel that writes to the Notification
// collection is wired now; `email` (nodemailer) is wired via env vars,
// `sms` (twilio) is a stub for later.

import mongoose from "mongoose";
import nodemailer from "nodemailer";
import { connectDB } from "@/lib/db";
import { appUrl } from "@/lib/app-url";
import { User } from "@/models/User";
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

function getMailer() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM ?? "IAM Community College <no-reply@iamcc.edu.sl>";
  if (!host || !user || !pass) return null;
  return { transporter: nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } }), from };
}

const emailTransport: Transport = async (ctx) => {
  const mailer = getMailer();
  if (!mailer) return; // SMTP not configured — silently skip

  const user = await User.findById(ctx.payload.userId).select("email name").lean();
  if (!user?.email) return;

  const baseUrl = appUrl();
  const link = ctx.payload.link ? `${baseUrl}${ctx.payload.link}` : baseUrl;

  await mailer.transporter.sendMail({
    from: mailer.from,
    to: user.email,
    subject: ctx.payload.title,
    text: `${ctx.payload.body}\n\nView: ${link}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
        <h2 style="color:#1A56A0">${ctx.payload.title}</h2>
        <p>${ctx.payload.body}</p>
        <a href="${link}" style="display:inline-block;margin-top:12px;padding:10px 20px;background:#1A56A0;color:#fff;border-radius:8px;text-decoration:none">
          View on IAM Portal
        </a>
        <p style="margin-top:20px;font-size:12px;color:#64748b">
          IAM Community College · Freetown, Sierra Leone
        </p>
      </div>
    `,
  });
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
