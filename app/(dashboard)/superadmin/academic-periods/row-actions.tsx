"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import {
  deletePeriodAction,
  setCurrentPeriodAction,
} from "./actions";

export function PeriodRowActions({
  id,
  isCurrent,
}: {
  id: string;
  isCurrent: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function handleSetCurrent() {
    if (isCurrent) return;
    if (
      !confirm(
        "Make this the current academic period? This will mark any other current period inactive.",
      )
    )
      return;
    startTransition(async () => {
      try {
        await setCurrentPeriodAction(id);
        toast.success("Set as current academic period.");
      } catch {
        toast.error("Could not set as current.");
      }
    });
  }

  function handleDelete() {
    if (isCurrent) return;
    if (
      !confirm(
        "Delete this academic period? This cannot be undone if no records reference it.",
      )
    )
      return;
    startTransition(async () => {
      try {
        await deletePeriodAction(id);
        toast.success("Academic period deleted.");
      } catch {
        toast.error("Could not delete academic period.");
      }
    });
  }

  return (
    <div className="inline-flex items-center gap-2">
      {!isCurrent ? (
        <button
          type="button"
          onClick={handleSetCurrent}
          disabled={pending}
          className="rounded-md border border-stroke px-2.5 py-1 text-xs font-medium text-body hover:border-primary hover:text-primary disabled:opacity-60"
        >
          Make current
        </button>
      ) : null}
      <button
        type="button"
        onClick={handleDelete}
        disabled={pending || isCurrent}
        title={isCurrent ? "Cannot delete the current period" : ""}
        className="rounded-md border border-stroke px-2.5 py-1 text-xs font-medium text-meta-1 hover:border-meta-1 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Delete
      </button>
    </div>
  );
}
