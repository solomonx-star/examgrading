"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

export function UserRowActions({
  editHref,
  isActive,
  onToggle,
  onResetPassword,
  onDelete,
  deleteNoun = "user",
  toggleLabel,
}: {
  editHref: string;
  isActive: boolean;
  onToggle: () => Promise<void> | void;
  onResetPassword: () => Promise<void> | void;
  onDelete?: () => Promise<{ ok: boolean; error?: string }>;
  deleteNoun?: string;
  toggleLabel?: { active: string; inactive: string };
}) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState<
    "toggle" | "reset" | "delete" | null
  >(null);
  const labels = toggleLabel ?? { active: "Deactivate", inactive: "Reactivate" };

  function handleToggle() {
    const verb = isActive ? "deactivate" : "reactivate";
    startTransition(async () => {
      try {
        await onToggle();
        toast.success(`User ${isActive ? "deactivated" : "reactivated"}.`);
        setConfirming(null);
      } catch {
        toast.error(`Could not ${verb} this user.`);
      }
    });
  }

  function handleReset() {
    startTransition(async () => {
      try {
        await onResetPassword();
        toast.success("Password reset to default.");
        setConfirming(null);
      } catch {
        toast.error("Could not reset password.");
      }
    });
  }

  function handleDelete() {
    if (!onDelete) return;
    startTransition(async () => {
      try {
        const res = await onDelete();
        if (res.ok) {
          toast.success(`${cap(deleteNoun)} deleted.`);
          setConfirming(null);
        } else {
          toast.error(res.error ?? `Could not delete ${deleteNoun}.`);
        }
      } catch {
        toast.error(`Could not delete ${deleteNoun}.`);
      }
    });
  }

  return (
    <div className="inline-flex items-center gap-2">
      <Link
        href={editHref}
        className="rounded-md border border-stroke px-2.5 py-1 text-xs font-medium text-body hover:border-primary hover:text-primary"
      >
        Edit
      </Link>
      <button
        type="button"
        onClick={() => setConfirming("reset")}
        disabled={pending}
        className="rounded-md border border-stroke px-2.5 py-1 text-xs font-medium text-body hover:border-primary hover:text-primary disabled:opacity-60"
      >
        Reset pwd
      </button>
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
        {isActive ? labels.active : labels.inactive}
      </button>
      {onDelete ? (
        <button
          type="button"
          onClick={() => setConfirming("delete")}
          disabled={pending}
          className="rounded-md border border-stroke px-2.5 py-1 text-xs font-medium text-meta-1 hover:border-meta-1 disabled:opacity-40"
        >
          Delete
        </button>
      ) : null}
      <ConfirmModal
        open={confirming === "reset"}
        title="Reset password?"
        description={`Reset this ${deleteNoun}'s password to the default (iamco1234). They will be required to change it on their next login.`}
        confirmLabel="Reset password"
        tone="primary"
        pending={pending}
        onConfirm={handleReset}
        onCancel={() => setConfirming(null)}
      />
      <ConfirmModal
        open={confirming === "toggle"}
        title={
          isActive ? `${labels.active} this ${deleteNoun}?` : `${labels.inactive} this ${deleteNoun}?`
        }
        description={
          isActive
            ? `This ${deleteNoun} will lose access until reactivated. Existing records are kept.`
            : `This ${deleteNoun} will regain access immediately.`
        }
        confirmLabel={isActive ? labels.active : labels.inactive}
        tone={isActive ? "danger" : "primary"}
        pending={pending}
        onConfirm={handleToggle}
        onCancel={() => setConfirming(null)}
      />
      {onDelete ? (
        <ConfirmModal
          open={confirming === "delete"}
          title={`Delete this ${deleteNoun}?`}
          description={`This cannot be undone. The action will be blocked if academic records exist for this ${deleteNoun}.`}
          confirmLabel={`Delete ${deleteNoun}`}
          tone="danger"
          pending={pending}
          onConfirm={handleDelete}
          onCancel={() => setConfirming(null)}
        />
      ) : null}
    </div>
  );
}

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
