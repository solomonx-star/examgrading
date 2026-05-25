import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { Course } from "@/models/Course";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { StatCard } from "@/components/ui/StatCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { OnlineUsersCard } from "@/components/superadmin/OnlineUsersCard";
import { PostHogCard } from "@/components/superadmin/PostHogCard";

export const dynamic = "force-dynamic";

export default async function SuperAdminOverviewPage() {
  const session = await auth();
  if (session?.user?.role !== "superadmin") redirect("/");

  await connectDB();
  const [admins, lecturers, students, courses, current] = await Promise.all([
    User.countDocuments({ role: "admin", isActive: true }),
    User.countDocuments({ role: "lecturer", isActive: true }),
    User.countDocuments({ role: "student", isActive: true }),
    Course.countDocuments({ isActive: true }),
    AcademicPeriod.findOne({ isCurrent: true }).lean(),
  ]);

  const period = current
    ? `${current.year} — ${current.semester} semester`
    : "Not set";

  return (
    <div>
      <PageHeader
        title={`Welcome, ${session.user.name ?? "Super Admin"}`}
        description="System-wide overview of IAM CO Exam Management."
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active admins" value={admins} />
        <StatCard label="Active lecturers" value={lecturers} />
        <StatCard label="Active students" value={students} />
        <StatCard label="Active courses" value={courses} />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-stroke bg-white p-5 shadow-sm lg:col-span-2">
          <p className="text-xs font-medium uppercase tracking-wide text-body">
            Current academic period
          </p>
          <p className="mt-1 text-lg font-semibold text-foreground">{period}</p>
          <p className="mt-2 text-sm text-body">
            Manage admins, grading rules, and academic periods from the sidebar.
          </p>
        </div>
        <OnlineUsersCard />
      </div>
      <div className="mt-6">
        <PostHogCard />
      </div>
    </div>
  );
}
