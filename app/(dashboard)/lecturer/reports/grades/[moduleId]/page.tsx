import Link from "next/link";
import { notFound } from "next/navigation";
import { requireLecturerScope } from "@/lib/lecturer-scope";
import {
  loadCourseForLecturer,
  loadGradeReportRows,
} from "@/lib/report-data";
import { getEffectiveGradingRule } from "@/lib/grading-server";
import { PageHeader } from "@/components/ui/PageHeader";
import { PrintButton } from "@/components/ui/PrintButton";
import { GradeDistributionChart } from "@/components/charts/GradeDistributionChart";

export const dynamic = "force-dynamic";

export default async function LecturerGradeReportViewPage({
  params,
}: {
  params: Promise<{ moduleId: string }>;
}) {
  const me = await requireLecturerScope();
  const { moduleId } = await params;
  const mod = await loadCourseForLecturer(moduleId, me.userId);
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
    if (!gradeOrder.includes(g))
      distributionBuckets.push({ grade: g, count: c });
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
          description={`${mod.code} — ${mod.name} · ${mod.academicYear} · ${mod.semester} · ${mod.programmeName ?? "—"} · Year ${mod.yearLevel}`}
        />

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <a
            href={`/api/lecturer/reports/grades/${moduleId}/csv`}
            className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-dark"
          >
            Download CSV
          </a>
          <PrintButton />
          <Link
            href={`/lecturer/modules/${moduleId}/print`}
            className="inline-flex items-center rounded-lg border border-stroke px-4 py-2 text-sm font-medium text-body hover:border-primary hover:text-primary"
          >
            Official grade sheet
          </Link>
          <Link
            href="/lecturer/reports/grades"
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

      <p className="mt-4 hidden text-[10px] text-body print:block">
        Generated {new Date().toLocaleString("en-GB")} · IAM CO Exam Management
      </p>
    </div>
  );
}
