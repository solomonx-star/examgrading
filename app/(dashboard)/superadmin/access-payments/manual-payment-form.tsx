"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { recordManualAccessPaymentAction } from "@/lib/actions/payment";

type Student = {
  id: string;
  name: string;
  studentId: string;
  department: string;
};

export function ManualPaymentForm({
  students,
  period,
}: {
  students: Student[];
  period: {
    year: string;
    semester: "First" | "Second" | "Summer";
    accessFee: number;
  } | null;
}) {
  const [studentId, setStudentId] = useState("");
  const [method, setMethod] = useState<"cash" | "bank_transfer">("cash");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();

  function submit() {
    if (!studentId) {
      toast.error("Pick a student.");
      return;
    }
    start(async () => {
      const res = await recordManualAccessPaymentAction({
        studentId,
        method,
        reference,
        note,
      });
      if (res.ok) {
        toast.success("Payment recorded — access activated.");
        setStudentId("");
        setReference("");
        setNote("");
      } else {
        toast.error(res.error ?? "Could not record payment.");
      }
    });
  }

  return (
    <div className="rounded-2xl border border-stroke bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-foreground">
        Record manual payment
      </h2>
      <p className="mt-1 text-xs text-body">
        Use for cash or bank-transfer payments handed to the office.
      </p>

      {!period ? (
        <p className="mt-3 rounded-md bg-meta-1/10 px-3 py-2 text-xs text-meta-1">
          No current academic period is set.
        </p>
      ) : period.accessFee <= 0 ? (
        <p className="mt-3 rounded-md bg-secondary/20 px-3 py-2 text-xs text-foreground">
          No access fee is configured for {period.year} · {period.semester}.
        </p>
      ) : (
        <div className="mt-3 rounded-md bg-whiter px-3 py-2 text-xs text-body">
          Will charge{" "}
          <span className="font-semibold text-foreground">
            NLe {period.accessFee.toLocaleString()}
          </span>{" "}
          for {period.year} · {period.semester}.
        </div>
      )}

      <div className="mt-4 space-y-3">
        <div>
          <label className="block text-xs font-medium text-foreground">
            Student
          </label>
          <select
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            className="mt-1 block w-full rounded-md border border-stroke bg-white px-2.5 py-1.5 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">Pick a student…</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.studentId ? ` · ${s.studentId}` : ""}
                {s.department ? ` · ${s.department}` : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-foreground">
            Method
          </label>
          <select
            value={method}
            onChange={(e) =>
              setMethod(e.target.value as "cash" | "bank_transfer")
            }
            className="mt-1 block w-full rounded-md border border-stroke bg-white px-2.5 py-1.5 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="cash">Cash</option>
            <option value="bank_transfer">Bank transfer</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-foreground">
            Reference (optional)
          </label>
          <input
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Bank slip number, etc."
            className="mt-1 block w-full rounded-md border border-stroke bg-white px-2.5 py-1.5 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-foreground">
            Note (optional)
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="mt-1 block w-full rounded-md border border-stroke bg-white px-2.5 py-1.5 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={pending || !period || period.accessFee <= 0}
          className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Recording…" : "Record payment"}
        </button>
      </div>
    </div>
  );
}
