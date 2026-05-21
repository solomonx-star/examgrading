import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";

export type AdminScope = {
  userId: string;
  name: string;
  email: string;
  department: string;
};

/**
 * Loads the current admin's session and resolves their `department` from the User
 * collection (the JWT does not carry department). Redirects to /login or / if the
 * caller is not an active admin or has no department set.
 */
export async function requireAdminScope(): Promise<AdminScope> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "admin") redirect("/");

  await connectDB();
  const me = await User.findById(session.user.id)
    .select("name email department isActive")
    .lean();
  if (!me || !me.isActive) redirect("/login");
  if (!me.department) {
    throw new Error(
      "Your admin account has no department assigned. Contact a super admin.",
    );
  }

  return {
    userId: session.user.id,
    name: me.name,
    email: me.email,
    department: me.department,
  };
}
