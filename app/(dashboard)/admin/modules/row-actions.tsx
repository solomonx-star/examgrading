"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { deleteCourseAction, toggleCourseActiveAction } from "./actions";

export function ModuleRowActions({
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
        await toggleCourseActiveAction(id);
        toast.success(`Module ${isActive ? "deactivated" : "reactivated"}.`);
        setConfirming(null);
      } catch {
        toast.error(`Could not ${verb} this module.`);
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      try {
        const res = await deleteCourseAction(id);
        if (res.ok) {
          toast.success("Module deleted.");
          setConfirming(null);
        } else {
          toast.error(res.error ?? "Could not delete module.");
        }
      } catch {
        toast.error("Could not delete module.");
      }
    });
  }

  return (
    <div className="inline-flex items-center gap-2">
      <Link
        href={`/admin/modules/${id}`}
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
        title={isActive ? "Deactivate this module?" : "Reactivate this module?"}
        description={
          isActive
            ? "Students will lose access to the module. Existing grades and attendance stay intact and the module can be reactivated later."
            : "Students will regain access to the module."
        }
        confirmLabel={isActive ? "Deactivate" : "Reactivate"}
        tone={isActive ? "danger" : "primary"}
        pending={pending}
        onConfirm={handleToggle}
        onCancel={() => setConfirming(null)}
      />
      <ConfirmModal
        open={confirming === "delete"}
        title="Delete this module?"
        description="This cannot be undone. The delete will be blocked if grades or attendance records exist for the module."
        confirmLabel="Delete module"
        tone="danger"
        pending={pending}
        onConfirm={handleDelete}
        onCancel={() => setConfirming(null)}
      />
    </div>
  );
}
