import Link from "next/link";
import { connectDB } from "@/lib/db";
import { Course } from "@/models/Course";
import { Programme } from "@/models/Programme";
import { User } from "@/models/User";
import { requireAdminScope } from "@/lib/admin-scope";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

const YEAR_OPTIONS = [1, 2, 3, 4] as const;

export default async function GradeReportPickerPage({
  searchParams,
}: {
  searchParams: Promise<{ programmeId?: string; yearLevel?: string }>;
}) {
  const me = await requireAdminScope();
  const sp = await searchParams;
  await connectDB();

  const programmes = await Programme.find({
    department: me.department,
    isActive: true,
  })
    .select("name code")
    .sort({ name: 1 })
    .lean();
  const programmeById = new Map(
    programmes.map((p) => [
      String(p._id),
      { name: p.name as string, code: p.code as string },
    ]),
  );

  const yearLevelNum =
    sp.yearLevel && /^\d$/.test(sp.yearLevel) ? Number(sp.yearLevel) : null;
  const selectedProgrammeId = sp.programmeId ?? "";

  const filter: Record<string, unknown> = { department: me.department };
  if (selectedProgrammeId) filter.programmeId = selectedProgrammeId;
  if (yearLevelNum) filter.yearLevel = yearLevelNum;

  const courses = await Course.find(filter)
    .select(
      "code name lecturerId academicYear semester programmeId yearLevel isActive",
    )
    .sort({ academicYear: -1, semester: 1, yearLevel: 1, code: 1 })
    .lean();

  const lecturerIds = courses
    .map((c) => c.lecturerId)
    .filter(Boolean) as unknown as string[];
  const lecturers = await User.find({ _id: { $in: lecturerIds } })
    .select("name")
    .lean();
  const lecturerName = new Map(
    lecturers.map((l) => [String(l._id), l.name as string]),
  );

  return (
    <div>
      <PageHeader
        title="Grade report"
        description="Pick a module to view or export its grade report."
      />

      <form className="mb-4 grid grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:items-end">
        <div className="w-full sm:w-auto">
          <label className="block text-xs font-medium text-foreground">
            Programme
          </label>
          <select
            name="programmeId"
            defaultValue={selectedProgrammeId}
            className="mt-1 w-full rounded-lg border border-stroke bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:w-auto"
          >
            <option value="">All programmes</option>
            {programmes.map((p) => (
              <option key={String(p._id)} value={String(p._id)}>
                {p.code} — {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="w-full sm:w-auto">
          <label className="block text-xs font-medium text-foreground">
            Year
          </label>
          <select
            name="yearLevel"
            defaultValue={sp.yearLevel ?? ""}
            className="mt-1 w-full rounded-lg border border-stroke bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:w-auto"
          >
            <option value="">All years</option>
            {YEAR_OPTIONS.map((y) => (
              <option key={y} value={y}>
                Year {y}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-lg border border-stroke px-3 py-2 text-sm font-medium hover:border-primary hover:text-primary"
        >
          Apply
        </button>
        {selectedProgrammeId || sp.yearLevel ? (
          <Link
            href="/admin/reports/grades"
            className="text-sm font-medium text-body hover:text-foreground"
          >
            Reset
          </Link>
        ) : null}
      </form>

      <div className="overflow-x-auto rounded-2xl border border-stroke bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-whiter text-left text-xs uppercase tracking-wide text-body">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Programme</th>
              <th className="px-4 py-3">Year</th>
              <th className="px-4 py-3">Period</th>
              <th className="px-4 py-3">Lecturer</th>
              <th className="px-4 py-3 text-right">Open</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stroke">
            {courses.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-sm text-body"
                >
                  No modules match these filters.
                </td>
              </tr>
            ) : (
              courses.map((c) => {
                const id = String(c._id);
                const prog = programmeById.get(String(c.programmeId));
                return (
                  <tr key={id} className="hover:bg-whiter">
                    <td className="px-4 py-3 font-mono text-xs text-foreground">
                      {c.code}
                    </td>
                    <td className="px-4 py-3 text-foreground">{c.name}</td>
                    <td className="px-4 py-3 text-body">
                      {prog?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-body">Year {c.yearLevel}</td>
                    <td className="px-4 py-3 text-body">
                      {c.academicYear} · {c.semester}
                    </td>
                    <td className="px-4 py-3 text-body">
                      {c.lecturerId
                        ? (lecturerName.get(String(c.lecturerId)) ?? "—")
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/reports/grades/${id}`}
                        className="rounded-md border border-stroke px-2.5 py-1 text-xs font-medium text-body hover:border-primary hover:text-primary"
                      >
                        Open report
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
