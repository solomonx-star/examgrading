"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createAdminAction } from "../actions";
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
      {pending ? "Creating…" : "Create admin"}
    </button>
  );
}

export function NewAdminForm() {
  const [state, formAction] = useActionState<FormState, FormData>(
    createAdminAction,
    undefined,
  );
  useToastFromState(state, { successMessage: "Admin created." });

  return (
    <form
      action={formAction}
      className="max-w-xl space-y-5 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stroke"
    >
      <Field id="name" label="Full name" required />
      <Field id="email" label="Email" type="email" required autoComplete="off" />
      <Field id="department" label="Department" required />
      <Field id="staffId" label="Staff ID (optional)" />

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
          href="/superadmin/admins"
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
  type = "text",
  required,
  autoComplete,
}: {
  id: string;
  label: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="block text-sm font-medium text-foreground"
      >
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        required={required}
        autoComplete={autoComplete}
        className="block w-full rounded-lg border border-stroke bg-white px-3 py-2.5 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  );
}
