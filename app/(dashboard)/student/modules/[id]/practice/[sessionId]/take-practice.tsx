"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { submitPracticeTestAction } from "@/lib/actions/practice";

type Option = { id: string; text: string };
type Question = {
  id: string;
  prompt: string;
  options: Option[];
  correctId: string | null;
  explanation: string | null;
};

function formatPercent(score: number, max: number): string {
  if (max === 0) return "0%";
  return `${Math.round((score / max) * 100)}%`;
}

export function TakePractice({
  sessionId,
  questions,
  alreadySubmitted,
  initialScore,
  maxScore,
  submittedAnswers,
}: {
  sessionId: string;
  questions: Question[];
  alreadySubmitted: boolean;
  initialScore: number | null;
  maxScore: number;
  submittedAnswers: Record<string, string> | null;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>(
    submittedAnswers ?? {},
  );
  const [submitted, setSubmitted] = useState(alreadySubmitted);
  const [score, setScore] = useState<number | null>(initialScore);
  const [pending, startSubmit] = useTransition();

  function select(qid: string, oid: string) {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [qid]: oid }));
  }

  function handleSubmit() {
    const unanswered = questions.filter((q) => !answers[q.id]);
    if (unanswered.length > 0) {
      toast.warning(
        `${unanswered.length} question${unanswered.length === 1 ? "" : "s"} unanswered. Answer all before submitting.`,
      );
      return;
    }
    startSubmit(async () => {
      const res = await submitPracticeTestAction({
        sessionId,
        answers,
      });
      if (res.ok) {
        setScore(res.score ?? 0);
        setSubmitted(true);
        toast.success(
          `Submitted — ${res.score}/${res.maxScore} correct (${formatPercent(res.score ?? 0, res.maxScore ?? maxScore)})`,
        );
      } else {
        toast.error(res.error ?? "Could not submit.");
      }
    });
  }

  return (
    <div className="space-y-4">
      {submitted && score !== null ? (
        <div className="rounded-2xl border border-meta-3/30 bg-meta-3/10 p-5 text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-meta-3">
            Practice complete
          </p>
          <p className="mt-1 text-3xl font-bold text-foreground">
            {formatPercent(score, maxScore)}
          </p>
          <p className="mt-1 text-sm text-body">
            {score} / {maxScore} correct
          </p>
          <p className="mt-2 text-xs text-body">
            Correct answers and explanations are shown below.
          </p>
        </div>
      ) : null}

      {questions.map((q, idx) => {
        const selected = answers[q.id] ?? null;
        const isCorrect = submitted && selected === q.correctId;
        const isWrong = submitted && selected !== null && selected !== q.correctId;

        return (
          <div
            key={q.id}
            className={`rounded-2xl border bg-white p-5 shadow-sm ${
              submitted
                ? isCorrect
                  ? "border-meta-3/40"
                  : isWrong
                    ? "border-meta-1/40"
                    : "border-stroke"
                : "border-stroke"
            }`}
          >
            <p className="mb-3 text-sm font-medium text-foreground">
              <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {idx + 1}
              </span>
              {q.prompt}
            </p>

            <div className="space-y-2">
              {q.options.map((opt) => {
                const isSelected = selected === opt.id;
                const isAnswer = submitted && q.correctId === opt.id;
                const isWrongChoice =
                  submitted && isSelected && opt.id !== q.correctId;

                let cls =
                  "flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition-colors";

                if (!submitted) {
                  cls += isSelected
                    ? " border-primary bg-primary/10 text-primary"
                    : " border-stroke hover:border-primary/50 hover:bg-whiter text-foreground";
                } else {
                  if (isAnswer) {
                    cls += " border-meta-3/40 bg-meta-3/10 text-meta-3 font-medium";
                  } else if (isWrongChoice) {
                    cls += " border-meta-1/40 bg-meta-1/10 text-meta-1";
                  } else {
                    cls += " border-stroke text-body";
                  }
                }

                return (
                  <label key={opt.id} className={cls}>
                    <input
                      type="radio"
                      name={q.id}
                      value={opt.id}
                      checked={isSelected}
                      onChange={() => select(q.id, opt.id)}
                      disabled={submitted}
                      className="mt-0.5 accent-primary"
                    />
                    <span>
                      <span className="font-medium">{opt.id}.</span> {opt.text}
                      {isAnswer && submitted ? (
                        <span className="ml-2 text-xs">✓ Correct</span>
                      ) : null}
                    </span>
                  </label>
                );
              })}
            </div>

            {submitted && q.explanation ? (
              <p className="mt-3 rounded-lg bg-whiter px-3 py-2 text-xs text-body">
                <strong className="text-foreground">Explanation:</strong>{" "}
                {q.explanation}
              </p>
            ) : null}
          </div>
        );
      })}

      {!submitted ? (
        <div className="sticky bottom-4 flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={pending}
            className="rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white shadow-lg hover:bg-primary/90 disabled:opacity-60"
          >
            {pending ? "Submitting…" : "Submit answers"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
