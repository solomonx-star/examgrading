"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { saveAttendanceAction } from "./actions";
import type { FormState } from "@/lib/form-state";
import { useToastFromState } from "@/lib/use-toast-state";

type Status = "present" | "absent" | "late";

type Student = {
  id: string;
  name: string;
  studentId: string;
  inactive: boolean;
  currentStatus: Status | null;
  percent: number | null;
  total: number;
};

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-dark disabled:opacity-60"
    >
      {pending ? "Saving…" : "Save attendance"}
    </button>
  );
}

export function AttendanceSheet({
  courseId,
  date,
  students,
}: {
  courseId: string;
  date: string;
  students: Student[];
}) {
  const initial: Record<string, Status> = {};
  for (const s of students) initial[s.id] = s.currentStatus ?? "present";
  const [status, setStatus] = useState<Record<string, Status>>(initial);

  const bound = saveAttendanceAction.bind(null, courseId);
  const [state, formAction] = useActionState<FormState, FormData>(
    bound,
    undefined,
  );
  useToastFromState(state, { successMessage: "Attendance saved." });

  function markAll(value: Status) {
    setStatus(() => {
      const next: Record<string, Status> = {};
      for (const s of students) next[s.id] = value;
      return next;
    });
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="date" value={date} />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stroke bg-white p-4 shadow-sm">
        <p className="text-sm text-body">
          {students.length} student{students.length === 1 ? "" : "s"} enrolled
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-body">Mark all as:</span>
          {(["present", "absent", "late"] as Status[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => markAll(s)}
              className="rounded-md border border-stroke px-2.5 py-1 text-xs font-medium text-body capitalize hover:border-primary hover:text-primary"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-stroke bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-whiter text-left text-xs uppercase tracking-wide text-body">
            <tr>
              <th className="px-4 py-3">Student</th>
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Present</th>
              <th className="px-4 py-3">Absent</th>
              <th className="px-4 py-3">Late</th>
              <th className="px-4 py-3 text-right">Overall</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stroke">
            {students.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-sm text-body"
                >
                  No students enrolled in this course.
                </td>
              </tr>
            ) : (
              students.map((s) => {
                const current = status[s.id] ?? "present";
                return (
                  <tr key={s.id} className="hover:bg-whiter">
                    <td className="px-4 py-3">
                      <span
                        className={
                          s.inactive
                            ? "text-body line-through"
                            : "font-medium text-foreground"
                        }
                      >
                        {s.name}
                      </span>
                      {s.inactive ? (
                        <span className="ml-2 text-[10px] uppercase tracking-wide text-meta-1">
                          inactive
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-body">
                      {s.studentId}
                    </td>
                    {(["present", "absent", "late"] as Status[]).map((val) => (
                      <td key={val} className="px-4 py-3">
                        <label className="inline-flex items-center">
                          <input
                            type="radio"
                            name={`status[${s.id}]`}
                            value={val}
                            checked={current === val}
                            onChange={() =>
                              setStatus((prev) => ({ ...prev, [s.id]: val }))
                            }
                            className="h-4 w-4 border-stroke text-primary focus:ring-primary"
                          />
                        </label>
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right text-body">
                      {s.percent === null ? (
                        <span className="text-xs">—</span>
                      ) : (
                        <span
                          className={
                            s.percent >= 75
                              ? "font-medium text-meta-3"
                              : "font-medium text-meta-1"
                          }
                        >
                          {s.percent}%
                          <span className="ml-1 text-xs text-body">
                            ({s.total})
                          </span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

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

      {students.length > 0 ? <Submit /> : null}
    </form>
  );
}
