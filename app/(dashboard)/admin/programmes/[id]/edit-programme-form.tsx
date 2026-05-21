"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { updateProgrammeAction } from "../actions";
import type { FormState } from "@/lib/form-state";
import { useToastFromState } from "@/lib/use-toast-state";

type Defaults = {
  name: string;
  code: string;
  isActive: boolean;
};

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-dark disabled:opacity-60"
    >
      {pending ? "Saving…" : "Save changes"}
    </button>
  );
}

export function EditProgrammeForm({
  id,
  defaults,
}: {
  id: string;
  defaults: Defaults;
}) {
  const bound = updateProgrammeAction.bind(null, id);
  const [state, formAction] = useActionState<FormState, FormData>(
    bound,
    undefined,
  );
  useToastFromState(state, { successMessage: "Programme updated." });

  return (
    <form
      action={formAction}
      className="max-w-xl space-y-5 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stroke"
    >
      <Field id="name" label="Programme name" defaultValue={defaults.name} required />
      <Field id="code" label="Programme code" defaultValue={defaults.code} required />

      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          id="isActive"
          name="isActive"
          type="checkbox"
          defaultChecked={defaults.isActive}
          className="h-4 w-4 rounded border-stroke text-primary focus:ring-primary"
        />
        Active
      </label>

      {state && !state.ok ? (
        <div
          role="alert"
          className="rounded-lg border border-meta-1/30 bg-meta-1/10 px-3 py-2 text-sm text-meta-1"
        >
          {state.error}
        </div>
      ) : null}
      {state && state.ok ? (
        <div
          role="status"
          className="rounded-lg border border-meta-3/30 bg-meta-3/10 px-3 py-2 text-sm text-meta-3"
        >
          {state.message ?? "Saved."}
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <Submit />
        <Link
          href="/admin/programmes"
          className="text-sm font-medium text-body hover:text-foreground"
        >
          Back
        </Link>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  defaultValue,
  required,
}: {
  id: string;
  label: string;
  defaultValue?: string;
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
        defaultValue={defaultValue}
        required={required}
        className="block w-full rounded-lg border border-stroke bg-white px-3 py-2.5 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  );
}
