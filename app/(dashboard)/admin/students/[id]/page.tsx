import mongoose from "mongoose";
import { notFound } from "next/navigation";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { Programme } from "@/models/Programme";
import { requireAdminScope } from "@/lib/admin-scope";
import { getBalance, getTransactions } from "@/lib/ai-credits-service";
import { CREDIT_REASON_LABELS } from "@/models/AICreditTransaction";
import { PageHeader } from "@/components/ui/PageHeader";
import { EditStudentForm } from "./edit-student-form";
import { AddCreditsForm } from "./add-credits-form";

export const dynamic = "force-dynamic";

export default async function EditStudentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminScope();
  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) notFound();

  await connectDB();
  const student = await User.findOne({
    _id: id,
    role: "student",
  }).lean();
  if (!student) notFound();

  const [programmes, balance, transactions] = await Promise.all([
    Programme.find({ isActive: true }).select("name code").sort({ name: 1 }).lean(),
    getBalance(id),
    getTransactions(id, 20),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={student.name}
        description={`Student ID ${student.studentId ?? "—"} · ${student.email}`}
      />

      <EditStudentForm
        id={String(student._id)}
        defaults={{
          name: student.name,
          email: student.email,
          programmeId: student.programmeId ? String(student.programmeId) : "",
          yearLevel: student.yearLevel ?? 1,
          isActive: student.isActive,
          mustChangePassword: student.mustChangePassword,
        }}
        programmes={programmes.map((p) => ({
          id: String(p._id),
          name: p.name as string,
          code: p.code as string,
        }))}
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
    </div>
  );
}
