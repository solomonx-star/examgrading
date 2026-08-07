import Link from "next/link";
import mongoose from "mongoose";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { getBalance, getTransactions } from "@/lib/ai-credits-service";
import { CREDIT_REASON_LABELS } from "@/models/AICreditTransaction";
import { PageHeader } from "@/components/ui/PageHeader";
import { AddCreditsForm } from "./add-credits-form";

export const dynamic = "force-dynamic";

export default async function SuperAdminStudentCreditsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (session?.user?.role !== "superadmin") redirect("/");

  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) notFound();

  await connectDB();
  const student = await User.findOne({ _id: id, role: "student" })
    .select("name email studentId")
    .lean();
  if (!student) notFound();

  const [balance, transactions] = await Promise.all([
    getBalance(id),
    getTransactions(id, 30),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={student.name}
        description={`Student ID ${student.studentId ?? "—"} · ${student.email}`}
        action={{ href: "/superadmin/ai-credits", label: "Back to list" }}
      />

      <AddCreditsForm studentId={id} currentBalance={balance} />

      {transactions.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-stroke bg-white shadow-sm">
          <div className="border-b border-stroke px-5 py-3">
            <h2 className="text-sm font-semibold text-foreground">
              Credit history
            </h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-whiter text-left text-xs uppercase tracking-wide text-body">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Note</th>
                <th className="px-4 py-3 text-right">Change</th>
                <th className="px-4 py-3 text-right">Balance after</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stroke">
              {transactions.map((t) => (
                <tr key={t.id} className="hover:bg-whiter">
                  <td className="px-4 py-2.5 text-body">
                    {new Date(t.createdAt).toLocaleDateString("en-GB")}
                  </td>
                  <td className="px-4 py-2.5 text-foreground">
                    {CREDIT_REASON_LABELS[t.reason]}
                  </td>
                  <td className="px-4 py-2.5 text-body">{t.note || "—"}</td>
                  <td
                    className={`px-4 py-2.5 text-right font-semibold ${t.delta > 0 ? "text-meta-3" : "text-meta-1"}`}
                  >
                    {t.delta > 0 ? `+${t.delta}` : t.delta}
                  </td>
                  <td className="px-4 py-2.5 text-right text-foreground">
                    {t.balanceAfter}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {transactions.length === 0 && (
        <p className="text-sm text-body">No credit transactions yet.</p>
      )}
    </div>
  );
}
