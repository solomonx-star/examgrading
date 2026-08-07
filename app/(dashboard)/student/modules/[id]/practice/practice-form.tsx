"use client";

import { useActionState } from "react";
import { generatePracticeTestAction } from "@/lib/actions/practice";

export function PracticeForm({
  courseId,
  balance,
}: {
  courseId: string;
  balance: number;
}) {
  const [state, action, pending] = useActionState(
    generatePracticeTestAction,
    null,
  );
  const canGenerate = balance >= 3;

  return (
    <form action={action}>
      <input type="hidden" name="courseId" value={courseId} />

      <div className="space-y-5 rounded-2xl border border-stroke bg-white p-6 shadow-sm">
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">
            Number of questions
          </label>
          <div className="flex gap-3">
            {([5, 10, 15] as const).map((n) => (
              <label key={n} className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="count"
                  value={n}
                  defaultChecked={n === 10}
                  className="accent-primary"
                />
                <span className="text-sm text-foreground">{n}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">
            Difficulty
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            {(
              [
                ["easy", "Easy", "Basic recall and understanding"],
                ["mixed", "Mixed", "Balanced — some easier, some harder"],
                [
                  "challenging",
                  "Challenging",
                  "Analysis and application of concepts",
                ],
              ] as const
            ).map(([value, label, desc]) => (
              <label
                key={value}
                className="flex cursor-pointer items-start gap-2 rounded-xl border border-stroke bg-whiter p-3 hover:border-primary"
              >
                <input
                  type="radio"
                  name="difficulty"
                  value={value}
                  defaultChecked={value === "mixed"}
                  className="mt-0.5 accent-primary"
                />
                <span>
                  <span className="block text-sm font-medium text-foreground">
                    {label}
                  </span>
                  <span className="text-xs text-body">{desc}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        {state?.error ? (
          <p className="rounded-lg bg-meta-1/10 px-4 py-2.5 text-sm font-medium text-meta-1">
            {state.error}
          </p>
        ) : null}

        {!canGenerate ? (
          <p className="rounded-lg bg-secondary/10 px-4 py-2.5 text-sm text-foreground">
            You need at least 3 credits to generate a practice test. Contact the
            college office to top up.
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending || !canGenerate}
          className="w-full rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending
            ? "Generating… this may take a few seconds"
            : "Generate practice test (3 credits)"}
        </button>
      </div>
    </form>
  );
}
