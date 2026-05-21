import { NextResponse } from "next/server";
import { requireAdminScope } from "@/lib/admin-scope";
import { loadCourseForDepartment, loadGradeReportRows } from "@/lib/report-data";
import { getEffectiveGradingRule } from "@/lib/grading-server";
import { safeFilename, toCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ moduleId: string }> },
) {
  const me = await requireAdminScope();
  const { moduleId } = await ctx.params;
  const mod = await loadCourseForDepartment(moduleId, me.department);
  if (!mod) {
    return NextResponse.json({ error: "Module not found" }, { status: 404 });
  }

  const [rows, rule] = await Promise.all([
    loadGradeReportRows(moduleId),
    getEffectiveGradingRule(moduleId),
  ]);

  const testWeight = rule?.caWeight ?? 30;
  const examWeight = rule?.examWeight ?? 70;

  const headers = [
    "No",
    "Student ID",
    "Name",
    "Status",
    "Test",
    `${testWeight}% Test`,
    "Exam",
    `${examWeight}% Exam`,
    "Total",
    "Grade",
    "Remarks",
    "Attendance met",
    "Submission",
    "Published",
  ];

  const data = rows.map((r, i) => {
    const testWeighted =
      r.testScore !== null && r.testMaxScore && r.testMaxScore > 0
        ? ((r.testScore / r.testMaxScore) * testWeight).toFixed(2)
        : "";
    const examWeighted =
      r.examScore !== null && r.examMaxScore && r.examMaxScore > 0
        ? ((r.examScore / r.examMaxScore) * examWeight).toFixed(2)
        : "";
    return {
      No: i + 1,
      "Student ID": r.studentCode,
      Name: r.name,
      Status: r.isActive ? "Active" : "Inactive",
      Test: r.testScore ?? "",
      [`${testWeight}% Test`]: testWeighted,
      Exam: r.examScore ?? "",
      [`${examWeight}% Exam`]: examWeighted,
      Total: r.finalScore ?? "",
      Grade: r.grade ?? "",
      Remarks: r.remark ?? "",
      "Attendance met":
        r.attendanceMet === null ? "" : r.attendanceMet ? "Yes" : "No",
      Submission: r.submissionStatus ?? "",
      Published: r.isPublished ? "Yes" : "No",
    };
  });

  const csv = toCsv(data, headers);
  const filename = `${safeFilename(mod.code)}-grades-${safeFilename(mod.academicYear)}-${mod.semester.toLowerCase()}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
