"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { startTestAction, submitTestAction } from "../actions";
import { formatPercent } from "@/lib/format";

type QuestionType = "mcq" | "true_false" | "multi";

type PublicOption = { id: string; text: string };
type PublicQuestion = {
  id: string;
  type: QuestionType;
  prompt: string;
  points: number;
  options: PublicOption[];
};

function formatRemaining(ms: number): string {
  const clamped = Math.max(0, ms);
  const totalSeconds = Math.floor(clamped / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function TakeTest({
  courseId,
  testId,
  started,
  deadlineIso,
  endsAtIso,
  durationMinutes,
  questions,
}: {
  courseId: string;
  testId: string;
  started: boolean;
  deadlineIso: string;
  endsAtIso: string;
  durationMinutes: number;
  questions: PublicQuestion[];
}) {
  const router = useRouter();
  const [hasStarted, setHasStarted] = useState(started);
  const [startPending, startStart] = useTransition();
  const [submitPending, startSubmit] = useTransition();
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [deadline, setDeadline] = useState(() => new Date(deadlineIso).getTime());
  const [now, setNow] = useState(() => Date.now());
  const submittedRef = useRef(false);

  // When the server has already started this submission, the deadline arrives
  // pre-computed. When it hasn't, we recompute it after the start action runs.
  const endsAt = useMemo(() => new Date(endsAtIso).getTime(), [endsAtIso]);

  useEffect(() => {
    if (!hasStarted) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [hasStarted]);

  function toggleAnswer(qid: string, oid: string, type: QuestionType) {
    setAnswers((prev) => {
      const current = prev[qid] ?? [];
      if (type === "multi") {
        return {
          ...prev,
          [qid]: current.includes(oid)
            ? current.filter((x) => x !== oid)
            : [...current, oid],
        };
      }
      return { ...prev, [qid]: [oid] };
    });
  }

  const submit = useCallback(
    (auto: boolean) => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      startSubmit(async () => {
        const payload = {
          answers: Object.entries(answers).map(([questionId, selectedOptionIds]) => ({
            questionId,
            selectedOptionIds,
          })),
        };
        const res = await submitTestAction(courseId, testId, payload);
        if (res.ok) {
          const scoreLabel = formatPercent(res.percentage ?? 0);
          toast.success(
            auto
              ? `Time's up — submitted (${scoreLabel}).`
              : `Submitted (${scoreLabel}).`,
          );
          router.refresh();
        } else {
          submittedRef.current = false;
          toast.error(res.error ?? "Could not submit.");
        }
      });
    },
    [answers, courseId, router, testId],
  );

  const remaining = deadline - now;
  useEffect(() => {
    if (!hasStarted) return;
    if (remaining <= 0 && !submittedRef.current) {
      submit(true);
    }
  }, [remaining, hasStarted, submit]);

  if (!hasStarted) {
    const overall = Math.max(0, endsAt - now);
    return (
      <div className="rounded-2xl border border-stroke bg-white p-8 text-center shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-body">
          Ready to start?
        </p>
        <p className="mt-2 text-2xl font-bold text-foreground">
          {questions.length} question{questions.length === 1 ? "" : "s"} ·{" "}
          {durationMinutes} minutes
        </p>
        <p className="mt-2 text-sm text-body">
          Once you start, the {durationMinutes}-minute timer begins immediately.
          You can only take this test once. The test window closes in roughly{" "}
          {formatRemaining(overall)}.
        </p>
        <button
          type="button"
          disabled={startPending}
          onClick={() => {
            startStart(async () => {
              const res = await startTestAction(courseId, testId);
              if (res.ok) {
                setHasStarted(true);
                const computed =
                  Date.now() + durationMinutes * 60_000;
                setDeadline(Math.min(computed, endsAt));
                router.refresh();
              } else {
                toast.error(res.error ?? "Could not start test.");
              }
            });
          }}
          className="mt-6 inline-flex items-center rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary-dark disabled:opacity-60"
        >
          {startPending ? "Starting…" : "Start test"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stroke bg-white px-5 py-3 shadow-sm">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-body">
            Time remaining
          </p>
          <p
            className={`text-2xl font-bold tabular-nums ${
              remaining < 60_000 ? "text-meta-1" : "text-foreground"
            }`}
          >
            {formatRemaining(remaining)}
          </p>
        </div>
        <button
          type="button"
          disabled={submitPending}
          onClick={() => {
            if (
              !confirm(
                "Submit your answers? You will not be able to change them after.",
              )
            )
              return;
            submit(false);
          }}
          className="inline-flex items-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-dark disabled:opacity-60"
        >
          {submitPending ? "Submitting…" : "Submit test"}
        </button>
      </div>

      {questions.map((q, idx) => {
        const selected = answers[q.id] ?? [];
        const isMulti = q.type === "multi";
        return (
          <article
            key={q.id}
            className="space-y-3 rounded-2xl border border-stroke bg-white p-5 shadow-sm"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-base font-semibold text-foreground">
                {idx + 1}. {q.prompt}
              </h3>
              <span className="shrink-0 text-xs text-body">
                {q.points} pt{q.points === 1 ? "" : "s"}
              </span>
            </div>
            <p className="text-[11px] uppercase tracking-wide text-body">
              {isMulti ? "Select all that apply" : "Select one"}
            </p>
            <div className="space-y-2">
              {q.options.map((o) => {
                const checked = selected.includes(o.id);
                return (
                  <label
                    key={o.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition ${
                      checked
                        ? "border-primary bg-primary/5"
                        : "border-stroke bg-white hover:border-primary/50"
                    }`}
                  >
                    <input
                      type={isMulti ? "checkbox" : "radio"}
                      name={`q-${q.id}`}
                      checked={checked}
                      onChange={() => toggleAnswer(q.id, o.id, q.type)}
                      className="h-4 w-4 text-primary"
                    />
                    <span className="text-foreground">{o.text}</span>
                  </label>
                );
              })}
            </div>
          </article>
        );
      })}

      <div className="flex items-center justify-end">
        <button
          type="button"
          disabled={submitPending}
          onClick={() => {
            if (
              !confirm(
                "Submit your answers? You will not be able to change them after.",
              )
            )
              return;
            submit(false);
          }}
          className="inline-flex items-center rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary-dark disabled:opacity-60"
        >
          {submitPending ? "Submitting…" : "Submit test"}
        </button>
      </div>
    </div>
  );
}
