"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Parts = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
};

function diff(targetMs: number): Parts {
  const totalMs = Math.max(0, targetMs - Date.now());
  const totalSeconds = Math.floor(totalMs / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds, totalMs };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Live countdown to a future ISO date. When it reaches zero, refreshes the
 * route so the student lands on the live test view.
 *
 * `variant="block"` is a centred card (used on the take-test page).
 * `variant="inline"` is a compact pill (used in the tests list).
 */
export function TestStartCountdown({
  startsAtIso,
  variant = "block",
}: {
  startsAtIso: string;
  variant?: "block" | "inline";
}) {
  const router = useRouter();
  const target = new Date(startsAtIso).getTime();
  const [parts, setParts] = useState<Parts>(() => diff(target));

  useEffect(() => {
    const id = window.setInterval(() => {
      const next = diff(target);
      setParts(next);
      if (next.totalMs <= 0) {
        window.clearInterval(id);
        router.refresh();
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [target, router]);

  const tense = parts.totalMs <= 0 ? "Opens now" : "Opens in";

  if (variant === "inline") {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-secondary/20 px-2.5 py-0.5 text-xs font-medium text-foreground tabular-nums"
        title={new Date(startsAtIso).toLocaleString("en-GB")}
        aria-live="polite"
      >
        <span className="text-body">{tense}</span>
        {parts.days > 0 ? <span>{parts.days}d</span> : null}
        <span>
          {pad(parts.hours)}:{pad(parts.minutes)}:{pad(parts.seconds)}
        </span>
      </span>
    );
  }

  return (
    <div className="rounded-2xl border border-stroke bg-white p-8 text-center shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-body">
        {tense}
      </p>
      <p
        className="mt-2 text-4xl font-bold tabular-nums text-foreground"
        aria-live="polite"
      >
        {parts.days > 0 ? `${parts.days}d ` : ""}
        {pad(parts.hours)}:{pad(parts.minutes)}:{pad(parts.seconds)}
      </p>
      <p className="mt-2 text-sm text-body">
        Opens at {new Date(startsAtIso).toLocaleString("en-GB")}. The page will
        refresh automatically when it&apos;s time to start.
      </p>
    </div>
  );
}
