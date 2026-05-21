import Link from "next/link";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { Programme } from "@/models/Programme";
import { requireAdminScope } from "@/lib/admin-scope";
import { PageHeader } from "@/components/ui/PageHeader";
import { StudentRowActions } from "./row-actions";

export const dynamic = "force-dynamic";

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; programme?: string; year?: string }>;
}) {
  await requireAdminScope();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();

  await connectDB();

  const programmes = await Programme.find({})
    .select("name code")
    .sort({ name: 1 })
    .lean();
  const programmeMap = new Map(
    programmes.map((p) => [
      String(p._id),
      { name: p.name as string, code: p.code as string },
    ]),
  );

  const filter: Record<string, unknown> = {
    role: "student",
  };
  if (sp.programme && /^[a-f\d]{24}$/i.test(sp.programme)) {
    filter.programmeId = sp.programme;
  }
  if (sp.year && /^[1-4]$/.test(sp.year)) {
    filter.yearLevel = Number(sp.year);
  }
  if (q) {
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ name: re }, { email: re }, { studentId: re }];
  }
  const students = await User.find(filter)
    .sort({ yearLevel: 1, createdAt: -1 })
    .limit(200)
    .lean();

  return (
    <div>
      <PageHeader
        title="Students"
        description="All students on the platform"
        action={{ href: "/admin/students/new", label: "New student" }}
        secondaryAction={{
          href: "/admin/students/import",
          label: "Bulk import",
        }}
      />

      <form className="mb-4 flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search by name, email, ID"
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
              <th className="px-4 py-3">Student ID</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Programme</th>
              <th className="px-4 py-3">Year</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stroke">
            {students.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-sm text-body"
                >
                  No students found.
                </td>
              </tr>
            ) : (
              students.map((s) => {
                const id = String(s._id);
                const programme = s.programmeId
                  ? programmeMap.get(String(s.programmeId))
                  : null;
                return (
                  <tr key={id} className="hover:bg-whiter">
                    <td className="px-4 py-3 font-mono text-xs text-body">
                      {s.studentId ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/students/${id}`}
                        className="font-medium text-foreground hover:text-primary"
                      >
                        {s.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-body">{s.email}</td>
                    <td className="px-4 py-3 text-body">
                      {programme ? `${programme.name}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-body">
                      {s.yearLevel ? `Year ${s.yearLevel}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {s.isActive ? (
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
                      <StudentRowActions id={id} isActive={s.isActive} />
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
