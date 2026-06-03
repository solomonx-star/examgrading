"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { createCourseAction, updateCourseAction } from "./actions";
import type { FormState } from "@/lib/form-state";
import { useToastFromState } from "@/lib/use-toast-state";

type Defaults = {
  name: string;
  code: string;
  programmeIds: string[];
  yearLevel: number;
  academicYear: string;
  semester: "First" | "Second" | "Summer";
  lecturerId: string;
  gradingRuleId: string;
  enrolledStudents: string[];
  isActive: boolean;
};

type StudentChoice = {
  id: string;
  name: string;
  studentId: string;
  programmeId: string;
  yearLevel: number;
  inactive?: boolean;
};

type Choices = {
  programmes: { id: string; name: string; code: string }[];
  lecturers: { id: string; name: string; email: string }[];
  students: StudentChoice[];
  rules: { id: string; name: string; global: boolean }[];
};

function Submit({ mode }: { mode: "create" | "edit" }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-dark disabled:opacity-60"
    >
      {pending
        ? "Saving…"
        : mode === "create"
          ? "Create module"
          : "Save changes"}
    </button>
  );
}

export function CourseForm({
  mode,
  courseId,
  defaults,
  choices,
}: {
  mode: "create" | "edit";
  courseId?: string;
  defaults: Defaults;
  choices: Choices;
}) {
  const action =
    mode === "create"
      ? createCourseAction
      : updateCourseAction.bind(null, courseId!);
  const [state, formAction] = useActionState<FormState, FormData>(
    action,
    undefined,
  );
  useToastFromState(state, {
    successMessage: mode === "create" ? "Module created." : "Module saved.",
  });

  const [programmeIds, setProgrammeIds] = useState<Set<string>>(
    () => new Set(defaults.programmeIds),
  );
  const [yearLevel, setYearLevel] = useState<number>(defaults.yearLevel);
  const [enrolled, setEnrolled] = useState<Set<string>>(
    () => new Set(defaults.enrolledStudents),
  );
  const [studentFilter, setStudentFilter] = useState("");

  function toggleProgramme(id: string) {
    setProgrammeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Restrict the enrolment pool to students whose programme is one of the
  // selected programmes AND whose year matches.
  const eligibleStudents = useMemo(
    () =>
      choices.students.filter(
        (s) => programmeIds.has(s.programmeId) && s.yearLevel === yearLevel,
      ),
    [choices.students, programmeIds, yearLevel],
  );
  const filteredStudents = useMemo(() => {
    const q = studentFilter.trim().toLowerCase();
    if (!q) return eligibleStudents;
    return eligibleStudents.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.studentId.toLowerCase().includes(q),
    );
  }, [studentFilter, eligibleStudents]);

  // If the programme set or year changes, drop any currently-selected students
  // who no longer match.
  useEffect(() => {
    setEnrolled((prev) => {
      if (prev.size === 0) return prev;
      const eligibleIds = new Set(eligibleStudents.map((s) => s.id));
      const next = new Set<string>();
      for (const id of prev) if (eligibleIds.has(id)) next.add(id);
      return next.size === prev.size ? prev : next;
    });
  }, [eligibleStudents]);

  function toggleStudent(id: string) {
    setEnrolled((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectVisible() {
    setEnrolled((prev) => {
      const next = new Set(prev);
      for (const s of filteredStudents) next.add(s.id);
      return next;
    });
  }

  function clearAll() {
    setEnrolled(new Set());
  }

  const programmesPicked = programmeIds.size;

  return (
    <form
      action={formAction}
      className="space-y-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stroke"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field id="code" label="Module code" defaultValue={defaults.code} required />
        <Field id="name" label="Module name" defaultValue={defaults.name} required />
        <Select
          id="yearLevel"
          label="Year level"
          value={String(yearLevel)}
          onChange={(v) => setYearLevel(Number(v))}
          options={[
            { value: "1", label: "Year 1" },
            { value: "2", label: "Year 2" },
            { value: "3", label: "Year 3" },
            { value: "4", label: "Year 4" },
          ]}
        />
        <Field
          id="academicYear"
          label="Academic year"
          defaultValue={defaults.academicYear}
          placeholder="2025/2026"
          required
          pattern="\d{4}/\d{4}"
        />
        <Select
          id="semester"
          label="Semester"
          defaultValue={defaults.semester}
          options={[
            { value: "First", label: "First" },
            { value: "Second", label: "Second" },
            { value: "Summer", label: "Summer" },
          ]}
        />
        <Select
          id="lecturerId"
          label="Lecturer"
          defaultValue={defaults.lecturerId}
          options={[
            { value: "", label: "— None —" },
            ...choices.lecturers.map((l) => ({
              value: l.id,
              label: `${l.name} (${l.email})`,
            })),
          ]}
        />
        <Select
          id="gradingRuleId"
          label="Grading rule"
          defaultValue={defaults.gradingRuleId}
          options={[
            { value: "", label: "— None —" },
            ...choices.rules.map((r) => ({
              value: r.id,
              label: `${r.name}${r.global ? " (global)" : ""}`,
            })),
          ]}
        />
        {mode === "edit" ? (
          <label className="flex items-end gap-2 pb-1.5 text-sm text-foreground">
            <input
              id="isActive"
              name="isActive"
              type="checkbox"
              defaultChecked={defaults.isActive}
              className="h-4 w-4 rounded border-stroke text-primary focus:ring-primary"
            />
            Module active
          </label>
        ) : null}
      </div>

      <fieldset className="rounded-lg border border-stroke p-4">
        <legend className="px-1 text-sm font-semibold text-foreground">
          Programmes{" "}
          <span className="font-normal text-body">
            ({programmesPicked} selected)
          </span>
        </legend>
        <p className="mb-3 text-xs text-body">
          Tick every programme whose students take this module. A module shared
          between (for example) Diploma and BSc Computer Science should have
          both ticked — the enrolment list below will then include eligible
          students from each programme.
        </p>
        {choices.programmes.length === 0 ? (
          <p className="text-sm text-body">No programmes available.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {choices.programmes.map((p) => {
              const checked = programmeIds.has(p.id);
              return (
                <li key={p.id}>
                  <label className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-whiter">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleProgramme(p.id)}
                      className="h-4 w-4 rounded border-stroke text-primary focus:ring-primary"
                    />
                    <span>
                      {p.name}{" "}
                      <span className="font-mono text-xs text-body">
                        ({p.code})
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
        {[...programmeIds].map((id) => (
          <input key={id} type="hidden" name="programmeIds" value={id} />
        ))}
      </fieldset>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">
            Enrolment <span className="font-normal text-body">({enrolled.size} selected)</span>
            <span className="ml-2 text-xs font-normal text-body">
              {programmesPicked > 0
                ? `Eligible: ${eligibleStudents.length}`
                : "Tick a programme to see eligible students"}
            </span>
          </h3>
          <div className="flex items-center gap-2">
            <input
              value={studentFilter}
              onChange={(e) => setStudentFilter(e.target.value)}
              placeholder="Filter students"
              className="rounded-md border border-stroke bg-white px-2.5 py-1 text-xs shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              type="button"
              onClick={selectVisible}
              className="rounded-md border border-stroke px-2.5 py-1 text-xs font-medium text-body hover:border-primary hover:text-primary"
            >
              Select visible
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="rounded-md border border-stroke px-2.5 py-1 text-xs font-medium text-body hover:border-primary hover:text-primary"
            >
              Clear all
            </button>
          </div>
        </div>

        <div className="max-h-72 overflow-y-auto rounded-lg border border-stroke">
          {filteredStudents.length === 0 ? (
            <p className="p-3 text-sm text-body">
              {programmesPicked > 0
                ? "No students match the selected programmes + year."
                : "Tick a programme + year first."}
            </p>
          ) : (
            <ul className="divide-y divide-stroke">
              {filteredStudents.map((s) => {
                const checked = enrolled.has(s.id);
                return (
                  <li
                    key={s.id}
                    className="flex items-center justify-between px-3 py-2 text-sm"
                  >
                    <label className="flex flex-1 items-center gap-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleStudent(s.id)}
                        className="h-4 w-4 rounded border-stroke text-primary focus:ring-primary"
                      />
                      <span className={s.inactive ? "text-body line-through" : ""}>
                        {s.name}
                      </span>
                      <span className="ml-2 font-mono text-xs text-body">
                        {s.studentId}
                      </span>
                      {s.inactive ? (
                        <span className="ml-2 text-[10px] uppercase tracking-wide text-meta-1">
                          inactive
                        </span>
                      ) : null}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {[...enrolled].map((id) => (
          <input
            key={id}
            type="hidden"
            name="enrolledStudents"
            value={id}
          />
        ))}
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

      <div className="flex items-center gap-3">
        <Submit mode={mode} />
        <Link
          href="/admin/modules"
          className="text-sm font-medium text-body hover:text-foreground"
        >
          Back to list
        </Link>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  type = "text",
  defaultValue,
  min,
  max,
  required,
  placeholder,
  pattern,
}: {
  id: string;
  label: string;
  type?: string;
  defaultValue?: string;
  min?: number;
  max?: number;
  required?: boolean;
  placeholder?: string;
  pattern?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        defaultValue={defaultValue}
        min={min}
        max={max}
        required={required}
        placeholder={placeholder}
        pattern={pattern}
        className="block w-full rounded-lg border border-stroke bg-white px-3 py-2.5 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  );
}

function Select({
  id,
  label,
  defaultValue,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  defaultValue?: string;
  value?: string;
  onChange?: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      <select
        id={id}
        name={id}
        defaultValue={value === undefined ? defaultValue : undefined}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        className="block w-full rounded-lg border border-stroke bg-white px-3 py-2.5 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
