"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createProgrammeAction } from "../actions";
import type { FormState } from "@/lib/form-state";
import { useToastFromState } from "@/lib/use-toast-state";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-dark disabled:opacity-60"
    >
      {pending ? "Creating…" : "Create programme"}
    </button>
  );
}

export function NewProgrammeForm() {
  const [state, formAction] = useActionState<FormState, FormData>(
    createProgrammeAction,
    undefined,
  );
  useToastFromState(state, { successMessage: "Programme created." });

  return (
    <form
      action={formAction}
      className="max-w-xl space-y-5 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stroke"
    >
      <Field
        id="name"
        label="Programme name"
        placeholder="e.g. BSc Computer Science"
        required
      />
      <Field id="code" label="Programme code" placeholder="e.g. BSCCS" required />

      {state && !state.ok ? (
        <div
          role="alert"
          className="rounded-lg border border-meta-1/30 bg-meta-1/10 px-3 py-2 text-sm text-meta-1"
        >
          {state.error}
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <Submit />
        <Link
          href="/admin/programmes"
          className="text-sm font-medium text-body hover:text-foreground"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  placeholder,
  required,
}: {
  id: string;
  label: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type="text"
        required={required}
        placeholder={placeholder}
        className="block w-full rounded-lg border border-stroke bg-white px-3 py-2.5 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  );
}
