"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createAcademicPeriodAction } from "./actions";
import type { FormState } from "@/lib/form-state";
import { useToastFromState } from "@/lib/use-toast-state";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-dark disabled:opacity-60"
    >
      {pending ? "Adding…" : "Add period"}
    </button>
  );
}

export function NewPeriodForm() {
  const [state, formAction] = useActionState<FormState, FormData>(
    createAcademicPeriodAction,
    undefined,
  );
  useToastFromState(state, { successMessage: "Academic period added." });

  return (
    <form action={formAction} className="space-y-3">
      <div className="space-y-1">
        <label
          htmlFor="year"
          className="block text-xs font-medium text-foreground"
        >
          Year
        </label>
        <input
          id="year"
          name="year"
          required
          placeholder="2025/2026"
          pattern="\d{4}/\d{4}"
          className="block w-full rounded-md border border-stroke bg-white px-2.5 py-1.5 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      <div className="space-y-1">
        <label
          htmlFor="semester"
          className="block text-xs font-medium text-foreground"
        >
          Semester
        </label>
        <select
          id="semester"
          name="semester"
          required
          className="block w-full rounded-md border border-stroke bg-white px-2.5 py-1.5 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="First">First</option>
          <option value="Second">Second</option>
          <option value="Summer">Summer</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label
            htmlFor="startDate"
            className="block text-xs font-medium text-foreground"
          >
            Start
          </label>
          <input
            id="startDate"
            name="startDate"
            type="date"
            required
            className="block w-full rounded-md border border-stroke bg-white px-2.5 py-1.5 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="space-y-1">
          <label
            htmlFor="endDate"
            className="block text-xs font-medium text-foreground"
          >
            End
          </label>
          <input
            id="endDate"
            name="endDate"
            type="date"
            required
            className="block w-full rounded-md border border-stroke bg-white px-2.5 py-1.5 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>
      <div className="space-y-1">
        <label
          htmlFor="accessFee"
          className="block text-xs font-medium text-foreground"
        >
          Access fee (NLe per student)
        </label>
        <input
          id="accessFee"
          name="accessFee"
          type="number"
          min={0}
          step="0.01"
          defaultValue={0}
          className="block w-full rounded-md border border-stroke bg-white px-2.5 py-1.5 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <p className="text-[11px] text-body">
          0 means students access this period for free.
        </p>
      </div>
      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          name="isCurrent"
          type="checkbox"
          className="h-4 w-4 rounded border-stroke text-primary focus:ring-primary"
        />
        Set as current
      </label>

      {state && !state.ok ? (
        <div
          role="alert"
          className="rounded-md border border-meta-1/30 bg-meta-1/10 px-2.5 py-1.5 text-xs text-meta-1"
        >
          {state.error}
        </div>
      ) : null}

      <Submit />
    </form>
  );
}
