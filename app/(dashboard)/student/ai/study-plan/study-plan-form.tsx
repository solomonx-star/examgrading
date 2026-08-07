"use client";

import { useActionState } from "react";
import { generateStudyPlanAction } from "@/lib/actions/study-plan";

const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export function StudyPlanForm({
  balance,
  isFreeRegen,
}: {
  balance: number;
  isFreeRegen: boolean;
}) {
  const [state, action, pending] = useActionState(
    generateStudyPlanAction,
    null,
  );
  const canGenerate = isFreeRegen || balance >= 5;

  return (
    <form action={action}>
      <div className="space-y-5 rounded-2xl border border-stroke bg-white p-6 shadow-sm">
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">
            Hours available per day
          </label>
          <div className="flex flex-wrap gap-3">
            {[1, 2, 3, 4].map((h) => (
              <label key={h} className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="hoursPerDay"
                  value={h}
                  defaultChecked={h === 2}
                  className="accent-primary"
                />
                <span className="text-sm text-foreground">
                  {h === 4 ? "4+" : h}h
                </span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">
            Days you can study (select all that apply)
          </label>
          <div className="flex flex-wrap gap-2">
            {DAYS_OF_WEEK.map((day) => (
              <label
                key={day}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-stroke bg-whiter px-3 py-2 text-sm hover:border-primary"
              >
                <input
                  type="checkbox"
                  name="studyDays"
                  value={day}
                  defaultChecked={
                    day !== "Saturday" && day !== "Sunday"
                  }
                  className="accent-primary"
                />
                {day.slice(0, 3)}
              </label>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-body">
            The plan only schedules sessions on days you select.
          </p>
        </div>

        {state?.error ? (
          <p className="rounded-lg bg-meta-1/10 px-4 py-2.5 text-sm font-medium text-meta-1">
            {state.error}
          </p>
        ) : null}

        {!canGenerate ? (
          <p className="rounded-lg bg-secondary/10 px-4 py-2.5 text-sm text-foreground">
            You need at least 5 credits to generate a study plan. Contact the
            college office to top up.
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending || !canGenerate}
          className="w-full rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending
            ? "Building your plan…"
            : isFreeRegen
              ? "Regenerate plan (free)"
              : "Generate study plan (5 credits)"}
        </button>
      </div>
    </form>
  );
}
