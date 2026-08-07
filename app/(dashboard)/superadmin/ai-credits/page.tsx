import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { AICredit } from "@/models/AICredit";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default async function SuperAdminAICreditsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await auth();
  if (session?.user?.role !== "superadmin") redirect("/");

  const sp = await searchParams;
  const q = (sp.q ?? "").trim();

  await connectDB();

  const filter: Record<string, unknown> = { role: "student", isActive: true };
  if (q) {
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ name: re }, { email: re }, { studentId: re }];
  }

  const students = await User.find(filter)
    .select("_id name email studentId")
    .sort({ name: 1 })
    .limit(300)
    .lean();

  const studentIds = students.map((s) => s._id);
  const creditDocs = await AICredit.find({ student: { $in: studentIds } })
    .select("student balance")
    .lean();
  const balanceMap = new Map(
    creditDocs.map((c) => [String(c.student), c.balance]),
  );

  return (
    <div>
      <PageHeader
        title="AI Credits"
        description="View and assign AI credits to any student."
      />

      <form className="mb-4 flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search by name, email, or student ID"
          className="block w-72 rounded-lg border border-stroke bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          type="submit"
          className="rounded-lg border border-stroke px-4 py-2 text-sm font-medium hover:border-primary hover:text-primary"
        >
          Search
        </button>
        {q && (
          <Link
            href="/superadmin/ai-credits"
            className="rounded-lg border border-stroke px-4 py-2 text-sm font-medium text-body hover:border-primary hover:text-primary"
          >
            Clear
          </Link>
        )}
      </form>

      <div className="overflow-x-auto rounded-2xl border border-stroke bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-whiter text-left text-xs uppercase tracking-wide text-body">
            <tr>
              <th className="px-4 py-3">Student ID</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3 text-right">Balance</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stroke">
            {students.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-10 text-center text-sm text-body"
                >
                  No students found.
                </td>
              </tr>
            ) : (
              students.map((s) => {
                const id = String(s._id);
                const balance = balanceMap.get(id) ?? 0;
                return (
                  <tr key={id} className="hover:bg-whiter">
                    <td className="px-4 py-3 font-mono text-xs text-body">
                      {s.studentId ?? "—"}
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">
                      {s.name}
                    </td>
                    <td className="px-4 py-3 text-body">{s.email}</td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={
                          balance > 0
                            ? "font-semibold text-meta-3"
                            : "text-body"
                        }
                      >
                        {balance}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/superadmin/ai-credits/${id}`}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        Manage
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
