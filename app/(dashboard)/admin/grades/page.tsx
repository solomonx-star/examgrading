import Link from "next/link";
import { connectDB } from "@/lib/db";
import { Programme } from "@/models/Programme";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { requireAdminScope } from "@/lib/admin-scope";
import { PageHeader } from "@/components/ui/PageHeader";
import { loadCohortRows } from "@/lib/cohort-data";
import { CohortPublishButton } from "./cohort-publish-button";

export const dynamic = "force-dynamic";

const SEMESTERS = ["First", "Second", "Summer"] as const;
type Sem = (typeof SEMESTERS)[number];

export default async function AdminGradesPage({
  searchParams,
}: {
  searchParams: Promise<{
    programme?: string;
    year?: string;
    academicYear?: string;
    semester?: string;
  }>;
}) {
  await requireAdminScope();
  const sp = await searchParams;

  await connectDB();
  const programmes = await Programme.find({ isActive: true })
    .select("name code")
    .sort({ name: 1 })
    .lean();

  const current = await AcademicPeriod.findOne({ isCurrent: true }).lean();

  const programmeId = sp.programme && /^[a-f\d]{24}$/i.test(sp.programme)
    ? sp.programme
    : programmes[0]
      ? String(programmes[0]._id)
      : "";
  const yearLevel = sp.year && /^[1-4]$/.test(sp.year) ? Number(sp.year) : 1;
  const academicYear = sp.academicYear ?? current?.year ?? "";
  const semester: Sem =
    sp.semester && SEMESTERS.includes(sp.semester as Sem)
      ? (sp.semester as Sem)
      : ((current?.semester as Sem | undefined) ?? "First");

  const programme = programmes.find((p) => String(p._id) === programmeId);

  const rows = programmeId && academicYear
    ? await loadCohortRows({
        programmeId,
        yearLevel,
        academicYear,
        semester,
      })
    : [];

  const cohortHasSubmitted = rows.some((r) => r.submitted > 0);

  return (
    <div>
      <PageHeader
        title="Grade reviews"
        description="Pick a cohort, review submitted grades, then publish."
      />

      <form className="mb-6 grid grid-cols-1 gap-3 rounded-2xl border border-stroke bg-white p-4 shadow-sm sm:grid-cols-2 sm:items-end lg:grid-cols-[2fr_1fr_1fr_1fr_auto]">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-foreground">
            Programme
          </label>
          <select
            name="programme"
            defaultValue={programmeId}
            className="w-full rounded-lg border border-stroke bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {programmes.length === 0 ? (
              <option value="">— No programmes —</option>
            ) : (
              programmes.map((p) => (
                <option key={String(p._id)} value={String(p._id)}>
                  {p.name}
                </option>
              ))
            )}
          </select>
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-foreground">
            Year
          </label>
          <select
            name="year"
            defaultValue={String(yearLevel)}
            className="w-full rounded-lg border border-stroke bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="1">Year 1</option>
            <option value="2">Year 2</option>
            <option value="3">Year 3</option>
            <option value="4">Year 4</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-foreground">
            Academic year
          </label>
          <input
            name="academicYear"
            defaultValue={academicYear}
            placeholder="2025/2026"
            className="w-full rounded-lg border border-stroke bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-foreground">
            Semester
          </label>
          <select
            name="semester"
            defaultValue={semester}
            className="w-full rounded-lg border border-stroke bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="First">First</option>
            <option value="Second">Second</option>
            <option value="Summer">Summer</option>
          </select>
        </div>
        <button
          type="submit"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-dark sm:col-span-2 lg:col-span-1"
        >
          Load cohort
        </button>
      </form>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">
          {programme
            ? `${programme.name} · Year ${yearLevel} · ${academicYear} · ${semester}`
            : "Pick a cohort"}
        </h2>
        {programme && cohortHasSubmitted ? (
          <CohortPublishButton
            programmeId={programmeId}
            yearLevel={yearLevel}
            academicYear={academicYear}
            semester={semester}
          />
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-stroke bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-whiter text-left text-xs uppercase tracking-wide text-body">
            <tr>
              <th className="px-4 py-3">Student ID</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Submitted / Modules</th>
              <th className="px-4 py-3">Published</th>
              <th className="px-4 py-3">Drafts</th>
              <th className="px-4 py-3">Att. flags</th>
              <th className="px-4 py-3 text-right">Review</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stroke">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-sm text-body"
                >
                  {programme
                    ? "No students in this cohort yet."
                    : "Choose a programme + year to load the cohort."}
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const href = `/admin/grades/${r.studentId}/${encodeURIComponent(academicYear)}/${semester}?programme=${programmeId}&year=${yearLevel}`;
                return (
                  <tr key={r.studentId} className="hover:bg-whiter">
                    <td className="px-4 py-3 font-mono text-xs text-body">
                      {r.studentCode}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={href}
                        className="font-medium text-foreground hover:text-primary"
                      >
                        {r.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-body">
                      <span
                        className={
                          r.submitted > 0
                            ? "font-semibold text-foreground"
                            : "text-body"
                        }
                      >
                        {r.submitted}
                      </span>
                      <span className="text-body"> / {r.modulesTotal}</span>
                    </td>
                    <td className="px-4 py-3">
                      {r.published > 0 ? (
                        <span className="inline-flex rounded-full bg-meta-3/10 px-2 py-0.5 text-xs font-medium text-meta-3">
                          {r.published}
                        </span>
                      ) : (
                        <span className="text-xs text-body">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-body">{r.drafts}</td>
                    <td className="px-4 py-3">
                      {r.attendanceWarnings > 0 ? (
                        <span className="inline-flex rounded-full bg-meta-1/10 px-2 py-0.5 text-xs font-medium text-meta-1">
                          {r.attendanceWarnings}
                        </span>
                      ) : (
                        <span className="text-xs text-body">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={href}
                        className="rounded-md border border-stroke px-2.5 py-1 text-xs font-medium text-body hover:border-primary hover:text-primary"
                      >
                        Review
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
