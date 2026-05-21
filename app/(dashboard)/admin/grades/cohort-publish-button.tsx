"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { publishCohortGradesAction } from "./actions";

export function CohortPublishButton({
  programmeId,
  yearLevel,
  academicYear,
  semester,
}: {
  programmeId: string;
  yearLevel: number;
  academicYear: string;
  semester: "First" | "Second" | "Summer";
}) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function publish() {
    startTransition(async () => {
      try {
        const res = await publishCohortGradesAction({
          programmeId,
          yearLevel,
          academicYear,
          semester,
        });
        if (res.ok) {
          toast.success(
            `Published ${res.count ?? 0} grade${res.count === 1 ? "" : "s"} across the cohort.`,
          );
          setConfirming(false);
        } else {
          toast.error(res.error ?? "Could not publish cohort grades.");
        }
      } catch {
        toast.error("Could not publish cohort grades.");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        disabled={pending}
        className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-dark disabled:opacity-60"
      >
        {pending ? "Publishing…" : "Publish whole cohort"}
      </button>
      <ConfirmModal
        open={confirming}
        title="Publish cohort grades?"
        description={
          <>
            This will publish every submitted grade for this entire cohort.
            Students will see their results immediately.
          </>
        }
        confirmLabel="Publish cohort"
        pending={pending}
        onConfirm={publish}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}
