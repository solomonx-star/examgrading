"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
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
  const [confirming, setConfirming] = useState<"toggle" | "delete" | null>(
    null,
  );

  function handleToggle() {
    const verb = isActive ? "deactivate" : "reactivate";
    startTransition(async () => {
      try {
        await toggleProgrammeActiveAction(id);
        toast.success(`Programme ${isActive ? "deactivated" : "reactivated"}.`);
        setConfirming(null);
      } catch {
        toast.error(`Could not ${verb} this programme.`);
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      try {
        const result = await deleteProgrammeAction(id);
        if (result.ok) {
          toast.success("Programme deleted.");
          setConfirming(null);
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
        onClick={() => setConfirming("toggle")}
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
        onClick={() => setConfirming("delete")}
        disabled={pending}
        className="rounded-md border border-stroke px-2.5 py-1 text-xs font-medium text-meta-1 hover:border-meta-1 disabled:opacity-40"
      >
        Delete
      </button>
      <ConfirmModal
        open={confirming === "toggle"}
        title={
          isActive ? "Deactivate this programme?" : "Reactivate this programme?"
        }
        description={
          isActive
            ? "New students cannot be assigned to this programme while it is deactivated. It can be reactivated later."
            : "Students can be assigned to this programme again."
        }
        confirmLabel={isActive ? "Deactivate" : "Reactivate"}
        tone={isActive ? "danger" : "primary"}
        pending={pending}
        onConfirm={handleToggle}
        onCancel={() => setConfirming(null)}
      />
      <ConfirmModal
        open={confirming === "delete"}
        title="Delete this programme?"
        description="This cannot be undone. Any modules attached to this programme must be removed first."
        confirmLabel="Delete programme"
        tone="danger"
        pending={pending}
        onConfirm={handleDelete}
        onCancel={() => setConfirming(null)}
      />
    </div>
  );
}
