"use client";

import { useEffect, useRef } from "react";

export type ConfirmTone = "primary" | "danger";

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "primary",
  pending = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onCancel();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    confirmRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, pending, onCancel]);

  if (!open) return null;

  const confirmClasses =
    tone === "danger"
      ? "bg-meta-1 hover:bg-meta-1/90 focus-visible:outline-meta-1"
      : "bg-primary hover:bg-primary-dark focus-visible:outline-primary";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => {
          if (!pending) onCancel();
        }}
      />
      <div className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
        <h2
          id="confirm-modal-title"
          className="text-lg font-semibold text-black"
        >
          {title}
        </h2>
        <div className="mt-2 text-sm text-body">{description}</div>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="inline-flex items-center rounded-lg border border-stroke bg-white px-4 py-2 text-sm font-medium text-body shadow-sm transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className={
              "inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 " +
              confirmClasses
            }
          >
            {pending ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
