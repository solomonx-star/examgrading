"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { updateGradingRuleAction } from "../actions";
import type { FormState } from "@/lib/form-state";
import { useToastFromState } from "@/lib/use-toast-state";

type Band = {
  min: number;
  max: number;
  grade: string;
  gpa: number;
  remark: string;
};

type Defaults = {
  name: string;
  caWeight: number;
  examWeight: number;
  attendanceThreshold: number;
  gradeScale: Band[];
};

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-dark disabled:opacity-60"
    >
      {pending ? "Saving…" : "Save rule"}
    </button>
  );
}

export function GradingRuleForm({
  id,
  defaults,
}: {
  id: string;
  defaults: Defaults;
}) {
  const [bands, setBands] = useState<Band[]>(defaults.gradeScale);
  const bound = updateGradingRuleAction.bind(null, id);
  const [state, formAction] = useActionState<FormState, FormData>(
    bound,
    undefined,
  );
  useToastFromState(state, { successMessage: "Grading rule saved." });

  function updateBand<K extends keyof Band>(i: number, key: K, val: Band[K]) {
    setBands((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [key]: val };
      return next;
    });
  }

  function addBand() {
    setBands((prev) => [
      ...prev,
      { min: 0, max: 0, grade: "", gpa: 0, remark: "" },
    ]);
  }

  function removeBand(i: number) {
    setBands((prev) => prev.filter((_, j) => j !== i));
  }

  return (
    <form
      action={formAction}
      className="max-w-3xl space-y-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stroke"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field id="name" label="Name" defaultValue={defaults.name} required />
        <Field
          id="attendanceThreshold"
          label="Attendance minimum (%)"
          type="number"
          defaultValue={String(defaults.attendanceThreshold)}
          min={0}
          max={100}
          required
        />
        <Field
          id="caWeight"
          label="CA weight (%)"
          type="number"
          defaultValue={String(defaults.caWeight)}
          min={0}
          max={100}
          required
        />
        <Field
          id="examWeight"
          label="Exam weight (%)"
          type="number"
          defaultValue={String(defaults.examWeight)}
          min={0}
          max={100}
          required
        />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Grade scale</h3>
          <button
            type="button"
            onClick={addBand}
            className="rounded-md border border-stroke px-2.5 py-1 text-xs font-medium text-body hover:border-primary hover:text-primary"
          >
            + Add band
          </button>
        </div>
        <div className="space-y-2">
          {bands.map((b, i) => (
            <div
              key={i}
              className="grid grid-cols-12 items-end gap-2 rounded-lg border border-stroke p-3"
            >
              <Cell
                label="Min"
                name={`gradeScale[${i}][min]`}
                type="number"
                value={String(b.min)}
                onChange={(v) => updateBand(i, "min", Number(v))}
                className="col-span-2"
              />
              <Cell
                label="Max"
                name={`gradeScale[${i}][max]`}
                type="number"
                value={String(b.max)}
                onChange={(v) => updateBand(i, "max", Number(v))}
                className="col-span-2"
              />
              <Cell
                label="Grade"
                name={`gradeScale[${i}][grade]`}
                value={b.grade}
                onChange={(v) => updateBand(i, "grade", v)}
                className="col-span-2"
              />
              <Cell
                label="GPA"
                name={`gradeScale[${i}][gpa]`}
                type="number"
                step="0.1"
                value={String(b.gpa)}
                onChange={(v) => updateBand(i, "gpa", Number(v))}
                className="col-span-2"
              />
              <Cell
                label="Remark"
                name={`gradeScale[${i}][remark]`}
                value={b.remark}
                onChange={(v) => updateBand(i, "remark", v)}
                className="col-span-3"
              />
              <button
                type="button"
                onClick={() => removeBand(i)}
                className="col-span-1 mt-5 rounded-md border border-stroke px-2 py-1 text-xs font-medium text-meta-1 hover:border-meta-1"
              >
                ×
              </button>
            </div>
          ))}
        </div>
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
        <Submit />
        <Link
          href="/superadmin/grading-rules"
          className="text-sm font-medium text-body hover:text-foreground"
        >
          Back
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
}: {
  id: string;
  label: string;
  type?: string;
  defaultValue?: string;
  min?: number;
  max?: number;
  required?: boolean;
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
        className="block w-full rounded-lg border border-stroke bg-white px-3 py-2.5 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  );
}

function Cell({
  label,
  name,
  value,
  onChange,
  type = "text",
  step,
  className = "",
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  step?: string;
  className?: string;
}) {
  return (
    <div className={`space-y-1 ${className}`}>
      <label className="block text-[11px] font-medium uppercase tracking-wide text-body">
        {label}
      </label>
      <input
        name={name}
        type={type}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="block w-full rounded-md border border-stroke bg-white px-2 py-1.5 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  );
}
