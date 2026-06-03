import Link from "next/link";
import { connectDB } from "@/lib/db";
import { Course } from "@/models/Course";
import { Programme } from "@/models/Programme";
import { requireLecturerScope } from "@/lib/lecturer-scope";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

const YEAR_OPTIONS = [1, 2, 3, 4] as const;

export default async function LecturerAttendanceReportPickerPage({
  searchParams,
}: {
  searchParams: Promise<{ yearLevel?: string }>;
}) {
  const me = await requireLecturerScope();
  const sp = await searchParams;
  await connectDB();

  const yearLevelNum =
    sp.yearLevel && /^\d$/.test(sp.yearLevel) ? Number(sp.yearLevel) : null;

  const filter: Record<string, unknown> = { lecturerId: me.userId };
  if (yearLevelNum) filter.yearLevel = yearLevelNum;

  const courses = await Course.find(filter)
    .select("code name academicYear semester programmeIds yearLevel")
    .sort({ academicYear: -1, semester: 1, yearLevel: 1, code: 1 })
    .lean();

  const programmeIds = Array.from(
    new Set(courses.flatMap((c) => c.programmeIds.map(String))),
  );
  const programmes = await Programme.find({ _id: { $in: programmeIds } })
    .select("name")
    .lean();
  const programmeById = new Map(
    programmes.map((p) => [String(p._id), p.name as string]),
  );

  return (
    <div>
      <PageHeader
        title="Attendance report"
        description="Pick one of your modules to view or export its attendance report."
      />

      <form className="mb-4 grid grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:items-end">
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
        {sp.yearLevel ? (
          <Link
            href="/lecturer/reports/attendance"
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
              <th className="px-4 py-3 text-right">Open</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stroke">
            {courses.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-sm text-body"
                >
                  You have no modules assigned.
                </td>
              </tr>
            ) : (
              courses.map((c) => {
                const id = String(c._id);
                return (
                  <tr key={id} className="hover:bg-whiter">
                    <td className="px-4 py-3 font-mono text-xs text-foreground">
                      {c.code}
                    </td>
                    <td className="px-4 py-3 text-foreground">{c.name}</td>
                    <td className="px-4 py-3 text-body">
                      {c.programmeIds
                        .map((pid) => programmeById.get(String(pid)))
                        .filter((n): n is string => !!n)
                        .join(", ") || "—"}
                    </td>
                    <td className="px-4 py-3 text-body">Year {c.yearLevel}</td>
                    <td className="px-4 py-3 text-body">
                      {c.academicYear} · {c.semester}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/lecturer/reports/attendance/${id}`}
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
