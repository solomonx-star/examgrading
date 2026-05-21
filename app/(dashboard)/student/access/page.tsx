import Link from "next/link";
import { requireStudentScope } from "@/lib/student-scope";
import { getStudentAccessSummary } from "@/lib/payments-service";
import { connectDB } from "@/lib/db";
import { AccessPayment } from "@/models/AccessPayment";
import { PageHeader } from "@/components/ui/PageHeader";
import { PayAccessButton } from "./pay-access-button";

export const dynamic = "force-dynamic";

export default async function StudentAccessPage() {
  const me = await requireStudentScope();
  const summary = await getStudentAccessSummary(me.userId);

  await connectDB();
  const history = await AccessPayment.find({ student: me.userId })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  return (
    <div>
      <PageHeader
        title="System access"
        description="Pay your access fee to unlock grades, attendance and reports."
      />

      {!summary.period ? (
        <div className="rounded-2xl border border-stroke bg-white p-6 text-sm text-body shadow-sm">
          No current academic period is set. Ask your administrator to set one
          before paying.
        </div>
      ) : summary.period.accessFee <= 0 ? (
        <div className="rounded-2xl border border-meta-3/30 bg-meta-3/5 p-6 text-sm text-meta-3 shadow-sm">
          Access is free for {summary.period.year} · {summary.period.semester}.
          No payment required.
        </div>
      ) : summary.hasActiveAccess ? (
        <div className="rounded-2xl border border-meta-3/30 bg-meta-3/5 p-6 text-sm shadow-sm">
          <p className="font-semibold text-meta-3">Access is active</p>
          <p className="mt-1 text-body">
            You have paid for {summary.period.year} · {summary.period.semester}.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-stroke bg-white p-6 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-body">
            Billing for
          </p>
          <p className="mt-1 text-lg font-semibold text-foreground">
            {summary.period.year} · {summary.period.semester} semester
          </p>
          <div className="mt-4 flex items-end justify-between">
            <p className="text-sm text-body">Access fee</p>
            <p className="text-2xl font-bold text-foreground">
              NLe {summary.period.accessFee.toLocaleString()}
            </p>
          </div>
          <div className="mt-5">
            <PayAccessButton
              hasPending={!!summary.pendingPaymentId}
              amount={summary.period.accessFee}
            />
            <p className="mt-2 text-[11px] text-body">
              Paying by cash or bank transfer? Your administrator records those
              payments and issues the receipt.
            </p>
          </div>
        </div>
      )}

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          Your payment history
        </h2>
        <div className="overflow-x-auto rounded-2xl border border-stroke bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-whiter text-left text-xs uppercase tracking-wide text-body">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Period</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stroke">
              {history.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-sm text-body"
                  >
                    No payments yet.
                  </td>
                </tr>
              ) : (
                history.map((p) => (
                  <tr key={String(p._id)} className="hover:bg-whiter">
                    <td className="px-4 py-3 text-body">
                      {new Date(p.createdAt).toLocaleDateString("en-GB")}
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {p.academicYear} · {p.semester}
                    </td>
                    <td className="px-4 py-3 text-body capitalize">
                      {p.method.replace("_", " ")} ·{" "}
                      <span className="text-[11px] uppercase">{p.channel}</span>
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
                          href={`/student/access/receipt/${String(p._id)}`}
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          View
                        </Link>
                      ) : (
                        <span className="text-xs text-body">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
