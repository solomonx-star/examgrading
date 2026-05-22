import Link from "next/link";
import mongoose from "mongoose";
import { notFound } from "next/navigation";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { Programme } from "@/models/Programme";
import { requireAdminScope } from "@/lib/admin-scope";
import { PageHeader } from "@/components/ui/PageHeader";
import { loadStudentReviewRows } from "@/lib/cohort-data";
import { StudentReviewActions } from "./review-actions";
import { GradeEditRow } from "./grade-edit-row";

export const dynamic = "force-dynamic";

const SEMESTERS = ["First", "Second", "Summer"] as const;
type Sem = (typeof SEMESTERS)[number];

export default async function StudentReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ studentId: string; year: string; semester: string }>;
  searchParams: Promise<{ programme?: string; year?: string }>;
}) {
  await requireAdminScope();
  const { studentId, year, semester } = await params;
  const sp = await searchParams;

  if (!mongoose.Types.ObjectId.isValid(studentId)) notFound();
  if (!/^\d{4}\/\d{4}$/.test(decodeURIComponent(year))) notFound();
  if (!SEMESTERS.includes(semester as Sem)) notFound();

  const academicYear = decodeURIComponent(year);
  const semesterTyped = semester as Sem;

  await connectDB();
  const student = await User.findOne({
    _id: studentId,
    role: "student",
  })
    .select("name studentId email programmeId yearLevel")
    .lean();
  if (!student) notFound();

  const programmeId =
    (sp.programme && /^[a-f\d]{24}$/i.test(sp.programme) ? sp.programme : null) ??
    (student.programmeId ? String(student.programmeId) : null);
  if (!programmeId) notFound();

  const programme = await Programme.findOne({ _id: programmeId })
    .select("name code")
    .lean();
  if (!programme) notFound();

  const yearLevel = sp.year && /^[1-4]$/.test(sp.year)
    ? Number(sp.year)
    : (student.yearLevel as number | undefined) ?? 1;

  const rows = await loadStudentReviewRows({
    studentId,
    programmeId,
    yearLevel,
    academicYear,
    semester: semesterTyped,
  });

  const submitted = rows.filter(
    (r) => r.submissionStatus === "submitted" && !r.isPublished,
  ).length;
  const published = rows.filter((r) => r.isPublished).length;
  const drafts = rows.filter(
    (r) => r.submissionStatus === "draft" && !r.isPublished,
  ).length;

  return (
    <div>
      <PageHeader
        title={student.name}
        description={`${student.studentId ?? ""} · ${programme.name} · Year ${yearLevel} · ${academicYear} · ${semesterTyped}`}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <StudentReviewActions
          studentId={String(student._id)}
          programmeId={programmeId}
          yearLevel={yearLevel}
          academicYear={academicYear}
          semester={semesterTyped}
          submittedCount={submitted}
          publishedCount={published}
          draftCount={drafts}
        />
        <Link
          href={`/admin/grades?programme=${programmeId}&year=${yearLevel}&academicYear=${encodeURIComponent(academicYear)}&semester=${semesterTyped}`}
          className="text-sm font-medium text-body hover:text-foreground"
        >
          ← Back to cohort
        </Link>
      </div>

      <section className="overflow-x-auto rounded-2xl border border-stroke bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-whiter text-left text-xs uppercase tracking-wide text-body">
            <tr>
              <th className="hidden px-4 py-3 sm:table-cell">Code</th>
              <th className="px-4 py-3">Module</th>
              <th className="hidden px-4 py-3 text-right md:table-cell">Test</th>
              <th className="hidden px-4 py-3 text-right md:table-cell">Exam</th>
              <th className="px-4 py-3 text-right">Final</th>
              <th className="px-4 py-3">Grade</th>
              <th className="hidden px-4 py-3 sm:table-cell">Remarks</th>
              <th className="px-4 py-3 text-right">GPA</th>
              <th className="px-4 py-3">Submission</th>
              <th className="hidden px-4 py-3 md:table-cell">Attendance</th>
              <th className="px-4 py-3 text-right">Edit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stroke">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={11}
                  className="px-4 py-10 text-center text-sm text-body"
                >
                  No modules in this cohort.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <GradeEditRow
                  key={r.moduleId}
                  row={r}
                  studentId={String(student._id)}
                  academicYear={academicYear}
                  semester={semesterTyped}
                />
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
