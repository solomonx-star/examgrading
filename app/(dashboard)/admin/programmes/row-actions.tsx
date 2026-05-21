"use client";

import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import {
  deleteProgrammeAction,
  toggleProgrammeActiveAction,
} from "./actions";

export function ProgrammeRowActions({
  id,
  isActive,
}: {
  id: string;
  isActive: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function handleToggle() {
    const verb = isActive ? "deactivate" : "reactivate";
    if (!confirm(`Are you sure you want to ${verb} this programme?`)) return;
    startTransition(async () => {
      try {
        await toggleProgrammeActiveAction(id);
        toast.success(`Programme ${isActive ? "deactivated" : "reactivated"}.`);
      } catch {
        toast.error(`Could not ${verb} this programme.`);
      }
    });
  }

  function handleDelete() {
    if (!confirm("Delete this programme? Modules must be removed first.")) return;
    startTransition(async () => {
      try {
        const result = await deleteProgrammeAction(id);
        if (result.ok) {
          toast.success("Programme deleted.");
        } else {
          toast.error(result.error ?? "Could not delete.");
        }
      } catch {
        toast.error("Could not delete programme.");
      }
    });
  }

  return (
    <div className="inline-flex items-center gap-2">
      <Link
        href={`/admin/programmes/${id}`}
        className="rounded-md border border-stroke px-2.5 py-1 text-xs font-medium text-body hover:border-primary hover:text-primary"
      >
        Edit
      </Link>
      <button
        type="button"
        onClick={handleToggle}
        disabled={pending}
        className={
          "rounded-md px-2.5 py-1 text-xs font-medium transition disabled:opacity-60 " +
          (isActive
            ? "border border-meta-1/40 text-meta-1 hover:bg-meta-1/10"
            : "border border-meta-3/40 text-meta-3 hover:bg-meta-3/10")
        }
      >
        {isActive ? "Deactivate" : "Reactivate"}
      </button>
      <button
        type="button"
        onClick={handleDelete}
        disabled={pending}
        className="rounded-md border border-stroke px-2.5 py-1 text-xs font-medium text-meta-1 hover:border-meta-1 disabled:opacity-40"
      >
        Delete
      </button>
    </div>
  );
}
