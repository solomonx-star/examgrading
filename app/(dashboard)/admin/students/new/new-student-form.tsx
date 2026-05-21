"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createStudentAction } from "../actions";
import type { FormState } from "@/lib/form-state";
import { useToastFromState } from "@/lib/use-toast-state";

type ProgrammeChoice = { id: string; name: string; code: string };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-dark disabled:opacity-60"
    >
      {pending ? "Creating…" : "Create student"}
    </button>
  );
}

export function NewStudentForm({
  programmes,
}: {
  programmes: ProgrammeChoice[];
}) {
  const [state, formAction] = useActionState<FormState, FormData>(
    createStudentAction,
    undefined,
  );
  useToastFromState(state, { successMessage: "Student created." });

  return (
    <form
      action={formAction}
      className="max-w-xl space-y-5 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stroke"
    >
      <Field id="name" label="Full name" required />
      <Field id="email" label="Email" type="email" required />

      <div className="space-y-1.5">
        <label
          htmlFor="programmeId"
          className="block text-sm font-medium text-foreground"
        >
          Programme
        </label>
        <select
          id="programmeId"
          name="programmeId"
          required
          defaultValue=""
          className="block w-full rounded-lg border border-stroke bg-white px-3 py-2.5 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="" disabled>
            — Select a programme —
          </option>
          {programmes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.code})
            </option>
          ))}
        </select>
        {programmes.length === 0 ? (
          <p className="text-xs text-meta-1">
            No active programmes yet.{" "}
            <Link
              href="/admin/programmes/new"
              className="font-medium underline"
            >
              Create one first.
            </Link>
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="yearLevel"
          className="block text-sm font-medium text-foreground"
        >
          Year level
        </label>
        <select
          id="yearLevel"
          name="yearLevel"
          required
          defaultValue="1"
          className="block w-full rounded-lg border border-stroke bg-white px-3 py-2.5 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="1">Year 1</option>
          <option value="2">Year 2</option>
          <option value="3">Year 3</option>
          <option value="4">Year 4</option>
        </select>
      </div>

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
          href="/admin/students"
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
}: {
  id: string;
  label: string;
  type?: string;
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
        type={type}
        required={required}
        className="block w-full rounded-lg border border-stroke bg-white px-3 py-2.5 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  );
}
