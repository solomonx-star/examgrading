"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { adminEditGradeAction } from "../../../actions";
import type { StudentGradeRow } from "@/lib/cohort-data";

export function GradeEditRow({
  row,
  studentId,
  academicYear,
  semester,
}: {
  row: StudentGradeRow;
  studentId: string;
  academicYear: string;
  semester: "First" | "Second" | "Summer";
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [test, setTest] = useState(
    row.testScore !== null ? String(row.testScore) : "",
  );
  const [exam, setExam] = useState(
    row.examScore !== null ? String(row.examScore) : "",
  );
  const [pending, startTransition] = useTransition();

  function cancel() {
    setTest(row.testScore !== null ? String(row.testScore) : "");
    setExam(row.examScore !== null ? String(row.examScore) : "");
    setEditing(false);
  }

  function save() {
    const tNum = Number(test);
    const eNum = Number(exam);
    if (!Number.isFinite(tNum) || tNum < 0 || tNum > 100) {
      toast.error("Test score must be a number between 0 and 100.");
      return;
    }
    if (!Number.isFinite(eNum) || eNum < 0 || eNum > 100) {
      toast.error("Exam score must be a number between 0 and 100.");
      return;
    }
    startTransition(async () => {
      try {
        const res = await adminEditGradeAction({
          courseId: row.moduleId,
          studentId,
          academicYear,
          semester,
          testScore: tNum,
          examScore: eNum,
        });
        if (res.ok) {
          toast.success("Grade updated.");
          setEditing(false);
          router.refresh();
        } else {
          toast.error(res.error ?? "Could not save grade.");
        }
      } catch {
        toast.error("Could not save grade.");
      }
    });
  }

  const submissionBadge = row.isPublished ? (
    <span className="inline-flex rounded-full bg-meta-3/10 px-2 py-0.5 text-[11px] font-medium text-meta-3">
      Published
    </span>
  ) : row.submissionStatus === "submitted" ? (
    <span className="inline-flex rounded-full bg-secondary/20 px-2 py-0.5 text-[11px] font-medium text-foreground">
      Submitted
    </span>
  ) : row.submissionStatus === "draft" ? (
    <span className="inline-flex rounded-full bg-whiter px-2 py-0.5 text-[11px] font-medium text-body">
      Draft
    </span>
  ) : (
    <span className="text-[11px] text-body">Not entered</span>
  );

  return (
    <tr>
      <td className="hidden px-4 py-3 font-mono text-xs text-foreground sm:table-cell">
        {row.moduleCode}
      </td>
      <td className="px-4 py-3 text-foreground">
        <span className="font-mono text-xs text-body sm:hidden">
          {row.moduleCode}
        </span>
        <span className="block sm:inline">{row.moduleName}</span>
      </td>
      <td className={`px-4 py-3 text-right ${editing ? "table-cell" : "hidden md:table-cell"}`}>
        {editing ? (
          <input
            type="number"
            min={0}
            max={100}
            step="0.01"
            value={test}
            onChange={(e) => setTest(e.target.value)}
            aria-label={`Test score for ${row.moduleName}`}
            className="w-20 rounded-md border border-stroke bg-white px-2 py-1 text-right text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            disabled={pending}
          />
        ) : (
          <span className="text-body">
            {row.testScore !== null ? row.testScore : "—"}
          </span>
        )}
      </td>
      <td className={`px-4 py-3 text-right ${editing ? "table-cell" : "hidden md:table-cell"}`}>
        {editing ? (
          <input
            type="number"
            min={0}
            max={100}
            step="0.01"
            value={exam}
            onChange={(e) => setExam(e.target.value)}
            aria-label={`Exam score for ${row.moduleName}`}
            className="w-20 rounded-md border border-stroke bg-white px-2 py-1 text-right text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            disabled={pending}
          />
        ) : (
          <span className="text-body">
            {row.examScore !== null ? row.examScore : "—"}
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-right font-semibold text-foreground">
        {row.finalScore !== null ? row.finalScore.toFixed(2) : "—"}
      </td>
      <td className="px-4 py-3 text-foreground">{row.grade ?? "—"}</td>
      <td className="hidden px-4 py-3 text-body sm:table-cell">
        {row.remark ?? "—"}
      </td>
      <td className="px-4 py-3 text-right text-body">
        {row.gpa !== null ? row.gpa.toFixed(2) : "—"}
      </td>
      <td className="px-4 py-3">{submissionBadge}</td>
      <td className="hidden px-4 py-3 md:table-cell">
        {row.attendanceMet === false ? (
          <span className="inline-flex rounded-full bg-meta-1/10 px-2 py-0.5 text-[10px] font-medium text-meta-1">
            Low attendance
          </span>
        ) : (
          <span className="text-[11px] text-body">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        {editing ? (
          <div className="inline-flex items-center gap-1">
            <button
              type="button"
              onClick={save}
              disabled={pending}
              aria-label="Save"
              className="inline-flex items-center justify-center rounded-md bg-primary p-1.5 text-white shadow-sm hover:bg-primary-dark disabled:opacity-60"
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Check className="h-4 w-4" aria-hidden />
              )}
            </button>
            <button
              type="button"
              onClick={cancel}
              disabled={pending}
              aria-label="Cancel"
              className="inline-flex items-center justify-center rounded-md border border-stroke p-1.5 text-body hover:border-meta-1 hover:text-meta-1 disabled:opacity-60"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label="Edit grade"
            className="inline-flex items-center gap-1 rounded-md border border-stroke px-2.5 py-1 text-xs font-medium text-body hover:border-primary hover:text-primary"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden />
            Edit
          </button>
        )}
      </td>
    </tr>
  );
}
