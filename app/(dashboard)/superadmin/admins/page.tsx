import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { PageHeader } from "@/components/ui/PageHeader";
import { AdminRowActions } from "./row-actions";

export const dynamic = "force-dynamic";

type SearchParams = { q?: string };

export default async function AdminsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  if (session?.user?.role !== "superadmin") redirect("/");

  const sp = await searchParams;
  const q = (sp.q ?? "").trim();

  await connectDB();
  const filter: Record<string, unknown> = { role: "admin" };
  if (q) {
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ name: re }, { email: re }, { staffId: re }];
  }
  const admins = await User.find(filter)
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  return (
    <div>
      <PageHeader
        title="Admins"
        description="Manage administrator accounts."
        action={{ href: "/superadmin/admins/new", label: "New admin" }}
        secondaryAction={{
          href: "/superadmin/admins/import",
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
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stroke">
            {admins.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-10 text-center text-sm text-body"
                >
                  No admins found.
                </td>
              </tr>
            ) : (
              admins.map((a) => {
                const id = String(a._id);
                return (
                  <tr key={id} className="hover:bg-whiter">
                    <td className="px-4 py-3">
                      <Link
                        href={`/superadmin/admins/${id}`}
                        className="font-medium text-foreground hover:text-primary"
                      >
                        {a.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-body">{a.email}</td>
                    <td className="px-4 py-3 text-body">{a.staffId ?? "—"}</td>
                    <td className="px-4 py-3">
                      <StatusBadge active={a.isActive} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <AdminRowActions id={id} isActive={a.isActive} />
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

function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex rounded-full bg-meta-3/10 px-2.5 py-0.5 text-xs font-medium text-meta-3">
      Active
    </span>
  ) : (
    <span className="inline-flex rounded-full bg-meta-1/10 px-2.5 py-0.5 text-xs font-medium text-meta-1">
      Inactive
    </span>
  );
}
