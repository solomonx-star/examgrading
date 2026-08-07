import Link from "next/link";
import { requireStudentScope } from "@/lib/student-scope";
import { getStudentAccessSummary } from "@/lib/payments-service";
import { getBalance } from "@/lib/ai-credits-service";
import { connectDB } from "@/lib/db";
import { AccessPayment } from "@/models/AccessPayment";
import { PageHeader } from "@/components/ui/PageHeader";
import { PayAccessButton } from "./pay-access-button";

export const dynamic = "force-dynamic";

export default async function StudentAccessPage() {
  const me = await requireStudentScope();
  const [summary, aiBalance] = await Promise.all([
    getStudentAccessSummary(me.userId),
    getBalance(me.userId),
  ]);

  await connectDB();
  const history = await AccessPayment.find({ student: me.userId })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  const periodEndDate = summary.period ? new Date(summary.period.endDate) : null;
  const now = new Date();
  const daysLeft = periodEndDate
    ? Math.ceil((periodEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const isExpiringSoon = daysLeft !== null && daysLeft <= 14 && daysLeft > 0;
  const hasExpired = daysLeft !== null && daysLeft <= 0;

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
        <div className={`rounded-2xl border p-6 text-sm shadow-sm ${
          hasExpired
            ? "border-meta-1/30 bg-meta-1/5"
            : isExpiringSoon
              ? "border-secondary/30 bg-secondary/5"
              : "border-meta-3/30 bg-meta-3/5"
        }`}>
          <p className={`font-semibold ${hasExpired ? "text-meta-1" : isExpiringSoon ? "text-secondary" : "text-meta-3"}`}>
            {hasExpired ? "Access has expired" : "Access is active"}
          </p>
          <p className="mt-1 text-body">
            {summary.period!.year} · {summary.period!.semester} semester
          </p>
          {periodEndDate && (
            <p className={`mt-2 text-xs font-medium ${
              hasExpired ? "text-meta-1" : isExpiringSoon ? "text-secondary" : "text-body"
            }`}>
              {hasExpired
                ? `Expired on ${periodEndDate.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}`
                : `Valid until ${periodEndDate.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}${isExpiringSoon ? ` · ${daysLeft} day${daysLeft === 1 ? "" : "s"} remaining` : ""}`
              }
            </p>
          )}
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

      <div className="mt-6 rounded-2xl border border-stroke bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-body">
              AI Credits
            </p>
            <p className="mt-1 text-2xl font-bold text-foreground">
              {aiBalance}{" "}
              <span className="text-sm font-normal text-body">
                credit{aiBalance === 1 ? "" : "s"}
              </span>
            </p>
          </div>
          <Link
            href="/student/credits"
            className="text-xs font-medium text-primary hover:underline"
          >
            View history →
          </Link>
        </div>
      </div>

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
