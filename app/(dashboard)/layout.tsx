import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { NotificationBell } from "@/components/dashboard/NotificationBell";
import { ROLE_LABEL, ROLE_NAV } from "@/lib/nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.mustChangePassword) redirect("/change-password");

  const role = session.user.role;

  return (
    <DashboardShell
      navItems={ROLE_NAV[role]}
      roleLabel={ROLE_LABEL[role]}
      name={session.user.name ?? session.user.email ?? ""}
      email={session.user.email ?? ""}
      notificationBell={<NotificationBell userId={session.user.id} />}
    >
      {children}
    </DashboardShell>
  );
}
