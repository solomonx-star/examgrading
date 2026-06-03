import Link from "next/link";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { Module } from "@/models/Module";
import { requireAdminScope } from "@/lib/admin-scope";
import { PageHeader } from "@/components/ui/PageHeader";
import { LecturerRowActions } from "./row-actions";
import { CreateFlash } from "@/components/dashboard/CreateFlash";

export const dynamic = "force-dynamic";

export default async function LecturersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; created?: string }>;
}) {
  await requireAdminScope();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();

  await connectDB();
  const filter: Record<string, unknown> = {
    role: "lecturer",
  };
  if (q) {
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ name: re }, { email: re }, { staffId: re }];
  }
  const lecturers = await User.find(filter)
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();

  const ids = lecturers.map((l) => l._id);
  const moduleCounts = await Module.aggregate<{
    _id: typeof ids[number];
    count: number;
  }>([
    { $match: { lecturerId: { $in: ids } } },
    { $group: { _id: "$lecturerId", count: { $sum: 1 } } },
  ]);
  const countByLec = new Map(moduleCounts.map((c) => [String(c._id), c.count]));

  return (
    <div>
      <CreateFlash created={sp.created} message="Lecturer created." />
      <PageHeader
        title="Lecturers"
        description="All lecturers on the platform"
        action={{ href: "/admin/lecturers/new", label: "New lecturer" }}
        secondaryAction={{
          href: "/admin/lecturers/import",
          label: "Bulk import",
        }}
      />

      <form className="mb-4">
        <div className="flex max-w-md gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search by name, email, or staff ID"
            className="block w-full rounded-lg border border-stroke bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            type="submit"
            className="rounded-lg border border-stroke px-4 py-2 text-sm font-medium hover:border-primary hover:text-primary"
          >
            Search
          </button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-stroke bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-whiter text-left text-xs uppercase tracking-wide text-body">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Staff ID</th>
              <th className="px-4 py-3">Modules</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stroke">
            {lecturers.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-sm text-body"
                >
                  No lecturers found.
                </td>
              </tr>
            ) : (
              lecturers.map((l) => {
                const id = String(l._id);
                return (
                  <tr key={id} className="hover:bg-whiter">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/lecturers/${id}`}
                        className="font-medium text-foreground hover:text-primary"
                      >
                        {l.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-body">{l.email}</td>
                    <td className="px-4 py-3 text-body">{l.staffId ?? "—"}</td>
                    <td className="px-4 py-3 text-body">
                      {countByLec.get(id) ?? 0}
                    </td>
                    <td className="px-4 py-3">
                      {l.isActive ? (
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
                      <LecturerRowActions id={id} isActive={l.isActive} />
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
