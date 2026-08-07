import Link from "next/link";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { GradingRule } from "@/models/GradingRule";
import { Test } from "@/models/Test";
import { requireActiveStudentAccess } from "@/lib/student-scope";
import {
  averageGPA,
  getAttendanceStatsForStudent,
  getEnrolledModules,
  getPublishedGradesForStudent,
} from "@/lib/student-data";
import { StatCard } from "@/components/ui/StatCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { AutoRefresh } from "@/components/ui/AutoRefresh";

export const dynamic = "force-dynamic";

export default async function StudentOverviewPage() {
  const me = await requireActiveStudentAccess();
  await connectDB();

  const [modules, current, grades, defaultRule] = await Promise.all([
    getEnrolledModules(me.userId),
    AcademicPeriod.findOne({ isCurrent: true }).lean(),
    getPublishedGradesForStudent(me.userId),
    GradingRule.findOne({ courseId: null }).select("attendanceThreshold").lean(),
  ]);

  const currentModuleIds = (current
    ? modules.filter(
        (m) => m.academicYear === current.year && m.semester === current.semester,
      )
    : modules
  ).map((m) => m.id);

  const now = new Date();
  const upcomingTests = currentModuleIds.length > 0
    ? await Test.find({
        courseId: { $in: currentModuleIds.map((id) => new mongoose.Types.ObjectId(id)) },
        isPublished: true,
        endsAt: { $gte: now },
      })
        .select("title courseId startsAt endsAt durationMinutes")
        .sort({ startsAt: 1 })
        .limit(5)
        .lean()
    : [];

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
        (m) => m.academicYear === current.year && m.semester === current.semester,
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

  const attendanceThreshold = defaultRule?.attendanceThreshold ?? 75;
  const lowAttendanceModules = currentModules.filter((m) => {
    const s = attStats.get(m.id);
    return s && s.total > 0 && s.pct !== null && s.pct < attendanceThreshold;
  });

  function formatTestTime(d: Date): string {
    return new Date(d).toLocaleString("en-GB", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  type Standing = "deans_list" | "good_standing" | "at_risk" | null;
  function getStanding(gpa: number | null): Standing {
    if (gpa === null) return null;
    if (gpa >= 3.5) return "deans_list";
    if (gpa >= 2.9) return "good_standing";
    return "at_risk";
  }

  const standingConfig = {
    deans_list: {
      label: "Dean's List",
      className: "bg-secondary/10 text-secondary border border-secondary/30",
    },
    good_standing: {
      label: "Good Standing",
      className: "bg-meta-3/10 text-meta-3 border border-meta-3/30",
    },
    at_risk: {
      label: "At Risk",
      className: "bg-meta-1/10 text-meta-1 border border-meta-1/30",
    },
  } as const;

  const standing = getStanding(cumulative.gpa);

  const gradedCount = currentRows.length;
  const totalModuleCount = currentModules.length;
  const gradingPct = totalModuleCount > 0
    ? Math.round((gradedCount / totalModuleCount) * 100)
    : null;
  const yearLabel = me.yearLevel ? ` · Year ${me.yearLevel}` : "";
  const programmeLabel = me.programmeName ? ` · ${me.programmeName}` : "";

  return (
    <div>
      <AutoRefresh intervalMs={60_000} />
      <PageHeader
        title={`Welcome, ${me.name}`}
        description={`${me.studentId ?? ""}${programmeLabel}${yearLabel}`}
      />
      {standing && (
        <div className="-mt-3 mb-4">
          <span
            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${standingConfig[standing].className}`}
          >
            {standingConfig[standing].label}
          </span>
        </div>
      )}
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

      {lowAttendanceModules.length > 0 && (
        <div className="mt-4 rounded-2xl border border-meta-1/30 bg-meta-1/5 p-4">
          <p className="text-sm font-semibold text-meta-1">
            Attendance warning — below {attendanceThreshold}% required
          </p>
          <ul className="mt-2 space-y-1">
            {lowAttendanceModules.map((m) => {
              const s = attStats.get(m.id)!;
              return (
                <li key={m.id} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">
                    <span className="font-mono text-xs">{m.code}</span>
                    {" — "}{m.name}
                  </span>
                  <Link
                    href={`/student/modules/${m.id}`}
                    className="ml-4 shrink-0 font-semibold text-meta-1 hover:underline"
                  >
                    {s.pct}%
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {upcomingTests.length > 0 && (
        <div className="mt-6 rounded-2xl border border-stroke bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">
              Upcoming tests
            </h2>
            <Link
              href="/student/tests"
              className="text-xs font-medium text-primary hover:underline"
            >
              View all →
            </Link>
          </div>
          <ul className="divide-y divide-stroke text-sm">
            {upcomingTests.map((t) => {
              const mod = moduleById.get(String(t.courseId));
              const isLive = new Date(t.startsAt) <= now;
              return (
                <li key={String(t._id)} className="flex items-start justify-between gap-4 py-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{t.title}</p>
                    <p className="text-xs text-body">
                      {mod ? `${mod.code} · ` : ""}
                      {isLive ? "Ends" : "Starts"} {formatTestTime(isLive ? t.endsAt : t.startsAt)}
                      {" · "}{t.durationMinutes} min
                    </p>
                  </div>
                  {isLive && (
                    <span className="shrink-0 rounded-full bg-meta-3/10 px-2 py-0.5 text-xs font-semibold text-meta-3">
                      Live
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {gradingPct !== null && totalModuleCount > 0 && (
        <div className="mt-6 rounded-2xl border border-stroke bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-semibold text-foreground">Grades released</span>
            <span className="text-body">
              {gradedCount} of {totalModuleCount} module{totalModuleCount === 1 ? "" : "s"}
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-stroke">
            <div
              className={`h-full rounded-full transition-all ${
                gradingPct === 100 ? "bg-meta-3" : "bg-primary"
              }`}
              style={{ width: `${gradingPct}%` }}
            />
          </div>
          {gradingPct === 100 ? (
            <p className="mt-1.5 text-xs text-meta-3">
              All grades have been published for this semester.
            </p>
          ) : (
            <p className="mt-1.5 text-xs text-body">
              {totalModuleCount - gradedCount} module{totalModuleCount - gradedCount === 1 ? "" : "s"} pending grading.
            </p>
          )}
        </div>
      )}

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
