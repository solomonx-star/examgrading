import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ONLINE_WINDOW_MS = 2 * 60 * 1000;

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "superadmin") {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  await connectDB();
  const cutoff = new Date(Date.now() - ONLINE_WINDOW_MS);
  const users = await User.find({
    isActive: true,
    lastActiveAt: { $gte: cutoff },
  })
    .select("name email role lastActiveAt")
    .sort({ lastActiveAt: -1 })
    .limit(50)
    .lean();

  return NextResponse.json({
    ok: true,
    users: users.map((u) => ({
      id: String(u._id),
      name: u.name,
      email: u.email,
      role: u.role,
      lastActiveAt: u.lastActiveAt
        ? new Date(u.lastActiveAt).toISOString()
        : null,
    })),
  });
}
