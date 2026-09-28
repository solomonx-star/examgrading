"use server";

import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { redirect } from "next/navigation";

export type ProfileState = { error?: string; ok?: boolean } | undefined;

export async function updateProfileAction(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  if (!name) return { error: "Name is required." };

  if (phone && !/^\+\d{7,15}$/.test(phone)) {
    return { error: "Phone must be in E.164 format, e.g. +23276000000." };
  }

  await connectDB();
  await User.findByIdAndUpdate(session.user.id, {
    name,
    phone: phone || undefined,
  });

  return { ok: true };
}
