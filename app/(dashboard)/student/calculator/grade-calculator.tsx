"use client";

import { useState } from "react";

export type ModuleCalcData = {
  id: string;
  code: string;
  name: string;
  caWeight: number;
  examWeight: number;
  caMaxScore: number;
  examMaxScore: number;
  existingTestScore: number | null;
  existingTestMaxScore: number | null;
  gradeScale: Array<{ min: number; max: number; grade: string; gpa: number; remark: string }>;
};

export function GradeCalculator({ modules }: { modules: ModuleCalcData[] }) {
  const [selectedId, setSelectedId] = useState(modules[0]?.id ?? "");
  const [caInput, setCaInput] = useState("");
  const [examInput, setExamInput] = useState("");
  const [mode, setMode] = useState<"project" | "needed">("project");
  const [targetGrade, setTargetGrade] = useState("");

  const mod = modules.find((m) => m.id === selectedId);

  type ProjectResult = { kind: "project"; total: number; grade: string; remark: string; gpa: number };
  type NeededResult = { kind: "needed"; examScoreNeeded: number; target: { grade: string; remark: string; min: number }; caContrib: number };

  function computeResult(): ProjectResult | NeededResult | null {
    if (!mod) return null;

    const caScore = parseFloat(caInput !== "" ? caInput : mod.existingTestScore !== null ? String(mod.existingTestScore) : "");
    const caMax = mod.existingTestMaxScore ?? mod.caMaxScore;
    const validCA = !isNaN(caScore) && caScore >= 0 && caScore <= caMax;

    if (mode === "project") {
      const examScore = parseFloat(examInput);
      if (!validCA || isNaN(examScore) || examScore < 0 || examScore > mod.examMaxScore) return null;

      const caContrib = (caScore / caMax) * mod.caWeight;
      const examContrib = (examScore / mod.examMaxScore) * mod.examWeight;
      const total = caContrib + examContrib;

      const band = mod.gradeScale
        .slice()
        .sort((a, b) => b.min - a.min)
        .find((b) => total >= b.min);

      return { kind: "project", total, grade: band?.grade ?? "—", remark: band?.remark ?? "—", gpa: band?.gpa ?? 0 };
    }

    // "needed" mode: what exam score achieves the target grade?
    if (!validCA || !targetGrade) return null;
    const band = mod.gradeScale.find((b) => b.grade.toUpperCase() === targetGrade.toUpperCase());
    if (!band) return null;

    const caContrib = (caScore / caMax) * mod.caWeight;
    const examScoreNeeded = ((band.min - caContrib) / mod.examWeight) * mod.examMaxScore;

    return {
      kind: "needed",
      examScoreNeeded: Math.ceil(examScoreNeeded * 10) / 10,
      target: { grade: band.grade, remark: band.remark, min: band.min },
      caContrib,
    };
  }

  const result = computeResult();
  const caMax = mod ? (mod.existingTestMaxScore ?? mod.caMaxScore) : 100;

  if (modules.length === 0) {
    return (
      <p className="text-sm text-body">
        No modules enrolled in the current semester.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-xs font-medium uppercase tracking-wide text-body">
          Module
        </label>
        <select
          value={selectedId}
          onChange={(e) => {
            setSelectedId(e.target.value);
            setCaInput("");
            setExamInput("");
            setTargetGrade("");
          }}
          className="mt-1.5 w-full rounded-xl border border-stroke bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {modules.map((m) => (
            <option key={m.id} value={m.id}>
              {m.code} — {m.name}
            </option>
          ))}
        </select>
      </div>

      {mod && (
        <div className="rounded-xl bg-whiter px-4 py-3 text-xs text-body">
          CA weight: <span className="font-semibold text-foreground">{mod.caWeight}%</span>
          {" · "}
          Exam weight: <span className="font-semibold text-foreground">{mod.examWeight}%</span>
          {mod.existingTestScore !== null && (
            <>
              {" · "}
              Recorded CA: <span className="font-semibold text-foreground">
                {mod.existingTestScore}/{mod.existingTestMaxScore}
              </span>
            </>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => setMode("project")}
          className={`flex-1 rounded-xl py-2 text-sm font-semibold transition ${
            mode === "project"
              ? "bg-primary text-white"
              : "border border-stroke bg-white text-body hover:border-primary hover:text-primary"
          }`}
        >
          Project my grade
        </button>
        <button
          onClick={() => setMode("needed")}
          className={`flex-1 rounded-xl py-2 text-sm font-semibold transition ${
            mode === "needed"
              ? "bg-primary text-white"
              : "border border-stroke bg-white text-body hover:border-primary hover:text-primary"
          }`}
        >
          What do I need?
        </button>
      </div>

      {mod && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-body">
              CA / Test score (out of {caMax})
            </label>
            <input
              type="number"
              min={0}
              max={caMax}
              value={caInput !== "" ? caInput : mod.existingTestScore !== null ? String(mod.existingTestScore) : ""}
              onChange={(e) => setCaInput(e.target.value)}
              placeholder={mod.existingTestScore !== null ? String(mod.existingTestScore) : `0–${caMax}`}
              className="mt-1.5 w-full rounded-xl border border-stroke bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {mode === "project" ? (
            <div>
              <label className="block text-xs font-medium uppercase tracking-wide text-body">
                Exam score (out of {mod.examMaxScore})
              </label>
              <input
                type="number"
                min={0}
                max={mod.examMaxScore}
                value={examInput}
                onChange={(e) => setExamInput(e.target.value)}
                placeholder={`0–${mod.examMaxScore}`}
                className="mt-1.5 w-full rounded-xl border border-stroke bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium uppercase tracking-wide text-body">
                Target grade
              </label>
              <select
                value={targetGrade}
                onChange={(e) => setTargetGrade(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-stroke bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Select a grade…</option>
                {mod.gradeScale
                  .slice()
                  .sort((a, b) => b.min - a.min)
                  .map((b) => (
                    <option key={b.grade} value={b.grade}>
                      {b.grade} — {b.remark} (≥{b.min}%)
                    </option>
                  ))}
              </select>
            </div>
          )}

          {result && (
            <div className={`rounded-xl border p-4 ${
              result.kind === "project"
                ? "border-primary/20 bg-primary/5"
                : "border-meta-3/20 bg-meta-3/5"
            }`}>
              {result.kind === "project" ? (
                <>
                  <p className="text-xs font-medium uppercase tracking-wide text-body">
                    Projected result
                  </p>
                  <p className="mt-1 text-3xl font-bold text-foreground">
                    {result.total.toFixed(1)}%
                    <span className="ml-3 text-lg text-primary">{result.grade}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-body">
                    {result.remark} · GPA {result.gpa.toFixed(1)}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-xs font-medium uppercase tracking-wide text-body">
                    Exam score needed for {result.target.grade} ({result.target.remark})
                  </p>
                  {result.examScoreNeeded <= 0 ? (
                    <p className="mt-1 text-lg font-semibold text-meta-3">
                      You already qualify — any exam score will do!
                    </p>
                  ) : result.examScoreNeeded > mod.examMaxScore ? (
                    <p className="mt-1 text-lg font-semibold text-meta-1">
                      Not achievable — would need {result.examScoreNeeded.toFixed(1)}/{mod.examMaxScore}
                    </p>
                  ) : (
                    <>
                      <p className="mt-1 text-3xl font-bold text-meta-3">
                        {result.examScoreNeeded.toFixed(1)}
                        <span className="ml-1 text-base font-normal text-body">/ {mod.examMaxScore}</span>
                      </p>
                      <p className="mt-0.5 text-xs text-body">
                        That&apos;s {((result.examScoreNeeded / mod.examMaxScore) * 100).toFixed(1)}% on the exam
                      </p>
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {mod.gradeScale.length > 0 && (
            <details className="rounded-xl border border-stroke bg-white">
              <summary className="cursor-pointer px-4 py-3 text-xs font-medium uppercase tracking-wide text-body">
                Grade scale
              </summary>
              <table className="w-full text-sm">
                <thead className="bg-whiter text-left text-xs uppercase tracking-wide text-body">
                  <tr>
                    <th className="px-4 py-2">Grade</th>
                    <th className="px-4 py-2">Range</th>
                    <th className="px-4 py-2">GPA</th>
                    <th className="px-4 py-2">Remark</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stroke">
                  {mod.gradeScale
                    .slice()
                    .sort((a, b) => b.min - a.min)
                    .map((b) => (
                      <tr key={b.grade}>
                        <td className="px-4 py-2 font-semibold text-foreground">{b.grade}</td>
                        <td className="px-4 py-2 text-body">{b.min}–{b.max}%</td>
                        <td className="px-4 py-2 text-body">{b.gpa.toFixed(1)}</td>
                        <td className="px-4 py-2 text-body">{b.remark}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
