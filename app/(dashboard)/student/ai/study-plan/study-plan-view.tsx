"use client";

import type { IStudyDay } from "@/models/StudyPlan";

const PRIORITY_STYLES: Record<
  "high" | "medium" | "low",
  { bar: string; label: string }
> = {
  high: { bar: "bg-meta-1", label: "text-meta-1" },
  medium: { bar: "bg-secondary", label: "text-foreground" },
  low: { bar: "bg-meta-3", label: "text-meta-3" },
};

export function StudyPlanView({ plan }: { plan: IStudyDay[] }) {
  if (plan.length === 0) {
    return (
      <div className="rounded-2xl border border-stroke bg-white p-6 text-center text-sm text-body shadow-sm">
        No study days in this plan.
      </div>
    );
  }

  // Group by week
  const weeks: Map<string, IStudyDay[]> = new Map();
  for (const day of plan) {
    const date = new Date(day.date);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay() + 1);
    const weekKey = weekStart.toISOString().split("T")[0];
    const existing = weeks.get(weekKey) ?? [];
    existing.push(day);
    weeks.set(weekKey, existing);
  }

  return (
    <div className="space-y-4">
      {Array.from(weeks.entries()).map(([weekKey, days]) => {
        const weekStart = new Date(weekKey);
        const weekLabel = weekStart.toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
        });
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        const weekEndLabel = weekEnd.toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
        });
        return (
          <div
            key={weekKey}
            className="rounded-2xl border border-stroke bg-white shadow-sm"
          >
            <div className="border-b border-stroke px-5 py-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-body">
                Week of {weekLabel} – {weekEndLabel}
              </h3>
            </div>
            <div className="divide-y divide-stroke">
              {days.map((day, i) => {
                const styles =
                  PRIORITY_STYLES[day.priority] ?? PRIORITY_STYLES.low;
                const dateLabel = new Date(day.date).toLocaleDateString(
                  "en-GB",
                  { weekday: "long", day: "2-digit", month: "short" },
                );
                return (
                  <div
                    key={i}
                    className="flex items-start gap-4 px-5 py-3.5"
                  >
                    <div
                      className={`mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full ${styles.bar}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="text-xs font-medium text-body">
                          {dateLabel}
                        </span>
                        <span
                          className={`text-xs font-semibold ${styles.label}`}
                        >
                          {day.moduleCode}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm text-foreground">
                        {day.activity}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="flex flex-wrap items-center gap-4 text-xs text-body">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-meta-1" />
          High priority
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-secondary" />
          Medium priority
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-meta-3" />
          Lower priority
        </span>
      </div>
    </div>
  );
}
