"use client";

import { useActionState, useMemo, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import {
  recallSubmissionAction,
  saveGradesAction,
  submitGradesAction,
} from "./actions";
import { calculateGrade } from "@/lib/grading";
import { useToastFromState } from "@/lib/use-toast-state";
import type { FormState } from "@/lib/form-state";
import type { IGradeBand } from "@/models/GradingRule";

type Student = {
  id: string;
  name: string;
  studentId: string;
  inactive: boolean;
  attendancePct: number | null;
  attendanceTotal: number;
  existing: {
    testScore: number;
    examScore: number;
    submissionStatus: "draft" | "submitted";
    isPublished: boolean;
    calculatedGrade: string | null;
    attendanceMet: boolean | null;
  } | null;
};

type Row = { testScore: number; examScore: number };

function Submit({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="inline-flex items-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-dark disabled:opacity-60"
    >
      {pending ? "Saving…" : "Save draft"}
    </button>
  );
}

export function GradeSheet({
  courseId,
  rule,
  students,
  anySubmitted,
  anyPublished,
  initialTestMode,
}: {
  courseId: string;
  rule: {
    caWeight: number;
    examWeight: number;
    attendanceThreshold: number;
    gradeScale: IGradeBand[];
  };
  students: Student[];
  anySubmitted: boolean;
  anyPublished: boolean;
  initialTestMode: "raw" | "precalc";
}) {
  const buildRows = () => {
    const out: Record<string, Row> = {};
    for (const s of students) {
      out[s.id] = {
        testScore: s.existing?.testScore ?? 0,
        examScore: s.existing?.examScore ?? 0,
      };
    }
    return out;
  };

  const [rows, setRows] = useState<Record<string, Row>>(buildRows);
  const savedRows = useRef<Record<string, Row>>(buildRows());

  const [testMode, setTestMode] = useState<"raw" | "precalc">(initialTestMode);
  const testMaxScore = testMode === "precalc" ? rule.caWeight : 100;

  const [submitPending, startSubmit] = useTransition();
  const [recallPending, startRecall] = useTransition();
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const bound = saveGradesAction.bind(null, courseId);
  const [state, formAction] = useActionState<FormState, FormData>(
    bound,
    undefined,
  );
  useToastFromState(state, { successMessage: "Grades saved." });

  // Keep savedRows in sync with the last successful save so Reset always
  // reverts to the most recently persisted state, not just page-load.
  const prevStateRef = useRef(state);
  if (state !== prevStateRef.current) {
    prevStateRef.current = state;
    if (state?.ok) {
      savedRows.current = { ...rows };
    }
  }

  // Lock the editor as soon as ANY row in the period is submitted.
  const locked = anySubmitted;

  function updateRow(sid: string, key: keyof Row, value: string) {
    setRows((prev) => ({
      ...prev,
      [sid]: { ...prev[sid], [key]: Number(value) || 0 },
    }));
  }

  const previews = useMemo(() => {
    const out: Record<
      string,
      {
        finalScore: number;
        grade: string | null;
        gpa: number | null;
        remark: string | null;
      }
    > = {};
    for (const s of students) {
      const r = rows[s.id];
      if (!r) continue;
      const result = calculateGrade({
        testScore: r.testScore,
        testMaxScore,
        examScore: r.examScore,
        examMaxScore: 100,
        caWeight: rule.caWeight,
        examWeight: rule.examWeight,
        gradeScale: rule.gradeScale,
      });
      out[s.id] = {
        finalScore: result.finalScore,
        grade: result.grade,
        gpa: result.gpa,
        remark: result.remark,
      };
    }
    return out;
  }, [students, rows, rule, testMaxScore]);

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="testMode" value={testMode} />

      {/* Test score mode toggle */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-stroke bg-white px-4 py-3">
        <span className="text-sm font-medium text-foreground">
          Test score entry mode:
        </span>
        <div className="flex overflow-hidden rounded-lg border border-stroke text-sm">
          <button
            type="button"
            disabled={locked}
            onClick={() => setTestMode("raw")}
            className={`px-4 py-1.5 font-medium transition-colors disabled:cursor-not-allowed ${
              testMode === "raw"
                ? "bg-primary text-white"
                : "bg-white text-body hover:bg-whiter"
            }`}
          >
            Raw /100 — system divides
          </button>
          <button
            type="button"
            disabled={locked}
            onClick={() => setTestMode("precalc")}
            className={`px-4 py-1.5 font-medium transition-colors disabled:cursor-not-allowed ${
              testMode === "precalc"
                ? "bg-primary text-white"
                : "bg-white text-body hover:bg-whiter"
            }`}
          >
            Pre-calculated /{rule.caWeight} — already divided
          </button>
        </div>
        {testMode === "precalc" && (
          <span className="text-xs text-body">
            Enter the score as the lecturer calculated it (out of {rule.caWeight}). The system will not apply the weighting again.
          </span>
        )}
      </div>

      <fieldset disabled={locked} className="space-y-6">
        <section className="overflow-x-auto rounded-2xl border border-stroke bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-whiter text-left text-xs uppercase tracking-wide text-body">
              <tr>
                <th className="px-3 py-3">Student</th>
                <th className="px-3 py-3">
                  Test
                  <span className="ml-1 text-[10px] font-normal text-body">
                    /{testMaxScore}
                  </span>
                </th>
                <th className="hidden px-3 py-3 text-right text-[10px] font-normal sm:table-cell">
                  {rule.caWeight}% of total
                </th>
                <th className="px-3 py-3">
                  Exam
                  <span className="ml-1 text-[10px] font-normal text-body">
                    /100
                  </span>
                </th>
                <th className="hidden px-3 py-3 text-right text-[10px] font-normal sm:table-cell">
                  {rule.examWeight}% of total
                </th>
                <th className="hidden px-3 py-3 text-right md:table-cell">
                  Attendance
                </th>
                <th className="px-3 py-3 text-right">Total / Grade</th>
                <th className="hidden px-3 py-3 text-right lg:table-cell">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stroke">
              {students.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-3 py-10 text-center text-sm text-body"
                  >
                    No students enrolled.
                  </td>
                </tr>
              ) : (
                students.map((s) => {
                  const r = rows[s.id];
                  const p = previews[s.id];
                  const testWeighted = r
                    ? ((r.testScore / testMaxScore) * rule.caWeight).toFixed(2)
                    : "—";
                  const examWeighted = r
                    ? ((r.examScore / 100) * rule.examWeight).toFixed(2)
                    : "—";
                  return (
                    <tr key={s.id} className="align-middle hover:bg-whiter">
                      <td className="px-3 py-2">
                        <div
                          className={
                            s.inactive
                              ? "text-body line-through"
                              : "font-medium text-foreground"
                          }
                        >
                          {s.name}
                        </div>
                        <div className="font-mono text-[11px] text-body">
                          {s.studentId}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={0}
                          max={testMaxScore}
                          name={`row[${s.id}][test]`}
                          value={r?.testScore ?? 0}
                          onChange={(e) =>
                            updateRow(s.id, "testScore", e.target.value)
                          }
                          className="w-20 rounded-md border border-stroke bg-white px-2 py-1 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:bg-whiter disabled:text-body"
                        />
                      </td>
                      <td className="hidden px-3 py-2 text-right text-xs text-body sm:table-cell">
                        {testWeighted}
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          name={`row[${s.id}][exam]`}
                          value={r?.examScore ?? 0}
                          onChange={(e) =>
                            updateRow(s.id, "examScore", e.target.value)
                          }
                          className="w-20 rounded-md border border-stroke bg-white px-2 py-1 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:bg-whiter disabled:text-body"
                        />
                      </td>
                      <td className="hidden px-3 py-2 text-right text-xs text-body sm:table-cell">
                        {examWeighted}
                      </td>
                      <td className="hidden px-3 py-2 text-right md:table-cell">
                        {s.attendancePct === null ? (
                          <span className="text-xs text-body">—</span>
                        ) : (
                          <>
                            <div
                              className={
                                s.attendancePct >= rule.attendanceThreshold
                                  ? "font-medium text-meta-3"
                                  : "font-medium text-meta-1"
                              }
                            >
                              {s.attendancePct}%
                            </div>
                            <div className="text-[10px] text-body">
                              {s.attendanceTotal} session
                              {s.attendanceTotal === 1 ? "" : "s"}
                            </div>
                          </>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="font-semibold text-foreground">
                          {p?.finalScore?.toFixed(2) ?? "—"}
                        </div>
                        <div className="text-xs text-body">
                          {p?.grade ?? "—"}
                          {p?.remark ? ` · ${p.remark}` : ""}
                        </div>
                        {s.existing?.attendanceMet === false ? (
                          <div className="mt-0.5 inline-flex rounded-full bg-meta-1/10 px-2 py-0.5 text-[10px] font-medium text-meta-1">
                            Low attendance
                          </div>
                        ) : null}
                      </td>
                      <td className="hidden px-3 py-2 text-right lg:table-cell">
                        {s.existing?.isPublished ? (
                          <span className="inline-flex rounded-full bg-meta-3/10 px-2 py-0.5 text-[11px] font-medium text-meta-3">
                            Published
                          </span>
                        ) : s.existing?.submissionStatus === "submitted" ? (
                          <span className="inline-flex rounded-full bg-secondary/20 px-2 py-0.5 text-[11px] font-medium text-foreground">
                            Submitted
                          </span>
                        ) : s.existing ? (
                          <span className="inline-flex rounded-full bg-whiter px-2 py-0.5 text-[11px] font-medium text-body">
                            Draft
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-whiter px-2 py-0.5 text-[11px] font-medium text-body">
                            New
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </section>
      </fieldset>

      {state && !state.ok ? (
        <div
          role="alert"
          className="rounded-lg border border-meta-1/30 bg-meta-1/10 px-3 py-2 text-sm text-meta-1"
        >
          {state.error}
        </div>
      ) : null}
      {state && state.ok ? (
        <div
          role="status"
          className="rounded-lg border border-meta-3/30 bg-meta-3/10 px-3 py-2 text-sm text-meta-3"
        >
          {state.message ?? "Saved."}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Submit disabled={locked} />

        <button
          type="button"
          disabled={submitPending || locked || students.length === 0}
          onClick={() => {
            if (
              !confirm(
                "Submit these grades to the admin for review? You will not be able to edit until they are recalled or unpublished.",
              )
            )
              return;
            startSubmit(async () => {
              try {
                const res = await submitGradesAction(courseId);
                if (res.ok) {
                  toast.success(
                    `Submitted ${res.count ?? 0} grade${res.count === 1 ? "" : "s"} for review.`,
                  );
                } else {
                  toast.error(res.error ?? "Could not submit.");
                }
              } catch {
                toast.error("Could not submit grades.");
              }
            });
          }}
          className="inline-flex items-center rounded-lg border border-primary/40 bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitPending ? "Submitting…" : "Submit for review"}
        </button>

        <button
          type="button"
          disabled={recallPending || !locked || anyPublished}
          onClick={() => {
            if (
              !confirm(
                "Recall this submission so you can edit again? This only works if the admin hasn't published any of the grades.",
              )
            )
              return;
            startRecall(async () => {
              try {
                const res = await recallSubmissionAction(courseId);
                if (res.ok) {
                  toast.success("Submission recalled. You can edit again.");
                } else {
                  toast.error(res.error ?? "Could not recall.");
                }
              } catch {
                toast.error("Could not recall submission.");
              }
            });
          }}
          className="inline-flex items-center rounded-lg border border-meta-1/40 px-4 py-2.5 text-sm font-semibold text-meta-1 hover:bg-meta-1/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {recallPending ? "Recalling…" : "Recall submission"}
        </button>

        {!locked && (
          <button
            type="button"
            disabled={students.length === 0}
            onClick={() => setShowResetConfirm(true)}
            className="inline-flex items-center rounded-lg border border-stroke px-4 py-2.5 text-sm font-semibold text-body hover:bg-whiter disabled:cursor-not-allowed disabled:opacity-50"
          >
            Reset to saved
          </button>
        )}

        <span className="ml-auto text-xs text-body">
          Save persists changes. Submitting sends them to the admin for review
          and publication.
        </span>
      </div>

      {showResetConfirm && (
        <div className="rounded-2xl border border-stroke bg-meta-2 p-4 text-sm">
          <p className="mb-3 font-medium text-foreground">
            Reset all scores to the last saved values? Any unsaved changes will
            be lost.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                setRows({ ...savedRows.current });
                setShowResetConfirm(false);
              }}
              className="rounded-lg bg-meta-4 px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Yes, reset
            </button>
            <button
              type="button"
              onClick={() => setShowResetConfirm(false)}
              className="rounded-lg border border-stroke bg-white px-4 py-2 text-sm font-semibold text-body hover:bg-whiter"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
