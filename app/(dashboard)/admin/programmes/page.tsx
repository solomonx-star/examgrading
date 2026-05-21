import Link from "next/link";
import { connectDB } from "@/lib/db";
import { Programme } from "@/models/Programme";
import { Module } from "@/models/Module";
import { requireAdminScope } from "@/lib/admin-scope";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProgrammeRowActions } from "./row-actions";

export const dynamic = "force-dynamic";

export default async function ProgrammesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireAdminScope();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();

  await connectDB();
  const filter: Record<string, unknown> = {};
  if (q) {
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ name: re }, { code: re }];
  }
  const programmes = await Programme.find(filter)
    .sort({ name: 1 })
    .limit(200)
    .lean();

  const ids = programmes.map((p) => p._id);
  const moduleCounts = await Module.aggregate<{
    _id: typeof ids[number];
    count: number;
  }>([
    { $match: { programmeId: { $in: ids } } },
    { $group: { _id: "$programmeId", count: { $sum: 1 } } },
  ]);
  const countByProgramme = new Map(
    moduleCounts.map((c) => [String(c._id), c.count]),
  );

  return (
    <div>
      <PageHeader
        title="Programmes"
        description="All programmes on the platform"
        action={{ href: "/admin/programmes/new", label: "New programme" }}
      />

      <form className="mb-4">
        <div className="flex max-w-md gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search by name or code"
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
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Modules</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stroke">
            {programmes.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-10 text-center text-sm text-body"
                >
                  No programmes yet.
                </td>
              </tr>
            ) : (
              programmes.map((p) => {
                const id = String(p._id);
                return (
                  <tr key={id} className="hover:bg-whiter">
                    <td className="px-4 py-3 font-mono text-xs text-foreground">
                      {p.code}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/programmes/${id}`}
                        className="font-medium text-foreground hover:text-primary"
                      >
                        {p.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-body">
                      {countByProgramme.get(id) ?? 0}
                    </td>
                    <td className="px-4 py-3">
                      {p.isActive ? (
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
                      <ProgrammeRowActions id={id} isActive={p.isActive} />
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
