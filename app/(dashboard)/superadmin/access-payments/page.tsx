import Link from "next/link";
import mongoose from "mongoose";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { AccessPayment } from "@/models/AccessPayment";
import { User } from "@/models/User";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { PageHeader } from "@/components/ui/PageHeader";
import { ManualPaymentForm } from "./manual-payment-form";

export const dynamic = "force-dynamic";

export default async function SuperAdminAccessPaymentsPage() {
  const session = await auth();
  if (session?.user?.role !== "superadmin") redirect("/");
  await connectDB();

  const [students, current] = await Promise.all([
    User.find({
      role: "student",
      isActive: true,
    })
      .select("_id name studentId department")
      .sort({ name: 1 })
      .lean(),
    AcademicPeriod.findOne({ isCurrent: true }).lean(),
  ]);

  const studentIds = students.map(
    (s) => new mongoose.Types.ObjectId(String(s._id)),
  );
  const payments = await AccessPayment.find({ student: { $in: studentIds } })
    .sort({ createdAt: -1 })
    .limit(500)
    .lean();

  const studentById = new Map(
    students.map((s) => [
      String(s._id),
      {
        name: s.name,
        studentId: s.studentId ?? "",
        department: s.department ?? "",
      },
    ]),
  );

  return (
    <div>
      <PageHeader
        title="Access payments"
        description="Track student access fee payments across every department, or record a cash / bank-transfer payment."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="overflow-x-auto rounded-2xl border border-stroke bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-whiter text-left text-xs uppercase tracking-wide text-body">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Period</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stroke">
                {payments.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-10 text-center text-sm text-body"
                    >
                      No payments yet.
                    </td>
                  </tr>
                ) : (
                  payments.map((p) => {
                    const sid = String(p.student);
                    const s = studentById.get(sid);
                    return (
                      <tr key={String(p._id)} className="hover:bg-whiter">
                        <td className="px-4 py-3 text-body">
                          {new Date(p.createdAt).toLocaleDateString("en-GB")}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-foreground">
                            {s?.name ?? "—"}
                          </div>
                          <div className="font-mono text-xs text-body">
                            {s?.studentId ?? ""}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-body">
                          {s?.department ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-body">
                          {p.academicYear} · {p.semester}
                        </td>
                        <td className="px-4 py-3 text-body capitalize">
                          {p.method.replace("_", " ")} ·{" "}
                          <span className="text-[11px] uppercase">
                            {p.channel}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-foreground">
                          NLe {p.amount.toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={
                              "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium " +
                              (p.status === "completed"
                                ? "bg-meta-3/10 text-meta-3"
                                : p.status === "pending"
                                  ? "bg-secondary/20 text-foreground"
                                  : "bg-meta-1/10 text-meta-1")
                            }
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {p.status === "completed" ? (
                            <Link
                              href={`/superadmin/access-payments/${String(p._id)}/receipt`}
                              className="text-xs font-medium text-primary hover:underline"
                            >
                              View
                            </Link>
                          ) : (
                            <span className="text-xs text-body">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <ManualPaymentForm
            students={students.map((s) => ({
              id: String(s._id),
              name: s.name,
              studentId: s.studentId ?? "",
              department: s.department ?? "",
            }))}
            period={
              current
                ? {
                    year: current.year,
                    semester: current.semester,
                    accessFee: current.accessFee ?? 0,
                  }
                : null
            }
          />
        </div>
      </div>
    </div>
  );
}
