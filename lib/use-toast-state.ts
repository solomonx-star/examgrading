"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import type { BulkImportState } from "@/lib/bulk-import";

type FormToastState =
  | { ok: true; message?: string }
  | { ok: false; error: string }
  | undefined;

/**
 * Fires a toast whenever a server-action FormState transitions to ok/error.
 * Falls back to "Saved." for the success message when none is supplied.
 * The toast is additive — keep your inline alert too for accessibility.
 */
export function useToastFromState(
  state: FormToastState,
  options?: { successMessage?: string },
): void {
  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success(state.message ?? options?.successMessage ?? "Saved.");
    } else {
      toast.error(state.error);
    }
    // We intentionally re-fire on every state change; `state` is a fresh object
    // per submission via useActionState.
  }, [state, options?.successMessage]);
}

/**
 * Bulk-import results: collapses the (created, skipped, failed) tally into a
 * single toast — success / info / warning / error depending on the outcome.
 */
export function useImportToast(state: BulkImportState): void {
  useEffect(() => {
    if (!state) return;
    if (!state.ok) {
      toast.error(state.error);
      return;
    }
    const { created, skipped, failed } = state.result;
    if (failed.length > 0) {
      toast.warning(
        `Imported ${created} · skipped ${skipped.length} · failed ${failed.length}`,
        { description: "Review failed rows below." },
      );
    } else if (skipped.length > 0) {
      toast.info(
        `Imported ${created} · skipped ${skipped.length} duplicate${
          skipped.length === 1 ? "" : "s"
        }`,
      );
    } else if (created > 0) {
      toast.success(
        `Imported ${created} record${created === 1 ? "" : "s"}.`,
      );
    } else {
      toast.info("Nothing to import.");
    }
  }, [state]);
}
