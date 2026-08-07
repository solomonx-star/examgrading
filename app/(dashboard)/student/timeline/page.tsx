import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { requireActiveStudentAccess } from "@/lib/student-scope";
import { Course } from "@/models/Course";
import { Grade } from "@/models/Grade";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { PageHeader } from "@/components/ui/PageHeader";
import { averageGPA } from "@/lib/student-data";

export const dynamic = "force-dynamic";

const PASS_GPA = 2.9;
const semesterOrder = { First: 1, Second: 2, Summer: 3 } as const;

function gpaColor(gpa: number | null) {
  if (gpa === null) return "text-body";
  return gpa >= PASS_GPA ? "text-meta-3" : "text-meta-1";
}

export default async function AcademicTimelinePage() {
  const me = await requireActiveStudentAccess();
  await connectDB();

  const meOid = new mongoose.Types.ObjectId(me.userId);

  const [modules, grades, periods] = await Promise.all([
    Course.find({ enrolledStudents: meOid })
      .select("code name academicYear semester yearLevel")
      .lean(),
    Grade.find({ studentId: meOid, isPublished: true })
      .select("courseId academicYear semester calculatedGrade calculatedGPA calculatedScore calculatedRemark")
      .lean(),
    AcademicPeriod.find({}).select("year semester isCurrent startDate endDate").sort({ year: 1, semester: 1 }).lean(),
  ]);

  const gradesByCourse = new Map(grades.map((g) => [String(g.courseId), g]));
  const currentPeriod = periods.find((p) => p.isCurrent);

  // Group modules by (academicYear, semester)
  type PeriodEntry = {
    academicYear: string;
    semester: "First" | "Second" | "Summer";
    isCurrent: boolean;
    moduleRows: Array<{
      id: string;
      code: string;
      name: string;
      grade: string | null;
      gpa: number | null;
      score: number | null;
      remark: string | null;
    }>;
  };

  const periodMap = new Map<string, PeriodEntry>();
  for (const m of modules) {
    const key = `${m.academicYear}::${m.semester}`;
    const existing = periodMap.get(key);
    const grade = gradesByCourse.get(String(m._id));
    const row = {
      id: String(m._id),
      code: m.code,
      name: m.name,
      grade: grade?.calculatedGrade ?? null,
      gpa: grade?.calculatedGPA ?? null,
      score: grade?.calculatedScore ?? null,
      remark: grade?.calculatedRemark ?? null,
    };
    if (existing) {
      existing.moduleRows.push(row);
    } else {
      periodMap.set(key, {
        academicYear: m.academicYear,
        semester: m.semester as "First" | "Second" | "Summer",
        isCurrent:
          !!currentPeriod &&
          currentPeriod.year === m.academicYear &&
          currentPeriod.semester === m.semester,
        moduleRows: [row],
      });
    }
  }

  const sortedPeriods = [...periodMap.values()].sort((a, b) => {
    if (a.academicYear !== b.academicYear)
      return b.academicYear < a.academicYear ? -1 : 1;
    return (
      (semesterOrder[b.semester] ?? 0) - (semesterOrder[a.semester] ?? 0)
    );
  });

  return (
    <div>
      <PageHeader
        title="Academic timeline"
        description="Your full academic history across all semesters."
        action={{ href: "/student/transcript", label: "View transcript" }}
      />

      {sortedPeriods.length === 0 ? (
        <div className="rounded-2xl border border-stroke bg-white p-6 text-center text-sm text-body shadow-sm">
          No modules enrolled yet.
        </div>
      ) : (
        <div className="relative pl-8">
          <div className="absolute left-3.5 top-0 h-full w-px bg-stroke" />
          {sortedPeriods.map((period, idx) => {
            const periodGPA = averageGPA(period.moduleRows);
            return (
              <div key={`${period.academicYear}::${period.semester}`} className="relative mb-8">
                <span className="absolute -left-8 top-0 flex h-7 w-7 items-center justify-center rounded-full border-2 border-stroke bg-white text-xs font-bold text-foreground">
                  {sortedPeriods.length - idx}
                </span>
                <div className={`rounded-2xl border bg-white shadow-sm ${
                  period.isCurrent ? "border-primary/40" : "border-stroke"
                }`}>
                  <div className={`flex flex-wrap items-center justify-between gap-3 rounded-t-2xl border-b px-5 py-3 ${
                    period.isCurrent ? "border-primary/20 bg-primary/5" : "border-stroke bg-whiter"
                  }`}>
                    <div>
                      <span className="text-sm font-semibold text-foreground">
                        {period.academicYear} · {period.semester} Semester
                      </span>
                      {period.isCurrent && (
                        <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-white">
                          Current
                        </span>
                      )}
                    </div>
                    {periodGPA.gpa !== null && (
                      <span className={`text-sm font-bold ${gpaColor(periodGPA.gpa)}`}>
                        GPA {periodGPA.gpa.toFixed(2)}
                      </span>
                    )}
                  </div>

                  <ul className="divide-y divide-stroke text-sm">
                    {period.moduleRows
                      .sort((a, b) => a.code.localeCompare(b.code))
                      .map((row) => (
                        <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 hover:bg-whiter">
                          <div className="min-w-0">
                            <span className="font-mono text-xs font-semibold text-foreground">{row.code}</span>
                            <span className="ml-2 text-body">{row.name}</span>
                          </div>
                          {row.grade ? (
                            <div className="flex items-center gap-3 text-xs">
                              <span className="text-body">{row.score?.toFixed(1)}%</span>
                              <span className={`font-bold ${gpaColor(row.gpa)}`}>{row.grade}</span>
                              <span className="text-body">GPA {row.gpa?.toFixed(1) ?? "—"}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-body">Pending</span>
                          )}
                        </li>
                      ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
