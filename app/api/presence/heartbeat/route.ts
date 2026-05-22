import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  await connectDB();
  await User.updateOne(
    { _id: session.user.id },
    { $set: { lastActiveAt: new Date() } },
  );
  return NextResponse.json({ ok: true });
}
