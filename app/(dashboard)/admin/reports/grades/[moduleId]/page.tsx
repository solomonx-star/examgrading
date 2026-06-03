import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminScope } from "@/lib/admin-scope";
import { loadCourseHeader, loadGradeReportRows } from "@/lib/report-data";
import { getEffectiveGradingRule } from "@/lib/grading-server";
import { PageHeader } from "@/components/ui/PageHeader";
import { PrintButton } from "@/components/ui/PrintButton";
import { GradeDistributionChart } from "@/components/charts/GradeDistributionChart";

export const dynamic = "force-dynamic";

export default async function GradeReportViewPage({
  params,
}: {
  params: Promise<{ moduleId: string }>;
}) {
  await requireAdminScope();
  const { moduleId } = await params;
  const mod = await loadCourseHeader(moduleId);
  if (!mod) notFound();

  const [rows, rule] = await Promise.all([
    loadGradeReportRows(moduleId),
    getEffectiveGradingRule(moduleId),
  ]);

  const testWeight = rule?.caWeight ?? 30;
  const examWeight = rule?.examWeight ?? 70;

  const published = rows.filter((r) => r.isPublished).length;
  const drafts = rows.filter((r) => r.hasGrade && !r.isPublished).length;
  const submitted = rows.filter(
    (r) => r.submissionStatus === "submitted" && !r.isPublished,
  ).length;

  const gradeOrder = rule
    ? rule.gradeScale.map((b) => b.grade)
    : ["A", "B+", "B", "C+", "C", "D+", "D", "F"];
  const gradeCounts = new Map<string, number>();
  for (const r of rows) {
    if (!r.grade) continue;
    gradeCounts.set(r.grade, (gradeCounts.get(r.grade) ?? 0) + 1);
  }
  const distributionBuckets = gradeOrder
    .filter((g) => gradeCounts.has(g))
    .map((g) => ({ grade: g, count: gradeCounts.get(g) ?? 0 }));
  for (const [g, c] of gradeCounts) {
    if (!gradeOrder.includes(g)) distributionBuckets.push({ grade: g, count: c });
  }
  const gradedCount = distributionBuckets.reduce((s, b) => s + b.count, 0);

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

  return (
    <div className="print:bg-white">
      <div className="print:hidden">
        <PageHeader
          title="Grade report"
          description={`${mod.code} — ${mod.name} · ${mod.academicYear} · ${mod.semester} · ${mod.programmesLabel || "—"} · Year ${mod.yearLevel}`}
        />

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <a
            href={`/api/admin/reports/grades/${moduleId}/csv`}
            className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-dark"
          >
            Download CSV
          </a>
          <PrintButton />
          <Link
            href="/admin/reports/grades"
            className="text-sm font-medium text-body hover:text-foreground"
          >
            ← Back
          </Link>
          <p className="ml-auto text-xs text-body">
            {published} published · {submitted} submitted · {drafts} draft ·{" "}
            {rows.length - published - drafts} not entered
          </p>
        </div>
      </div>

      {/* Print-only IAM CO letterhead matching the official grade sheet.
          Rendered as <div> (not <header>) so globals.css's print rule that
          hides <header> doesn't suppress the letterhead. */}
      <div className="mb-4 hidden text-center print:block">
        <h1 className="text-lg font-bold uppercase tracking-wide">
          I AM Community College (I AM CO)
        </h1>
        <p className="text-xs">24C Luke Lane, Tengbeh Town, Freetown</p>
        <p className="text-xs">
          Tel: +232 79424282 / 77573195 · Email: iamcogmsl@gmail.com
        </p>
        <h2 className="mt-2 text-sm font-semibold uppercase">Grade Sheet</h2>
        <p className="text-xs">
          {mod.code} — {mod.name} · {mod.programmesLabel || "—"} · Year{" "}
          {mod.yearLevel} · {mod.academicYear} · {mod.semester} Semester
        </p>
      </div>

      {gradedCount > 0 && (
        <section className="mb-6 rounded-2xl border border-stroke bg-white p-5 shadow-sm print:hidden">
          <p className="text-xs font-medium uppercase tracking-wide text-body">
            Grade distribution
          </p>
          <p className="mt-1 mb-3 text-sm text-body">
            {gradedCount} of {rows.length} student
            {rows.length === 1 ? "" : "s"} graded.
          </p>
          <GradeDistributionChart buckets={distributionBuckets} />
        </section>
      )}

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
              <th className="hidden px-3 py-3 md:table-cell print:hidden">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stroke">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={11}
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
                  <td className="hidden px-3 py-2 md:table-cell print:hidden">
                    {r.isPublished ? (
                      <span className="inline-flex rounded-full bg-meta-3/10 px-2 py-0.5 text-[11px] font-medium text-meta-3">
                        Published
                      </span>
                    ) : r.submissionStatus === "submitted" ? (
                      <span className="inline-flex rounded-full bg-secondary/20 px-2 py-0.5 text-[11px] font-medium text-foreground">
                        Submitted
                      </span>
                    ) : r.hasGrade ? (
                      <span className="inline-flex rounded-full bg-whiter px-2 py-0.5 text-[11px] font-medium text-body">
                        Draft
                      </span>
                    ) : (
                      <span className="text-[11px] text-body">—</span>
                    )}
                    {r.attendanceMet === false ? (
                      <span className="ml-1 inline-flex rounded-full bg-meta-1/10 px-2 py-0.5 text-[10px] font-medium text-meta-1">
                        Low att.
                      </span>
                    ) : null}
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
            <p className="mt-3">Name: ........................................</p>
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
      </p>
    </div>
  );
}
