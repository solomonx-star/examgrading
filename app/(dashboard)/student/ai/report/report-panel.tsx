"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { generatePerformanceReportAction } from "@/lib/actions/performance-report";

export function ReportPanel({
  balance,
  hasExistingReport,
}: {
  balance: number;
  hasExistingReport: boolean;
}) {
  const router = useRouter();
  const [pending, startGenerate] = useTransition();
  const canGenerate = balance >= 10;

  function handleGenerate() {
    startGenerate(async () => {
      const res = await generatePerformanceReportAction();
      if (res.ok) {
        toast.success("Report generated!");
        router.refresh();
      } else {
        toast.error(res.error ?? "Could not generate report.");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {!canGenerate ? (
        <p className="text-xs text-meta-1">
          Insufficient credits (need 10)
        </p>
      ) : null}
      <button
        onClick={handleGenerate}
        disabled={pending || !canGenerate}
        className="inline-flex items-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending
          ? "Analysing your data…"
          : hasExistingReport
            ? "Generate new report (10 credits)"
            : "Get my performance report (10 credits)"}
      </button>
      {hasExistingReport && canGenerate ? (
        <p className="text-xs text-body">
          Generating a new report will not remove your previous reports.
        </p>
      ) : null}
    </div>
  );
}
