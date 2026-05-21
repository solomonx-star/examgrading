"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import {
  changePasswordAction,
  type ChangePasswordState,
} from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex w-full items-center justify-center rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Updating…" : "Update password"}
    </button>
  );
}

export function ChangePasswordForm() {
  const [state, formAction] = useActionState<ChangePasswordState, FormData>(
    changePasswordAction,
    undefined,
  );
  // Success signs out + redirects, so usually only errors surface here.
  useEffect(() => {
    if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <form
      action={formAction}
      className="space-y-5 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stroke"
    >
      <Field
        id="currentPassword"
        label="Current password"
        autoComplete="current-password"
      />
      <Field
        id="newPassword"
        label="New password"
        autoComplete="new-password"
        hint="At least 8 characters."
      />
      <Field
        id="confirmPassword"
        label="Confirm new password"
        autoComplete="new-password"
      />

      {state?.error ? (
        <div
          role="alert"
          className="rounded-lg border border-meta-1/30 bg-meta-1/10 px-3 py-2 text-sm text-meta-1"
        >
          {state.error}
        </div>
      ) : null}

      <SubmitButton />
    </form>
  );
}

function Field({
  id,
  label,
  autoComplete,
  hint,
}: {
  id: string;
  label: string;
  autoComplete: string;
  hint?: string;
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
        type="password"
        autoComplete={autoComplete}
        required
        minLength={8}
        className="block w-full rounded-lg border border-stroke bg-white px-3 py-2.5 text-sm text-foreground placeholder-body shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      />
      {hint ? <p className="text-xs text-body">{hint}</p> : null}
    </div>
  );
}
