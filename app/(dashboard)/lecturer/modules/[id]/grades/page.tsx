import Link from "next/link";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { Grade } from "@/models/Grade";
import { requireLecturerCourse } from "@/lib/lecturer-course";
import { PageHeader } from "@/components/ui/PageHeader";
import { AutoRefresh } from "@/components/ui/AutoRefresh";
import { getEffectiveGradingRule } from "@/lib/grading-server";
import { computeAttendanceStatsForCourse } from "@/lib/grade-engine";
import { GradeSheet } from "./grade-sheet";

export const dynamic = "force-dynamic";

export default async function LecturerGradesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { course: mod } = await requireLecturerCourse(id);

  await connectDB();
  const [students, existingGrades, rule] = await Promise.all([
    User.find({ _id: { $in: mod.enrolledStudents } })
      .select("name studentId isActive")
      .sort({ name: 1 })
      .lean(),
    Grade.find({
      courseId: mod._id,
      academicYear: mod.academicYear,
      semester: mod.semester,
    }).lean(),
    getEffectiveGradingRule(id),
  ]);

  if (!rule) {
    return (
      <div>
        <PageHeader
          title="Grades"
          description={`${mod.code} — ${mod.name}`}
        />
        <div className="rounded-2xl border border-meta-1/30 bg-meta-1/10 p-4 text-sm text-meta-1">
          No grading rule is attached to this module and there is no global
          default. Ask your department admin to configure one before entering
          grades.
        </div>
        <Link
          href={`/lecturer/modules/${id}`}
          className="mt-4 inline-block text-sm font-medium text-body hover:text-foreground"
        >
          ← Back to module
        </Link>
      </div>
    );
  }

  const gradeByStudent = new Map(
    existingGrades.map((g) => [String(g.studentId), g]),
  );

  const anySubmitted = existingGrades.some(
    (g) => g.submissionStatus === "submitted",
  );
  const anyPublished = existingGrades.some((g) => g.isPublished);

  // If any saved grade used testMaxScore === caWeight, the lecturer is in
  // pre-calculated mode. Default to raw otherwise.
  const initialTestMode: "raw" | "precalc" = existingGrades.some(
    (g) => g.testMaxScore === rule.caWeight,
  )
    ? "precalc"
    : "raw";

  const attendanceByStudent = await computeAttendanceStatsForCourse(
    id,
    students.map((s) => String(s._id)),
  );

  return (
    <div>
      <AutoRefresh intervalMs={30_000} />
      <PageHeader
        title="Grades"
        description={`${mod.code} — ${mod.name} · Year ${mod.yearLevel} · ${rule.caWeight}% test + ${rule.examWeight}% exam`}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-body">
          Attendance minimum {rule.attendanceThreshold}%. Students below the
          threshold are flagged automatically on save.
        </p>
        <div className="flex items-center gap-4">
          <Link
            href={`/lecturer/modules/${id}/print`}
            className="text-sm font-medium text-body hover:text-foreground"
          >
            Print sheet →
          </Link>
          <Link
            href={`/lecturer/modules/${id}`}
            className="text-sm font-medium text-body hover:text-foreground"
          >
            ← Module overview
          </Link>
        </div>
      </div>

      {anySubmitted ? (
        <div className="mb-4 rounded-2xl border border-secondary/40 bg-secondary/10 p-4 text-sm text-foreground">
          <strong>Locked.</strong> These grades have been submitted to the
          admin for review. {anyPublished
            ? "Some have already been published — recall is no longer possible."
            : "Recall the submission below if you need to edit further."}
        </div>
      ) : null}

      <GradeSheet
        courseId={id}
        rule={{
          caWeight: rule.caWeight,
          examWeight: rule.examWeight,
          attendanceThreshold: rule.attendanceThreshold,
          gradeScale: rule.gradeScale,
        }}
        anySubmitted={anySubmitted}
        anyPublished={anyPublished}
        initialTestMode={initialTestMode}
        students={students.map((s) => {
          const sid = String(s._id);
          const g = gradeByStudent.get(sid);
          const att = attendanceByStudent.get(sid) ?? {
            total: 0,
            present: 0,
            pct: null,
          };
          return {
            id: sid,
            name: s.name as string,
            studentId: s.studentId ?? "",
            inactive: !s.isActive,
            attendancePct: att.pct,
            attendanceTotal: att.total,
            existing: g
              ? {
                  testScore: g.testScore ?? 0,
                  examScore: g.examScore ?? 0,
                  submissionStatus: g.submissionStatus,
                  isPublished: g.isPublished,
                  calculatedGrade: g.calculatedGrade ?? null,
                  attendanceMet:
                    typeof g.attendanceMet === "boolean"
                      ? g.attendanceMet
                      : null,
                }
              : null,
          };
        })}
      />
    </div>
  );
}
