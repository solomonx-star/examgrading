import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";

export type AdminScope = {
  userId: string;
  name: string;
  email: string;
};

/**
 * Loads the current admin's session. Redirects to /login or / if the caller
 * is not an active admin.
 */
export async function requireAdminScope(): Promise<AdminScope> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "admin") redirect("/");

  await connectDB();
  const me = await User.findById(session.user.id)
    .select("name email isActive")
    .lean();
  if (!me || !me.isActive) redirect("/login");

  return {
    userId: session.user.id,
    name: me.name,
    email: me.email,
  };
}
