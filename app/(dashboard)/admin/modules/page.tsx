import Link from "next/link";
import { connectDB } from "@/lib/db";
import { Course } from "@/models/Course";
import { Programme } from "@/models/Programme";
import { User } from "@/models/User";
import { requireAdminScope } from "@/lib/admin-scope";
import { PageHeader } from "@/components/ui/PageHeader";
import { ModuleRowActions } from "./row-actions";

export const dynamic = "force-dynamic";

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; programme?: string; year?: string }>;
}) {
  const me = await requireAdminScope();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();

  await connectDB();

  // Programme dropdown for the filter
  const programmes = await Programme.find({ department: me.department })
    .select("name code")
    .sort({ name: 1 })
    .lean();
  const programmeIdsInDept = programmes.map((p) => p._id);

  const filter: Record<string, unknown> = {
    programmeId: { $in: programmeIdsInDept },
  };
  if (sp.programme && /^[a-f\d]{24}$/i.test(sp.programme)) {
    filter.programmeId = sp.programme;
  }
  if (sp.year && /^[1-4]$/.test(sp.year)) {
    filter.yearLevel = Number(sp.year);
  }
  if (q) {
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ name: re }, { code: re }];
  }
  const courses = await Course.find(filter)
    .sort({ yearLevel: 1, code: 1 })
    .limit(200)
    .lean();

  const lecturerIds = courses
    .map((m) => m.lecturerId)
    .filter(Boolean) as unknown as string[];
  const lecturers = await User.find({ _id: { $in: lecturerIds } })
    .select("name")
    .lean();
  const lecturerName = new Map(
    lecturers.map((l) => [String(l._id), l.name as string]),
  );
  const programmeName = new Map(
    programmes.map((p) => [String(p._id), p.name as string]),
  );

  return (
    <div>
      <PageHeader
        title="Modules"
        description={`Department: ${me.department}`}
        action={{ href: "/admin/modules/new", label: "New module" }}
      />

      <form className="mb-4 flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search by name or code"
          className="block w-64 rounded-lg border border-stroke bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <select
          name="programme"
          defaultValue={sp.programme ?? ""}
          className="rounded-lg border border-stroke bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">All programmes</option>
          {programmes.map((p) => (
            <option key={String(p._id)} value={String(p._id)}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          name="year"
          defaultValue={sp.year ?? ""}
          className="rounded-lg border border-stroke bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">All years</option>
          <option value="1">Year 1</option>
          <option value="2">Year 2</option>
          <option value="3">Year 3</option>
          <option value="4">Year 4</option>
        </select>
        <button
          type="submit"
          className="rounded-lg border border-stroke px-4 py-2 text-sm font-medium hover:border-primary hover:text-primary"
        >
          Filter
        </button>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-stroke bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-whiter text-left text-xs uppercase tracking-wide text-body">
            <tr>
              <th className="hidden px-4 py-3 sm:table-cell">Code</th>
              <th className="px-4 py-3">Name</th>
              <th className="hidden px-4 py-3 lg:table-cell">Programme</th>
              <th className="px-4 py-3">Year</th>
              <th className="hidden px-4 py-3 lg:table-cell">Period</th>
              <th className="hidden px-4 py-3 md:table-cell">Lecturer</th>
              <th className="hidden px-4 py-3 sm:table-cell">Enrolled</th>
              <th className="hidden px-4 py-3 sm:table-cell">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stroke">
            {courses.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-10 text-center text-sm text-body"
                >
                  No modules found.
                </td>
              </tr>
            ) : (
              courses.map((m) => {
                const id = String(m._id);
                const lec = m.lecturerId
                  ? lecturerName.get(String(m.lecturerId))
                  : null;
                return (
                  <tr key={id} className="hover:bg-whiter">
                    <td className="hidden px-4 py-3 font-mono text-xs text-foreground sm:table-cell">
                      {m.code}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/modules/${id}`}
                        className="font-medium text-foreground hover:text-primary"
                      >
                        <span className="font-mono text-xs text-body sm:hidden">
                          {m.code}
                        </span>
                        <span className="block sm:inline">{m.name}</span>
                      </Link>
                    </td>
                    <td className="hidden px-4 py-3 text-body lg:table-cell">
                      {programmeName.get(String(m.programmeId)) ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-body">Year {m.yearLevel}</td>
                    <td className="hidden px-4 py-3 text-body lg:table-cell">
                      {m.academicYear} · {m.semester}
                    </td>
                    <td className="hidden px-4 py-3 text-body md:table-cell">
                      {lec ?? "—"}
                    </td>
                    <td className="hidden px-4 py-3 text-body sm:table-cell">
                      {m.enrolledStudents.length}
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      {m.isActive ? (
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
                      <ModuleRowActions id={id} isActive={m.isActive} />
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
