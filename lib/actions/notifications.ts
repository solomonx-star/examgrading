"use server";

import mongoose from "mongoose";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Notification } from "@/models/Notification";

export async function markNotificationReadAction(
  notificationId: string,
): Promise<{ ok: boolean }> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { ok: false };
    if (!mongoose.Types.ObjectId.isValid(notificationId)) return { ok: false };
    await connectDB();
    await Notification.updateOne(
      { _id: notificationId, userId: session.user.id, isRead: false },
      { $set: { isRead: true, readAt: new Date() } },
    );
    revalidatePath("/", "layout");
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function markAllNotificationsReadAction(): Promise<{
  ok: boolean;
}> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { ok: false };
    await connectDB();
    await Notification.updateMany(
      { userId: session.user.id, isRead: false },
      { $set: { isRead: true, readAt: new Date() } },
    );
    revalidatePath("/", "layout");
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
