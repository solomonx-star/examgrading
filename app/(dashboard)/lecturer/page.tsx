import Link from "next/link";
import { connectDB } from "@/lib/db";
import { Course } from "@/models/Course";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { requireLecturerScope } from "@/lib/lecturer-scope";
import { StatCard } from "@/components/ui/StatCard";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default async function LecturerOverviewPage() {
  const me = await requireLecturerScope();
  await connectDB();

  const [courses, current] = await Promise.all([
    Course.find({ lecturerId: me.userId, isActive: true })
      .select("code name yearLevel enrolledStudents")
      .sort({ yearLevel: 1, code: 1 })
      .lean(),
    AcademicPeriod.findOne({ isCurrent: true }).lean(),
  ]);

  const enrolledTotal = courses.reduce(
    (sum, c) => sum + (c.enrolledStudents?.length ?? 0),
    0,
  );

  return (
    <div>
      <PageHeader
        title={`Welcome, ${me.name}`}
        description={
          current
            ? `Current period: ${current.year} · ${current.semester} semester`
            : "No current academic period set"
        }
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Assigned courses" value={courses.length} />
        <StatCard label="Total students enrolled" value={enrolledTotal} />
      </div>

      {courses.length > 0 ? (
        <div className="mt-6 rounded-2xl border border-stroke bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Your courses</h2>
            <Link
              href="/lecturer/modules"
              className="text-xs font-medium text-primary hover:underline"
            >
              View all →
            </Link>
          </div>
          <ul className="divide-y divide-stroke text-sm">
            {courses.slice(0, 6).map((c) => (
              <li
                key={String(c._id)}
                className="flex items-center justify-between py-2"
              >
                <div>
                  <span className="font-mono text-xs text-foreground">
                    {c.code}
                  </span>
                  <span className="mx-2 text-body">·</span>
                  <span className="text-foreground">{c.name}</span>
                  <span className="ml-2 text-xs text-body">
                    Year {c.yearLevel}
                  </span>
                </div>
                <Link
                  href={`/lecturer/modules/${String(c._id)}`}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Open
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
