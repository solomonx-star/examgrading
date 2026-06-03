import Link from "next/link";
import { connectDB } from "@/lib/db";
import { Course } from "@/models/Course";
import { Programme } from "@/models/Programme";
import { requireLecturerScope } from "@/lib/lecturer-scope";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default async function LecturerModulesPage() {
  const me = await requireLecturerScope();
  await connectDB();

  const courses = await Course.find({ lecturerId: me.userId })
    .select(
      "code name creditHours programmeIds yearLevel academicYear semester enrolledStudents isActive",
    )
    .sort({ academicYear: -1, semester: 1, yearLevel: 1, code: 1 })
    .lean();

  const programmeIds = Array.from(
    new Set(courses.flatMap((c) => (c.programmeIds ?? []).map(String))),
  );
  const programmes = await Programme.find({
    _id: { $in: programmeIds },
  })
    .select("name code")
    .lean();
  const programmeById = new Map(
    programmes.map((p) => [
      String(p._id),
      { name: p.name as string, code: p.code as string },
    ]),
  );

  return (
    <div>
      <PageHeader
        title="My courses"
        description="Courses assigned to you by your department admin."
      />
      <div className="overflow-x-auto rounded-2xl border border-stroke bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-whiter text-left text-xs uppercase tracking-wide text-body">
            <tr>
              <th className="hidden px-4 py-3 sm:table-cell">Code</th>
              <th className="px-4 py-3">Name</th>
              <th className="hidden px-4 py-3 lg:table-cell">Programme</th>
              <th className="px-4 py-3">Year</th>
              <th className="hidden px-4 py-3 lg:table-cell">Period</th>
              <th className="hidden px-4 py-3 sm:table-cell">Enrolled</th>
              <th className="hidden px-4 py-3 sm:table-cell">Status</th>
              <th className="px-4 py-3 text-right">Open</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stroke">
            {courses.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-10 text-center text-sm text-body"
                >
                  No modules assigned yet.
                </td>
              </tr>
            ) : (
              courses.map((c) => {
                const id = String(c._id);
                const programmesLabel =
                  (c.programmeIds ?? [])
                    .map((pid) => programmeById.get(String(pid))?.name)
                    .filter((n): n is string => !!n)
                    .join(", ") || "—";
                return (
                  <tr key={id} className="hover:bg-whiter">
                    <td className="hidden px-4 py-3 font-mono text-xs text-foreground sm:table-cell">
                      {c.code}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/lecturer/modules/${id}`}
                        className="font-medium text-foreground hover:text-primary"
                      >
                        <span className="font-mono text-xs text-body sm:hidden">
                          {c.code}
                        </span>
                        <span className="block sm:inline">{c.name}</span>
                      </Link>
                    </td>
                    <td className="hidden px-4 py-3 text-body lg:table-cell">
                      {programmesLabel}
                    </td>
                    <td className="px-4 py-3 text-body">Year {c.yearLevel}</td>
                    <td className="hidden px-4 py-3 text-body lg:table-cell">
                      {c.academicYear} · {c.semester}
                    </td>
                    <td className="hidden px-4 py-3 text-body sm:table-cell">
                      {c.enrolledStudents.length}
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      {c.isActive ? (
                        <span className="inline-flex rounded-full bg-meta-3/10 px-2.5 py-0.5 text-xs font-medium text-meta-3">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-meta-1/10 px-2.5 py-0.5 text-xs font-medium text-meta-1">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/lecturer/modules/${id}`}
                        className="rounded-md border border-stroke px-2.5 py-1 text-xs font-medium text-body hover:border-primary hover:text-primary"
                      >
                        Open
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
