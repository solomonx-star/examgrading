import Link from "next/link";
import { connectDB } from "@/lib/db";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { requireActiveStudentAccess } from "@/lib/student-scope";
import {
  averageGPA,
  getEnrolledModules,
  getPublishedGradesForStudent,
} from "@/lib/student-data";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { StudentGradeCharts } from "@/components/charts/StudentGradeCharts";

export const dynamic = "force-dynamic";

type Row = {
  moduleId: string;
  code: string;
  name: string;
  academicYear: string;
  semester: "First" | "Second" | "Summer";
  score: number | null;
  grade: string | null;
  gpa: number | null;
  remark: string | null;
};

function periodKey(year: string, semester: string) {
  return `${year}::${semester}`;
}

export default async function StudentGradesPage() {
  const me = await requireActiveStudentAccess();
  await connectDB();

  const [modules, grades, current] = await Promise.all([
    getEnrolledModules(me.userId),
    getPublishedGradesForStudent(me.userId),
    AcademicPeriod.findOne({ isCurrent: true }).lean(),
  ]);

  const moduleById = new Map(modules.map((m) => [m.id, m]));

  const rows: Row[] = grades
    .map((g) => {
      const m = moduleById.get(String(g.courseId));
      if (!m) return null;
      return {
        moduleId: m.id,
        code: m.code,
        name: m.name,
        academicYear: g.academicYear,
        semester: g.semester,
        score: g.calculatedScore ?? null,
        grade: g.calculatedGrade ?? null,
        gpa: g.calculatedGPA ?? null,
        remark: g.calculatedRemark ?? null,
      };
    })
    .filter((r): r is Row => r !== null);

  // Group by period (year + semester), keep period order descending
  const byPeriod = new Map<string, Row[]>();
  for (const r of rows) {
    const k = periodKey(r.academicYear, r.semester);
    const arr = byPeriod.get(k) ?? [];
    arr.push(r);
    byPeriod.set(k, arr);
  }
  const sortedPeriods = [...byPeriod.entries()].sort((a, b) =>
    a[0] < b[0] ? 1 : -1,
  );

  const cumulative = averageGPA(rows);
  const currentRows = current
    ? rows.filter(
        (r) => r.academicYear === current.year && r.semester === current.semester,
      )
    : [];
  const currentGPA = averageGPA(currentRows);

  return (
    <div>
      <PageHeader
        title="Grades & transcript"
        description="Only grades that your lecturer has published appear here."
        action={{ href: "/student/transcript", label: "View transcript" }}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Current semester GPA"
          value={currentGPA.gpa === null ? "—" : currentGPA.gpa.toFixed(2)}
          hint={
            current
              ? `${current.year} · ${current.semester}`
              : "No current period"
          }
        />
        <StatCard
          label="Cumulative GPA"
          value={cumulative.gpa === null ? "—" : cumulative.gpa.toFixed(2)}
          hint={`${cumulative.count} module${cumulative.count === 1 ? "" : "s"}`}
        />
        <StatCard label="Published modules" value={rows.length} />
      </div>

      {rows.length > 0 && (
        <StudentGradeCharts
          grades={rows.map((r) => ({ grade: r.grade }))}
          gpaTrend={[...sortedPeriods]
            .reverse()
            .map(([key, periodRows]) => {
              const [year, semester] = key.split("::");
              const { gpa } = averageGPA(periodRows);
              return gpa === null
                ? null
                : { label: `${year} ${semester[0]}`, gpa };
            })
            .filter((p): p is { label: string; gpa: number } => p !== null)}
        />
      )}

      {sortedPeriods.length === 0 ? (
        <div className="rounded-2xl border border-stroke bg-white p-6 text-center text-sm text-body shadow-sm">
          No published grades yet.
        </div>
      ) : (
        <div className="space-y-6">
          {sortedPeriods.map(([key, periodRows]) => {
            const [year, semester] = key.split("::");
            const pgpa = averageGPA(periodRows);
            return (
              <section
                key={key}
                className="overflow-x-auto rounded-2xl border border-stroke bg-white shadow-sm"
              >
                <div className="flex items-center justify-between border-b border-stroke px-5 py-3">
                  <h2 className="text-sm font-semibold text-foreground">
                    {year} · {semester} semester
                  </h2>
                  <p className="text-xs text-body">
                    GPA{" "}
                    <span className="font-semibold text-foreground">
                      {pgpa.gpa === null ? "—" : pgpa.gpa.toFixed(2)}
                    </span>{" "}
                    · {pgpa.count} module{pgpa.count === 1 ? "" : "s"}
                  </p>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-whiter text-left text-xs uppercase tracking-wide text-body">
                    <tr>
                      <th className="px-5 py-3">Module</th>
                      <th className="hidden px-5 py-3 md:table-cell">Score</th>
                      <th className="px-5 py-3">Grade</th>
                      <th className="hidden px-5 py-3 sm:table-cell">Remarks</th>
                      <th className="px-5 py-3 text-right">GPA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stroke">
                    {periodRows.map((r) => (
                      <tr key={r.moduleId} className="hover:bg-whiter">
                        <td className="px-5 py-2.5">
                          <Link
                            href={`/student/modules/${r.moduleId}`}
                            className="font-medium text-foreground hover:text-primary"
                          >
                            <span className="font-mono text-xs">{r.code}</span>
                            <span className="mx-2 text-body">·</span>
                            {r.name}
                          </Link>
                        </td>
                        <td className="hidden px-5 py-2.5 text-body md:table-cell">
                          {r.score?.toFixed(2) ?? "—"}
                        </td>
                        <td className="px-5 py-2.5 text-foreground font-semibold">
                          {r.grade ?? "—"}
                        </td>
                        <td className="hidden px-5 py-2.5 text-body sm:table-cell">
                          {r.remark ?? "—"}
                        </td>
                        <td className="px-5 py-2.5 text-right text-body">
                          {r.gpa?.toFixed(2) ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
