"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  deleteTestAction,
  publishTestAction,
  unpublishTestAction,
  updateTestAction,
} from "../actions";
import { useToastFromState } from "@/lib/use-toast-state";
import type { FormState } from "@/lib/form-state";

type QuestionType = "mcq" | "true_false" | "multi";

type Option = { id: string; text: string; isCorrect: boolean };
type Question = {
  id: string;
  type: QuestionType;
  prompt: string;
  points: number;
  options: Option[];
};

type Initial = {
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  questions: Question[];
};

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function blankQuestion(type: QuestionType): Question {
  if (type === "true_false") {
    return {
      id: uid(),
      type,
      prompt: "",
      points: 1,
      options: [
        { id: uid(), text: "True", isCorrect: false },
        { id: uid(), text: "False", isCorrect: false },
      ],
    };
  }
  return {
    id: uid(),
    type,
    prompt: "",
    points: 1,
    options: [
      { id: uid(), text: "", isCorrect: false },
      { id: uid(), text: "", isCorrect: false },
    ],
  };
}

export function TestEditor({
  courseId,
  testId,
  isPublished,
  anySubmissions,
  initial,
}: {
  courseId: string;
  testId: string;
  isPublished: boolean;
  anySubmissions: boolean;
  initial: Initial;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [startsAt, setStartsAt] = useState(initial.startsAt);
  const [endsAt, setEndsAt] = useState(initial.endsAt);
  const [durationMinutes, setDurationMinutes] = useState(
    initial.durationMinutes,
  );
  const [questions, setQuestions] = useState<Question[]>(initial.questions);

  const locked = isPublished && anySubmissions;

  const bound = updateTestAction.bind(null, courseId, testId);
  const [state, formAction] = useActionState<FormState, FormData>(
    bound,
    undefined,
  );
  useToastFromState(state);

  const [pubPending, startPub] = useTransition();
  const [delPending, startDel] = useTransition();
  const [importPending, setImportPending] = useState(false);
  const [importDiag, setImportDiag] = useState<{
    error: string;
    preview: string;
    chars: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function handlePdfImport(file: File) {
    setImportPending(true);
    setImportDiag(null);
    try {
      const form = new FormData();
      form.append("courseId", courseId);
      form.append("file", file);
      const res = await fetch(`/api/lecturer/tests/${testId}/import-pdf`, {
        method: "POST",
        body: form,
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        rawTextPreview?: string;
        extractedChars?: number;
        questions?: Array<{
          type: QuestionType;
          prompt: string;
          options: { letter: string; text: string; isCorrect: boolean }[];
        }>;
      };
      if (!res.ok || !data.ok || !data.questions) {
        toast.error(data.error ?? "Could not import PDF.");
        if (data.rawTextPreview) {
          setImportDiag({
            error: data.error ?? "Could not import PDF.",
            preview: data.rawTextPreview,
            chars: data.extractedChars ?? data.rawTextPreview.length,
          });
        }
        return;
      }
      const incoming: Question[] = data.questions.map((q) => ({
        id: uid(),
        type: q.type,
        prompt: q.prompt,
        points: 1,
        options: q.options.map((o) => ({
          id: uid(),
          text: o.text,
          isCorrect: o.isCorrect,
        })),
      }));
      setQuestions((prev) => [...prev, ...incoming]);
      const autoMarked = incoming.filter((q) =>
        q.options.some((o) => o.isCorrect),
      ).length;
      const msg =
        autoMarked === incoming.length
          ? `Imported ${incoming.length} question${incoming.length === 1 ? "" : "s"} — correct answers detected automatically. Review and save.`
          : autoMarked > 0
            ? `Imported ${incoming.length} question${incoming.length === 1 ? "" : "s"} — ${autoMarked} had answers auto-detected. Tick remaining correct answers, then save.`
            : `Imported ${incoming.length} question${incoming.length === 1 ? "" : "s"}. Tick the correct answers, then save.`;
      toast.success(msg);
    } catch {
      toast.error("Could not import PDF.");
    } finally {
      setImportPending(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function patchQuestion(qid: string, patch: Partial<Question>) {
    setQuestions((prev) =>
      prev.map((q) => (q.id === qid ? { ...q, ...patch } : q)),
    );
  }

  function patchOption(qid: string, oid: string, patch: Partial<Option>) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id !== qid
          ? q
          : {
              ...q,
              options: q.options.map((o) =>
                o.id === oid ? { ...o, ...patch } : o,
              ),
            },
      ),
    );
  }

  function setCorrectSingle(qid: string, oid: string) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id !== qid
          ? q
          : {
              ...q,
              options: q.options.map((o) => ({
                ...o,
                isCorrect: o.id === oid,
              })),
            },
      ),
    );
  }

  function toggleCorrectMulti(qid: string, oid: string) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id !== qid
          ? q
          : {
              ...q,
              options: q.options.map((o) =>
                o.id === oid ? { ...o, isCorrect: !o.isCorrect } : o,
              ),
            },
      ),
    );
  }

  function addOption(qid: string) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id !== qid
          ? q
          : {
              ...q,
              options: [
                ...q.options,
                { id: uid(), text: "", isCorrect: false },
              ],
            },
      ),
    );
  }

  function removeOption(qid: string, oid: string) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id !== qid
          ? q
          : { ...q, options: q.options.filter((o) => o.id !== oid) },
      ),
    );
  }

  function addQuestion(type: QuestionType) {
    setQuestions((prev) => [...prev, blankQuestion(type)]);
  }

  function removeQuestion(qid: string) {
    setQuestions((prev) => prev.filter((q) => q.id !== qid));
  }

  function buildPayload(): string {
    return JSON.stringify({
      title,
      description: description || undefined,
      startsAt,
      endsAt,
      durationMinutes,
      questions: questions.map((q) => ({
        type: q.type,
        prompt: q.prompt,
        points: q.points,
        options: q.options.map((o) => ({
          text: o.text,
          isCorrect: o.isCorrect,
        })),
      })),
    });
  }

  const totalPoints = questions.reduce((acc, q) => acc + (q.points || 0), 0);

  return (
    <div className="space-y-6">
      {locked ? (
        <div className="rounded-2xl border border-secondary/40 bg-secondary/10 p-4 text-sm text-foreground">
          <strong>Locked.</strong> Students have started this test. Unpublish
          and clear submissions if you need to edit.
        </div>
      ) : null}

      <form action={formAction} className="space-y-6">
        <input type="hidden" name="payload" value={buildPayload()} />

        <fieldset
          disabled={locked}
          className="space-y-5 rounded-2xl border border-stroke bg-white p-6 shadow-sm"
        >
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-body">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              className="mt-1 w-full rounded-md border border-stroke bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-body">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={500}
              className="mt-1 w-full rounded-md border border-stroke bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium uppercase tracking-wide text-body">
                Opens at
              </label>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="mt-1 w-full rounded-md border border-stroke bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium uppercase tracking-wide text-body">
                Closes at
              </label>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="mt-1 w-full rounded-md border border-stroke bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium uppercase tracking-wide text-body">
                Time limit (min)
              </label>
              <input
                type="number"
                min={1}
                max={600}
                value={durationMinutes}
                onChange={(e) =>
                  setDurationMinutes(Number(e.target.value) || 0)
                }
                className="mt-1 w-full rounded-md border border-stroke bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        </fieldset>

        <fieldset disabled={locked} className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-foreground">
              Questions ({questions.length}) · {totalPoints} pts total
            </h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => addQuestion("mcq")}
                className="rounded-md border border-stroke bg-white px-3 py-1.5 text-xs font-medium text-foreground shadow-sm hover:border-primary hover:text-primary"
              >
                + Multiple choice
              </button>
              <button
                type="button"
                onClick={() => addQuestion("true_false")}
                className="rounded-md border border-stroke bg-white px-3 py-1.5 text-xs font-medium text-foreground shadow-sm hover:border-primary hover:text-primary"
              >
                + True / False
              </button>
              <button
                type="button"
                onClick={() => addQuestion("multi")}
                className="rounded-md border border-stroke bg-white px-3 py-1.5 text-xs font-medium text-foreground shadow-sm hover:border-primary hover:text-primary"
              >
                + Multiple answer
              </button>
              <button
                type="button"
                disabled={importPending}
                onClick={() => fileInputRef.current?.click()}
                className="rounded-md border border-primary/40 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary shadow-sm hover:bg-primary/10 disabled:opacity-50"
              >
                {importPending ? "Importing…" : "Import from PDF"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handlePdfImport(f);
                }}
              />
            </div>
          </div>

          <p className="text-[11px] text-body">
            PDFs are parsed as text. We look for numbered prompts (e.g.
            <span className="font-mono"> 1. </span>or
            <span className="font-mono"> Q1. </span>) and lettered options
            (e.g. <span className="font-mono">A.</span>,{" "}
            <span className="font-mono">a)</span>). Correct answers are
            auto-detected from markers like{" "}
            <span className="font-mono">*A.</span>, trailing{" "}
            <span className="font-mono">✓</span>, inline{" "}
            <span className="font-mono">Answer: B</span> lines, or a trailing
            answer-key block. Review detected answers before saving.
          </p>

          {importDiag ? (
            <div className="rounded-2xl border border-meta-1/30 bg-meta-1/5 p-4 text-xs">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-meta-1">
                    {importDiag.error}
                  </p>
                  <p className="mt-1 text-body">
                    Extracted {importDiag.chars} character
                    {importDiag.chars === 1 ? "" : "s"} of text. Preview below
                    — if it&apos;s empty the PDF is image-only/scanned; if it
                    has content, the numbering style probably isn&apos;t one we
                    recognise. You can paste/clean it up by adding questions
                    manually.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setImportDiag(null)}
                  className="shrink-0 text-meta-1 hover:underline"
                >
                  Dismiss
                </button>
              </div>
              <pre className="mt-3 max-h-60 overflow-auto whitespace-pre-wrap rounded-md border border-stroke bg-white p-3 font-mono text-[11px] leading-relaxed text-foreground">
                {importDiag.preview || "(no text extracted)"}
              </pre>
            </div>
          ) : null}

          {questions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stroke bg-white p-8 text-center text-sm text-body">
              No questions yet. Add one with the buttons above.
            </div>
          ) : null}

          {questions.map((q, idx) => (
            <div
              key={q.id}
              className="space-y-3 rounded-2xl border border-stroke bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-body">
                  Q{idx + 1} ·{" "}
                  {q.type === "mcq"
                    ? "Multiple choice"
                    : q.type === "true_false"
                      ? "True / False"
                      : "Multiple answer"}
                </p>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-body">Points</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={q.points}
                    onChange={(e) =>
                      patchQuestion(q.id, {
                        points: Number(e.target.value) || 1,
                      })
                    }
                    className="w-16 rounded-md border border-stroke bg-white px-2 py-1 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => removeQuestion(q.id)}
                    className="text-xs font-medium text-meta-1 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </div>

              <textarea
                value={q.prompt}
                onChange={(e) =>
                  patchQuestion(q.id, { prompt: e.target.value })
                }
                placeholder="Question prompt"
                rows={2}
                className="w-full rounded-md border border-stroke bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />

              <div className="space-y-2">
                {q.options.map((o) => {
                  const isSingle =
                    q.type === "mcq" || q.type === "true_false";
                  return (
                    <div key={o.id} className="flex items-center gap-2">
                      {isSingle ? (
                        <input
                          type="radio"
                          name={`correct-${q.id}`}
                          checked={o.isCorrect}
                          onChange={() => setCorrectSingle(q.id, o.id)}
                          className="h-4 w-4 text-primary"
                        />
                      ) : (
                        <input
                          type="checkbox"
                          checked={o.isCorrect}
                          onChange={() => toggleCorrectMulti(q.id, o.id)}
                          className="h-4 w-4 rounded text-primary"
                        />
                      )}
                      <input
                        type="text"
                        value={o.text}
                        onChange={(e) =>
                          patchOption(q.id, o.id, { text: e.target.value })
                        }
                        placeholder={
                          q.type === "true_false"
                            ? o.text || "True/False"
                            : "Option text"
                        }
                        disabled={q.type === "true_false"}
                        className="flex-1 rounded-md border border-stroke bg-white px-2 py-1 text-sm disabled:bg-whiter disabled:text-body"
                      />
                      {q.type !== "true_false" && q.options.length > 2 ? (
                        <button
                          type="button"
                          onClick={() => removeOption(q.id, o.id)}
                          className="text-xs text-meta-1 hover:underline"
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                  );
                })}
                {q.type !== "true_false" && q.options.length < 6 ? (
                  <button
                    type="button"
                    onClick={() => addOption(q.id)}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    + Add option
                  </button>
                ) : null}
              </div>

              <p className="text-[11px] text-body">
                {q.type === "multi"
                  ? "Multi-answer: students must select EXACTLY the correct set to earn the points."
                  : "Mark the single correct option."}
              </p>
            </div>
          ))}
        </fieldset>

        {state && !state.ok ? (
          <div
            role="alert"
            className="rounded-lg border border-meta-1/30 bg-meta-1/10 px-3 py-2 text-sm text-meta-1"
          >
            {state.error}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3 border-t border-stroke pt-4">
          <SaveButton disabled={locked} />

          {isPublished ? (
            <button
              type="button"
              disabled={pubPending || anySubmissions}
              onClick={() => {
                startPub(async () => {
                  const res = await unpublishTestAction(courseId, testId);
                  if (res.ok) {
                    toast.success("Test unpublished.");
                    router.refresh();
                  } else {
                    toast.error(res.error ?? "Could not unpublish.");
                  }
                });
              }}
              className="inline-flex items-center rounded-lg border border-meta-1/40 px-4 py-2.5 text-sm font-semibold text-meta-1 hover:bg-meta-1/10 disabled:opacity-50"
            >
              {pubPending ? "Working…" : "Unpublish"}
            </button>
          ) : (
            <button
              type="button"
              disabled={pubPending || questions.length === 0}
              onClick={() => {
                if (
                  !confirm(
                    "Publish this test? Students enrolled in the module will be able to take it during its window.",
                  )
                )
                  return;
                startPub(async () => {
                  const res = await publishTestAction(courseId, testId);
                  if (res.ok) {
                    toast.success("Test published.");
                    router.refresh();
                  } else {
                    toast.error(res.error ?? "Could not publish.");
                  }
                });
              }}
              className="inline-flex items-center rounded-lg border border-meta-3/40 bg-meta-3 px-4 py-2.5 text-sm font-semibold text-white hover:bg-meta-3/90 disabled:opacity-50"
            >
              {pubPending ? "Publishing…" : "Publish test"}
            </button>
          )}

          <button
            type="button"
            disabled={delPending || anySubmissions}
            onClick={() => {
              if (
                !confirm(
                  "Delete this test? This cannot be undone. Tests with submissions cannot be deleted.",
                )
              )
                return;
              startDel(async () => {
                const res = await deleteTestAction(courseId, testId);
                if (!res.ok) {
                  toast.error(res.error ?? "Could not delete.");
                }
              });
            }}
            className="ml-auto inline-flex items-center rounded-lg border border-meta-1/40 px-3 py-2 text-xs font-semibold text-meta-1 hover:bg-meta-1/10 disabled:opacity-50"
          >
            {delPending ? "Deleting…" : "Delete test"}
          </button>
        </div>
      </form>
    </div>
  );
}

function SaveButton({ disabled }: { disabled?: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="inline-flex items-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-dark disabled:opacity-60"
    >
      Save changes
    </button>
  );
}
