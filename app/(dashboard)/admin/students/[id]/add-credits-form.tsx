"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { addCreditsAction } from "@/lib/actions/ai-credits";
import { useToastFromState } from "@/lib/use-toast-state";
import type { FormState } from "@/lib/form-state";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-dark disabled:opacity-60"
    >
      {pending ? "Adding…" : "Add credits"}
    </button>
  );
}

export function AddCreditsForm({
  studentId,
  currentBalance,
}: {
  studentId: string;
  currentBalance: number;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(
    async (_prev: FormState, formData: FormData) => {
      const result = await addCreditsAction({
        studentId,
        amount: Number(formData.get("amount")),
        note: String(formData.get("note") ?? ""),
      });
      if (result.ok)
        return {
          ok: true,
          message: `Credits added. New balance: ${result.balance}`,
        } satisfies FormState;
      return {
        ok: false,
        error: result.error ?? "Could not add credits.",
      } satisfies FormState;
    },
    undefined,
  );
  useToastFromState(state, {
    successMessage: (state?.ok && state.message) ? state.message : "Credits added.",
  });

  return (
    <div className="rounded-2xl border border-stroke bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">AI Credits</h2>
        <span className="text-sm text-body">
          Current balance:{" "}
          <span className="font-semibold text-foreground">{currentBalance}</span>
        </span>
      </div>

      <form action={formAction} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label
              htmlFor="amount"
              className="block text-sm font-medium text-foreground"
            >
              Credits to add
            </label>
            <input
              id="amount"
              name="amount"
              type="number"
              min={1}
              max={1000}
              required
              placeholder="e.g. 20"
              className="block w-full rounded-lg border border-stroke bg-white px-3 py-2.5 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="note"
              className="block text-sm font-medium text-foreground"
            >
              Note{" "}
              <span className="font-normal text-body">(optional)</span>
            </label>
            <input
              id="note"
              name="note"
              type="text"
              maxLength={200}
              placeholder="e.g. Semester AI package"
              className="block w-full rounded-lg border border-stroke bg-white px-3 py-2.5 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {state && !state.ok ? (
          <div
            role="alert"
            className="rounded-lg border border-meta-1/30 bg-meta-1/10 px-3 py-2 text-sm text-meta-1"
          >
            {state.error}
          </div>
        ) : null}
        {state?.ok ? (
          <div
            role="status"
            className="rounded-lg border border-meta-3/30 bg-meta-3/10 px-3 py-2 text-sm text-meta-3"
          >
            {(state.ok && state.message) ? state.message : "Credits added."}
          </div>
        ) : null}

        <Submit />
      </form>
    </div>
  );
}
