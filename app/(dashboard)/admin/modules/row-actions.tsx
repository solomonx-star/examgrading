"use client";

import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { toggleCourseActiveAction } from "./actions";

export function ModuleRowActions({
  id,
  isActive,
}: {
  id: string;
  isActive: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function handleToggle() {
    const verb = isActive ? "deactivate" : "reactivate";
    if (!confirm(`Are you sure you want to ${verb} this course?`)) return;
    startTransition(async () => {
      try {
        await toggleCourseActiveAction(id);
        toast.success(`Course ${isActive ? "deactivated" : "reactivated"}.`);
      } catch {
        toast.error(`Could not ${verb} this course.`);
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
    </div>
  );
}
