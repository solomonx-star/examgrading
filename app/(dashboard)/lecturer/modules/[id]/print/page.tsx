import Link from "next/link";
import { Programme } from "@/models/Programme";
import { connectDB } from "@/lib/db";
import { requireLecturerCourse } from "@/lib/lecturer-course";
import { loadGradeReportRows } from "@/lib/report-data";
import { getEffectiveGradingRule } from "@/lib/grading-server";
import { PageHeader } from "@/components/ui/PageHeader";
import { PrintButton } from "@/components/ui/PrintButton";

export const dynamic = "force-dynamic";

export default async function LecturerGradeSheetPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Authorises the lecturer + 404s if the module isn't theirs
  const { me, course: mod } = await requireLecturerCourse(id);

  await connectDB();
  const [rows, rule, programmes] = await Promise.all([
    loadGradeReportRows(id),
    getEffectiveGradingRule(id),
    mod.programmeIds.length
      ? Programme.find({ _id: { $in: mod.programmeIds } })
          .select("name code")
          .lean()
      : Promise.resolve([] as { _id: unknown; name: string; code: string }[]),
  ]);
  const programmeNameById = new Map(
    programmes.map((p) => [String(p._id), p.name as string]),
  );
  const programmesLabel =
    mod.programmeIds
      .map((pid) => programmeNameById.get(String(pid)))
      .filter((n): n is string => !!n)
      .join(", ") || "—";

  const testWeight = rule?.caWeight ?? 30;
  const examWeight = rule?.examWeight ?? 70;

  function testWeighted(r: (typeof rows)[number]): string {
    if (r.testScore === null || r.testMaxScore === null || r.testMaxScore === 0)
      return "—";
    return ((r.testScore / r.testMaxScore) * testWeight).toFixed(2);
  }
  function examWeighted(r: (typeof rows)[number]): string {
    if (r.examScore === null || r.examMaxScore === null || r.examMaxScore === 0)
      return "—";
    return ((r.examScore / r.examMaxScore) * examWeight).toFixed(2);
  }

  const submitted = rows.filter(
    (r) => r.submissionStatus === "submitted",
  ).length;
  const published = rows.filter((r) => r.isPublished).length;

  return (
    <div className="print:bg-white">
      <div className="print:hidden">
        <PageHeader
          title="Grade sheet (your copy)"
          description={`${mod.code} — ${mod.name} · ${mod.academicYear} · ${mod.semester}`}
        />
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <PrintButton label="Print / Save as PDF" />
          <Link
            href={`/lecturer/modules/${id}/grades`}
            className="text-sm font-medium text-body hover:text-foreground"
          >
            ← Back to grade entry
          </Link>
          <Link
            href={`/lecturer/modules/${id}`}
            className="text-sm font-medium text-body hover:text-foreground"
          >
            Module overview
          </Link>
          <p className="ml-auto text-xs text-body">
            {published} published · {submitted} submitted ·{" "}
            {rows.length - submitted - published} not submitted
          </p>
        </div>
      </div>

      {/* IAM CO letterhead (visible on screen + in print so the lecturer can
          confirm the layout). Rendered as <div> not <header> so globals.css's
          print rule doesn't suppress it. */}
      <div className="mb-4 rounded-2xl border border-stroke bg-white p-5 text-center shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none">
        <h1 className="text-lg font-bold uppercase tracking-wide text-foreground">
          I AM Community College (I AM CO)
        </h1>
        <p className="text-xs text-body">
          24C Luke Lane, Tengbeh Town, Freetown
        </p>
        <p className="text-xs text-body">
          Tel: +232 79424282 / 77573195 · Email: iamcogmsl@gmail.com
        </p>
        <h2 className="mt-2 text-sm font-semibold uppercase text-foreground">
          Grade Sheet
        </h2>
        <p className="text-xs text-body">
          {mod.code} — {mod.name} · {programmesLabel} · Year{" "}
          {mod.yearLevel} · {mod.academicYear} · {mod.semester} Semester
        </p>
        <p className="mt-1 text-[11px] text-body">
          Lecturer: <span className="font-semibold">{me.name}</span>
        </p>
      </div>

      <section className="overflow-x-auto rounded-2xl border border-stroke bg-white shadow-sm print:rounded-none print:border-0 print:shadow-none">
        <table className="w-full text-sm">
          <thead className="bg-whiter text-left text-xs uppercase tracking-wide text-body print:bg-white">
            <tr>
              <th className="hidden px-3 py-3 sm:table-cell">No</th>
              <th className="px-3 py-3">Name</th>
              <th className="hidden px-3 py-3 md:table-cell">I.D No</th>
              <th className="px-3 py-3 text-right">Test</th>
              <th className="hidden px-3 py-3 text-right sm:table-cell">
                {testWeight}% Test
              </th>
              <th className="px-3 py-3 text-right">Exam</th>
              <th className="hidden px-3 py-3 text-right sm:table-cell">
                {examWeight}% Exam
              </th>
              <th className="px-3 py-3 text-right">Total</th>
              <th className="px-3 py-3">Grade</th>
              <th className="hidden px-3 py-3 sm:table-cell">Remarks</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stroke">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={10}
                  className="px-3 py-10 text-center text-sm text-body"
                >
                  No students enrolled.
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr
                  key={r.studentId}
                  className="hover:bg-whiter print:hover:bg-transparent"
                >
                  <td className="hidden px-3 py-2 text-body sm:table-cell">
                    {i + 1}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        r.isActive
                          ? "font-medium text-foreground"
                          : "text-body line-through"
                      }
                    >
                      {r.name}
                    </span>
                    <span className="ml-2 font-mono text-[10px] text-body md:hidden">
                      {r.studentCode}
                    </span>
                  </td>
                  <td className="hidden px-3 py-2 font-mono text-xs text-body md:table-cell">
                    {r.studentCode}
                  </td>
                  <td className="px-3 py-2 text-right text-body">
                    {r.testScore !== null ? r.testScore : "—"}
                  </td>
                  <td className="hidden px-3 py-2 text-right text-body sm:table-cell">
                    {testWeighted(r)}
                  </td>
                  <td className="px-3 py-2 text-right text-body">
                    {r.examScore !== null ? r.examScore : "—"}
                  </td>
                  <td className="hidden px-3 py-2 text-right text-body sm:table-cell">
                    {examWeighted(r)}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-foreground">
                    {r.finalScore !== null ? r.finalScore.toFixed(2) : "—"}
                  </td>
                  <td className="px-3 py-2 font-semibold text-foreground">
                    {r.grade ?? "—"}
                  </td>
                  <td className="hidden px-3 py-2 text-body sm:table-cell">
                    {r.remark ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {/* Print-only grade scale + signature blocks */}
      <section className="mt-6 hidden text-xs print:block">
        {rule ? (
          <div className="mb-6">
            <p className="mb-1 font-semibold">Grading System</p>
            <p className="mb-2">
              Test Calculation — {testWeight}% · Exam Calculation —{" "}
              {examWeight}% · Attendance minimum {rule.attendanceThreshold}%
            </p>
            <table className="w-full">
              <thead>
                <tr>
                  <th className="border-b border-black/40 px-2 py-1 text-left text-[10px] uppercase">
                    Letter
                  </th>
                  <th className="border-b border-black/40 px-2 py-1 text-left text-[10px] uppercase">
                    % Grade
                  </th>
                  <th className="border-b border-black/40 px-2 py-1 text-left text-[10px] uppercase">
                    Points
                  </th>
                  <th className="border-b border-black/40 px-2 py-1 text-left text-[10px] uppercase">
                    Remarks
                  </th>
                </tr>
              </thead>
              <tbody>
                {rule.gradeScale.map((b, i) => (
                  <tr key={i}>
                    <td className="px-2 py-0.5">{b.grade}</td>
                    <td className="px-2 py-0.5">
                      {b.min === b.max ? `${b.min}` : `${b.min} – ${b.max}`}
                    </td>
                    <td className="px-2 py-0.5">{b.gpa.toFixed(2)}</td>
                    <td className="px-2 py-0.5">{b.remark}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-8">
          <div>
            <p className="font-semibold">HoD Department</p>
            <p className="mt-3">Name: ........................................</p>
            <p className="mt-2">Sign: .........................................</p>
            <p className="mt-2">Date: ........................................</p>
          </div>
          <div>
            <p className="font-semibold">Lecturer</p>
            <p className="mt-3">
              Name: <span className="underline">{me.name}</span>
            </p>
            <p className="mt-2">Sign: .........................................</p>
            <p className="mt-2">Date: ........................................</p>
          </div>
        </div>
        <div className="mt-6">
          <p className="font-semibold">Exam&apos;s Office</p>
          <p className="mt-2">
            Sign: ......................................... Date:
            ........................................
          </p>
        </div>
      </section>

      <p className="mt-4 hidden text-[10px] text-body print:block">
        Generated {new Date().toLocaleString("en-GB")} · IAM CO Exam Management
        · Lecturer&apos;s working copy
      </p>
    </div>
  );
}
