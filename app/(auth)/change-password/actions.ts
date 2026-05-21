"use server";

import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";

export type ChangePasswordState = { error?: string; ok?: boolean } | undefined;

export async function changePasswordAction(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (!current || !next || !confirm) {
    return { error: "All fields are required." };
  }
  if (next.length < 8) {
    return { error: "New password must be at least 8 characters." };
  }
  if (next !== confirm) {
    return { error: "New password and confirmation do not match." };
  }
  if (next === current) {
    return { error: "New password must differ from current password." };
  }

  await connectDB();
  const user = await User.findById(session.user.id).select(
    "+password password mustChangePassword",
  );
  if (!user) return { error: "Account not found." };

  const ok = await user.comparePassword(current);
  if (!ok) return { error: "Current password is incorrect." };

  user.password = next; // pre-save hook hashes it
  user.mustChangePassword = false;
  await user.save();

  // Sign out so the JWT (which still has mustChangePassword=true) is invalidated.
  // signOut throws NEXT_REDIRECT — let it propagate.
  await signOut({ redirectTo: "/login?changed=1" });
  return undefined;
}
