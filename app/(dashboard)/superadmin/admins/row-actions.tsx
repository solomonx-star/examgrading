"use client";

import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import {
  resetAdminPasswordAction,
  toggleAdminActiveAction,
} from "./actions";

export function AdminRowActions({
  id,
  isActive,
}: {
  id: string;
  isActive: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function handleToggle() {
    const word = isActive ? "deactivate" : "reactivate";
    if (!confirm(`Are you sure you want to ${word} this admin?`)) return;
    startTransition(async () => {
      try {
        await toggleAdminActiveAction(id);
        toast.success(`Admin ${isActive ? "deactivated" : "reactivated"}.`);
      } catch {
        toast.error(`Could not ${word} this admin.`);
      }
    });
  }

  function handleReset() {
    if (
      !confirm(
        "Reset this admin's password to the default (iamco1234) and require change on next login?",
      )
    )
      return;
    startTransition(async () => {
      try {
        await resetAdminPasswordAction(id);
        toast.success("Password reset to default.");
      } catch {
        toast.error("Could not reset password.");
      }
    });
  }

  return (
    <div className="inline-flex items-center gap-2">
      <Link
        href={`/superadmin/admins/${id}`}
        className="rounded-md border border-stroke px-2.5 py-1 text-xs font-medium text-body hover:border-primary hover:text-primary"
      >
        Edit
      </Link>
      <button
        type="button"
        onClick={handleReset}
        disabled={pending}
        className="rounded-md border border-stroke px-2.5 py-1 text-xs font-medium text-body hover:border-primary hover:text-primary disabled:opacity-60"
      >
        Reset pwd
      </button>
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
