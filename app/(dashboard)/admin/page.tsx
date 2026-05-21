import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { Module } from "@/models/Module";
import { Programme } from "@/models/Programme";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { requireAdminScope } from "@/lib/admin-scope";
import { StatCard } from "@/components/ui/StatCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { DepartmentSnapshotChart } from "@/components/charts/DepartmentSnapshotChart";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const me = await requireAdminScope();
  await connectDB();

  const programmes = await Programme.find({ department: me.department })
    .select("_id")
    .lean();
  const programmeIds = programmes.map((p) => p._id);

  const [students, lecturers, modules, current, programmeCount] =
    await Promise.all([
      User.countDocuments({
        role: "student",
        department: me.department,
        isActive: true,
      }),
      User.countDocuments({
        role: "lecturer",
        department: me.department,
        isActive: true,
      }),
      Module.countDocuments({
        programmeId: { $in: programmeIds },
        isActive: true,
      }),
      AcademicPeriod.findOne({ isCurrent: true }).lean(),
      Promise.resolve(programmes.length),
    ]);

  const period = current
    ? `${current.year} — ${current.semester} semester`
    : "Not set";

  return (
    <div>
      <PageHeader
        title={`Welcome, ${me.name}`}
        description={`Department: ${me.department}`}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active students" value={students} />
        <StatCard label="Active lecturers" value={lecturers} />
        <StatCard label="Programmes" value={programmeCount} />
        <StatCard label="Active modules" value={modules} />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-stroke bg-white p-5 shadow-sm lg:col-span-2">
          <p className="text-xs font-medium uppercase tracking-wide text-body">
            Department snapshot
          </p>
          <p className="mt-1 mb-2 text-sm text-body">
            Active records in {me.department}.
          </p>
          <DepartmentSnapshotChart
            students={students}
            lecturers={lecturers}
            programmes={programmeCount}
            modules={modules}
          />
        </div>
        <div className="rounded-2xl border border-stroke bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-body">
            Current academic period
          </p>
          <p className="mt-1 text-lg font-semibold text-foreground">{period}</p>
          <p className="mt-2 text-sm text-body">
            Use the sidebar to manage programmes, modules, students, and grade
            reviews for your department.
          </p>
        </div>
      </div>
    </div>
  );
}
