import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { PerformanceReport } from "@/models/PerformanceReport";
import { requireActiveStudentAccess } from "@/lib/student-scope";
import { getBalance } from "@/lib/ai-credits-service";
import { PageHeader } from "@/components/ui/PageHeader";
import { ReportPanel } from "./report-panel";

export const dynamic = "force-dynamic";

export default async function PerformanceReportPage() {
  const me = await requireActiveStudentAccess();
  await connectDB();

  const meOid = new mongoose.Types.ObjectId(me.userId);
  const [balance, reports] = await Promise.all([
    getBalance(me.userId),
    PerformanceReport.find({ studentId: meOid })
      .sort({ generatedAt: -1 })
      .limit(5)
      .lean(),
  ]);

  const latestReport = reports[0] ?? null;

  return (
    <div>
      <PageHeader
        title="AI Performance Coach"
        description="Personalised analysis of your grades, attendance, and study patterns."
      />

      <div className="mb-6 rounded-2xl border border-stroke bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-foreground">
              AI credit balance:{" "}
              <span className="font-bold">{balance} credit{balance === 1 ? "" : "s"}</span>
            </p>
            <p className="mt-1 text-xs text-body">
              Generating a performance report costs <strong>10 credits</strong>.
              Reports are saved — you can re-read past reports without extra cost.
            </p>
          </div>
          <ReportPanel balance={balance} hasExistingReport={!!latestReport} />
        </div>
      </div>

      {latestReport ? (
        <div className="rounded-2xl border border-stroke bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-foreground">
              Latest report
            </h2>
            <p className="text-xs text-body">
              Generated{" "}
              {new Date(latestReport.generatedAt).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
          <div className="prose prose-sm max-w-none text-sm leading-relaxed text-foreground">
            {latestReport.content.split("\n\n").map((para, i) => (
              <p key={i} className="mb-3 last:mb-0">
                {para}
              </p>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-stroke bg-white p-10 text-center text-sm text-body shadow-sm">
          No report generated yet. Generate your first report above.
        </div>
      )}

      {reports.length > 1 ? (
        <div className="mt-4">
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-body">
            Previous reports
          </h3>
          <div className="space-y-2">
            {reports.slice(1).map((r) => (
              <details
                key={String(r._id)}
                className="rounded-xl border border-stroke bg-white shadow-sm"
              >
                <summary className="cursor-pointer px-5 py-3 text-sm font-medium text-foreground hover:bg-whiter">
                  {new Date(r.generatedAt).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </summary>
                <div className="border-t border-stroke px-5 py-4 text-sm leading-relaxed text-foreground">
                  {r.content.split("\n\n").map((para, i) => (
                    <p key={i} className="mb-3 last:mb-0">
                      {para}
                    </p>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
