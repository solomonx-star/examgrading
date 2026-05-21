import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getRecentNotifications,
  getUnreadCount,
} from "@/lib/notifications";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const [items, unread] = await Promise.all([
    getRecentNotifications(session.user.id, 10),
    getUnreadCount(session.user.id),
  ]);
  return NextResponse.json(
    {
      unread,
      items: items.map((n) => ({
        ...n,
        createdAt: n.createdAt.toISOString(),
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
