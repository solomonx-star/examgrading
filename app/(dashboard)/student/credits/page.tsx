import { requireActiveStudentAccess } from "@/lib/student-scope";
import { getBalance, getTransactions } from "@/lib/ai-credits-service";
import { CREDIT_REASON_LABELS } from "@/models/AICreditTransaction";
import { PageHeader } from "@/components/ui/PageHeader";
import { AutoRefresh } from "@/components/ui/AutoRefresh";

export const dynamic = "force-dynamic";

export default async function StudentCreditsPage() {
  const me = await requireActiveStudentAccess();
  const [balance, transactions] = await Promise.all([
    getBalance(me.userId),
    getTransactions(me.userId, 30),
  ]);

  return (
    <div>
      <AutoRefresh intervalMs={60_000} />
      <PageHeader
        title="AI Credits"
        description="Credits power AI features like the study tutor and practice tests."
      />

      <div className="mb-6 rounded-2xl border border-stroke bg-white p-6 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-body">
          Current balance
        </p>
        <p className="mt-2 text-4xl font-bold text-foreground">
          {balance}{" "}
          <span className="text-lg font-normal text-body">
            credit{balance === 1 ? "" : "s"}
          </span>
        </p>
        <p className="mt-2 text-sm text-body">
          Credits are added by your admin. Speak to the college office to top
          up.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          {(
            [
              ["AI Tutor session", "5 credits"],
              ["Practice test", "3 credits"],
              ["Performance report", "10 credits"],
              ["Study plan", "5 credits"],
            ] as const
          ).map(([label, cost]) => (
            <div
              key={label}
              className="rounded-xl border border-stroke bg-whiter p-3"
            >
              <p className="font-medium text-foreground">{label}</p>
              <p className="mt-0.5 text-xs text-body">{cost}</p>
            </div>
          ))}
        </div>
      </div>

      {transactions.length === 0 ? (
        <div className="rounded-2xl border border-stroke bg-white p-6 text-center text-sm text-body shadow-sm">
          No credit activity yet.
        </div>
      ) : (
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
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3 text-right">Change</th>
                <th className="px-4 py-3 text-right">Balance</th>
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
