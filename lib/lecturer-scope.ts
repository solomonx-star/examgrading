import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export type LecturerScope = {
  userId: string;
  name: string;
  email: string;
};

export async function requireLecturerScope(): Promise<LecturerScope> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "lecturer") redirect("/");
  return {
    userId: session.user.id,
    name: session.user.name ?? "",
    email: session.user.email ?? "",
  };
}
