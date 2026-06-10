"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createTestAction } from "../actions";
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
      {pending ? "Creating…" : "Create test"}
    </button>
  );
}

function defaultStartLocal(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 30 - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}
function defaultEndLocal(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 90 - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function CreateTestForm({ courseId }: { courseId: string }) {
  const bound = createTestAction.bind(null, courseId);
  const [state, formAction] = useActionState<FormState, FormData>(
    bound,
    undefined,
  );
  useToastFromState(state, { successMessage: "Test created." });

  return (
    <form
      action={formAction}
      className="space-y-5 rounded-2xl border border-stroke bg-white p-6 shadow-sm"
    >
      <div>
        <label
          htmlFor="title"
          className="block text-xs font-medium uppercase tracking-wide text-body"
        >
          Title
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          maxLength={120}
          placeholder="e.g. Mid-semester quiz"
          className="mt-1 w-full rounded-md border border-stroke bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div>
        <label
          htmlFor="description"
          className="block text-xs font-medium uppercase tracking-wide text-body"
        >
          Description <span className="text-body/60">(optional)</span>
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          maxLength={500}
          placeholder="Topics covered, instructions, anything students should know before starting."
          className="mt-1 w-full rounded-md border border-stroke bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="startsAt"
            className="block text-xs font-medium uppercase tracking-wide text-body"
          >
            Opens at
          </label>
          <input
            id="startsAt"
            name="startsAt"
            type="datetime-local"
            required
            defaultValue={defaultStartLocal()}
            className="mt-1 w-full rounded-md border border-stroke bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <label
            htmlFor="endsAt"
            className="block text-xs font-medium uppercase tracking-wide text-body"
          >
            Closes at
          </label>
          <input
            id="endsAt"
            name="endsAt"
            type="datetime-local"
            required
            defaultValue={defaultEndLocal()}
            className="mt-1 w-full rounded-md border border-stroke bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="durationMinutes"
          className="block text-xs font-medium uppercase tracking-wide text-body"
        >
          Time limit (minutes)
        </label>
        <input
          id="durationMinutes"
          name="durationMinutes"
          type="number"
          min={1}
          max={600}
          required
          defaultValue={30}
          className="mt-1 w-32 rounded-md border border-stroke bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <p className="mt-1 text-xs text-body">
          The timer starts the moment a student opens the test.
        </p>
      </div>

      {state && !state.ok ? (
        <div
          role="alert"
          className="rounded-lg border border-meta-1/30 bg-meta-1/10 px-3 py-2 text-sm text-meta-1"
        >
          {state.error}
        </div>
      ) : null}

      <div className="flex items-center justify-between border-t border-stroke pt-4">
        <p className="text-xs text-body">
          You&apos;ll add questions on the next screen.
        </p>
        <Submit />
      </div>
    </form>
  );
}
