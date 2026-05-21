import Link from "next/link";
import { connectDB } from "@/lib/db";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { requireActiveStudentAccess } from "@/lib/student-scope";
import {
  averageGPA,
  getAttendanceStatsForStudent,
  getEnrolledModules,
  getPublishedGradesForStudent,
} from "@/lib/student-data";
import { StatCard } from "@/components/ui/StatCard";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default async function StudentOverviewPage() {
  const me = await requireActiveStudentAccess();
  await connectDB();

  const [modules, current, grades] = await Promise.all([
    getEnrolledModules(me.userId),
    AcademicPeriod.findOne({ isCurrent: true }).lean(),
    getPublishedGradesForStudent(me.userId),
  ]);

  const moduleById = new Map(modules.map((m) => [m.id, m]));
  const gradeRows = grades
    .map((g) => {
      const m = moduleById.get(String(g.courseId));
      if (!m) return null;
      return {
        gpa: g.calculatedGPA ?? null,
        academicYear: g.academicYear,
        semester: g.semester,
      };
    })
    .filter((g): g is NonNullable<typeof g> => g !== null);

  const cumulative = averageGPA(gradeRows);
  const currentRows = current
    ? gradeRows.filter(
        (g) => g.academicYear === current.year && g.semester === current.semester,
      )
    : [];
  const currentGPA = averageGPA(currentRows);

  const currentModules = current
    ? modules.filter(
        (m) =>
          m.academicYear === current.year && m.semester === current.semester,
      )
    : modules;

  const attStats = await getAttendanceStatsForStudent(
    me.userId,
    currentModules.map((m) => m.id),
  );
  let attendanceTotal = 0;
  let attendancePresent = 0;
  for (const s of attStats.values()) {
    attendanceTotal += s.total;
    attendancePresent += s.present;
  }
  const overallPct =
    attendanceTotal > 0
      ? Math.round((attendancePresent / attendanceTotal) * 100)
      : null;

  const yearLabel = me.yearLevel ? ` · Year ${me.yearLevel}` : "";
  const programmeLabel = me.programmeName ? ` · ${me.programmeName}` : "";

  return (
    <div>
      <PageHeader
        title={`Welcome, ${me.name}`}
        description={`${me.studentId ?? ""}${programmeLabel}${yearLabel}`}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Enrolled modules" value={modules.length} />
        <StatCard
          label="Current semester GPA"
          value={currentGPA.gpa === null ? "—" : currentGPA.gpa.toFixed(2)}
          hint={current ? `${current.year} · ${current.semester}` : undefined}
        />
        <StatCard
          label="Cumulative GPA"
          value={cumulative.gpa === null ? "—" : cumulative.gpa.toFixed(2)}
          hint={`${cumulative.count} module${cumulative.count === 1 ? "" : "s"}`}
        />
        <StatCard
          label="Attendance (this semester)"
          value={overallPct === null ? "—" : `${overallPct}%`}
          hint={`${attendanceTotal} session${attendanceTotal === 1 ? "" : "s"}`}
        />
      </div>

      <div className="mt-6 rounded-2xl border border-stroke bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            Current modules
          </h2>
          <Link
            href="/student/modules"
            className="text-xs font-medium text-primary hover:underline"
          >
            View all →
          </Link>
        </div>
        {currentModules.length === 0 ? (
          <p className="text-sm text-body">
            You are not enrolled in any modules for the current period.
          </p>
        ) : (
          <ul className="divide-y divide-stroke text-sm">
            {currentModules.slice(0, 6).map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between py-2"
              >
                <div>
                  <span className="font-mono text-xs text-foreground">
                    {m.code}
                  </span>
                  <span className="mx-2 text-body">·</span>
                  <span className="text-foreground">{m.name}</span>
                </div>
                <Link
                  href={`/student/modules/${m.id}`}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Open
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
