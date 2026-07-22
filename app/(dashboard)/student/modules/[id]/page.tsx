import Link from "next/link";
import mongoose from "mongoose";
import { notFound } from "next/navigation";
import { connectDB } from "@/lib/db";
import { Course } from "@/models/Course";
import { Programme } from "@/models/Programme";
import { Attendance } from "@/models/Attendance";
import { Grade } from "@/models/Grade";
import { Test } from "@/models/Test";
import { TestSubmission } from "@/models/TestSubmission";
import { User } from "@/models/User";
import { requireActiveStudentAccess } from "@/lib/student-scope";
import { getEffectiveGradingRule } from "@/lib/grading-server";
import { PageHeader } from "@/components/ui/PageHeader";
import { AutoRefresh } from "@/components/ui/AutoRefresh";

export const dynamic = "force-dynamic";

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const statusLabel: Record<"present" | "absent" | "late", string> = {
  present: "Present",
  absent: "Absent",
  late: "Late",
};

const statusClass: Record<"present" | "absent" | "late", string> = {
  present: "bg-meta-3/10 text-meta-3",
  absent: "bg-meta-1/10 text-meta-1",
  late: "bg-secondary/20 text-foreground",
};

export default async function StudentModulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requireActiveStudentAccess();
  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) notFound();

  await connectDB();
  const meOid = new mongoose.Types.ObjectId(me.userId);
  const mod = await Course.findOne({
    _id: id,
    enrolledStudents: meOid,
  }).lean();
  if (!mod) notFound();

  // For a shared module, prefer the student's own programme label when present.
  const modProgrammeIds = mod.programmeIds ?? [];
  const ownProgrammeOid = me.programmeId
    ? new mongoose.Types.ObjectId(me.programmeId)
    : null;
  const displayProgrammeOid =
    ownProgrammeOid &&
    modProgrammeIds.some((pid) => String(pid) === String(ownProgrammeOid))
      ? ownProgrammeOid
      : (modProgrammeIds[0] ?? null);

  const [lecturer, programme, attendance, grade, rule, openTests, mySubmissions] = await Promise.all([
    mod.lecturerId
      ? User.findById(mod.lecturerId).select("name email").lean()
      : Promise.resolve(null),
    displayProgrammeOid
      ? Programme.findById(displayProgrammeOid).select("name code").lean()
      : Promise.resolve(null),
    Attendance.find({
      courseId: mod._id,
      studentId: meOid,
    })
      .select("date status notes")
      .sort({ date: -1 })
      .lean(),
    Grade.findOne({
      courseId: mod._id,
      studentId: meOid,
      isPublished: true,
    }).lean(),
    getEffectiveGradingRule(id),
    Test.countDocuments({
      courseId: mod._id,
      isPublished: true,
    }),
    TestSubmission.countDocuments({
      courseId: mod._id,
      studentId: meOid,
      status: "submitted",
    }),
  ]);

  const total = attendance.length;
  const present = attendance.filter((a) => a.status === "present").length;
  const absent = attendance.filter((a) => a.status === "absent").length;
  const late = attendance.filter((a) => a.status === "late").length;
  const pct = total > 0 ? Math.round((present / total) * 100) : null;
  const meetsThreshold =
    rule && pct !== null ? pct >= rule.attendanceThreshold : null;

  const programmeLabel = programme ? ` · ${programme.name}` : "";
  const yearLabel = ` · Year ${mod.yearLevel}`;

  return (
    <div>
      <AutoRefresh intervalMs={30_000} />
      <PageHeader
        title={`${mod.code} — ${mod.name}`}
        description={`${mod.academicYear} · ${mod.semester}${programmeLabel}${yearLabel}`}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-stroke bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-body">
            Lecturer
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {lecturer ? lecturer.name : "Not assigned"}
          </p>
          {lecturer ? (
            <p className="text-xs text-body">{lecturer.email}</p>
          ) : null}
        </div>
        <div className="rounded-2xl border border-stroke bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-body">
            Attendance
          </p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {pct === null ? "—" : `${pct}%`}
          </p>
          <p className="text-xs text-body">
            {present} present · {absent} absent · {late} late
          </p>
          {meetsThreshold === false && rule ? (
            <p className="mt-1 text-xs font-medium text-meta-1">
              Below required {rule.attendanceThreshold}%
            </p>
          ) : null}
        </div>
        <div className="rounded-2xl border border-stroke bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-body">
            Final grade
          </p>
          {grade ? (
            <>
              <p className="mt-1 text-2xl font-bold text-foreground">
                {grade.calculatedGrade ?? "—"}
              </p>
              <p className="text-xs text-body">
                {grade.calculatedScore?.toFixed(2) ?? "—"} ·
                GPA {grade.calculatedGPA?.toFixed(1) ?? "—"}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-body">
              Not yet published by Exams Office.
            </p>
          )}
        </div>
      </div>

      <section className="mb-6 rounded-2xl border border-stroke bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Tests</h2>
            <p className="text-xs text-body">
              {openTests === 0
                ? "No tests have been published for this module yet."
                : `${openTests} published · ${mySubmissions} submitted by you`}
            </p>
          </div>
          {openTests > 0 ? (
            <Link
              href={`/student/modules/${id}/tests`}
              className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-dark"
            >
              View tests
            </Link>
          ) : null}
        </div>
      </section>

      {grade ? (
        <section className="mb-6 rounded-2xl border border-stroke bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            Grade breakdown
          </h2>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-body">
              <tr>
                <th className="py-2">Component</th>
                <th className="py-2">Score</th>
                <th className="py-2 text-right">Weight</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stroke">
              <tr>
                <td className="py-2">Test</td>
                <td className="py-2 font-medium text-foreground">
                  {grade.testScore ?? 0} / {grade.testMaxScore ?? 100}
                </td>
                <td className="py-2 text-right text-body">
                  {rule ? `${rule.caWeight}%` : "30%"}
                </td>
              </tr>
              <tr>
                <td className="py-2">Exam</td>
                <td className="py-2 font-medium text-foreground">
                  {grade.examScore} / {grade.examMaxScore}
                </td>
                <td className="py-2 text-right text-body">
                  {rule ? `${rule.examWeight}%` : "70%"}
                </td>
              </tr>
              <tr>
                <td className="py-2 font-semibold">Total</td>
                <td className="py-2 font-semibold text-foreground">
                  {grade.calculatedScore?.toFixed(2) ?? "—"}%
                </td>
                <td className="py-2 text-right font-semibold text-foreground">
                  {grade.calculatedGrade ?? "—"}
                  {grade.calculatedRemark ? ` · ${grade.calculatedRemark}` : ""}
                </td>
              </tr>
            </tbody>
          </table>
          {grade.attendanceMet === false ? (
            <p className="mt-3 text-xs font-medium text-meta-1">
              ⚠ Flagged for low attendance (below
              {rule ? ` ${rule.attendanceThreshold}%` : " required threshold"}).
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-2xl border border-stroke bg-white shadow-sm">
        <div className="border-b border-stroke px-5 py-3">
          <h2 className="text-sm font-semibold text-foreground">
            Attendance log
          </h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-whiter text-left text-xs uppercase tracking-wide text-body">
            <tr>
              <th className="px-5 py-3">Date</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stroke">
            {attendance.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="px-5 py-8 text-center text-sm text-body"
                >
                  No attendance recorded yet.
                </td>
              </tr>
            ) : (
              attendance.map((a, i) => {
                const s = a.status as "present" | "absent" | "late";
                return (
                  <tr key={i} className="hover:bg-whiter">
                    <td className="px-5 py-2.5 text-body">
                      {formatDate(a.date)}
                    </td>
                    <td className="px-5 py-2.5">
                      <span
                        className={
                          "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium " +
                          statusClass[s]
                        }
                      >
                        {statusLabel[s]}
                      </span>
                    </td>
                    <td className="px-5 py-2.5 text-body">{a.notes ?? "—"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>

      <Link
        href="/student/modules"
        className="mt-4 inline-block text-sm font-medium text-body hover:text-foreground"
      >
        ← All modules
      </Link>
    </div>
  );
}
