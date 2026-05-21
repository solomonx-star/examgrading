"use client";

import Link from "next/link";
import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { BulkImportState } from "@/lib/bulk-import";
import { useImportToast } from "@/lib/use-toast-state";

type Action = (
  prev: BulkImportState,
  formData: FormData,
) => Promise<BulkImportState>;

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-dark disabled:opacity-60"
    >
      {pending ? "Importing…" : "Import"}
    </button>
  );
}

export function CsvImportForm({
  action,
  sampleCsv,
  templateFilename,
  cancelHref,
  backHref,
  backLabel,
  formatExplainer,
}: {
  action: Action;
  sampleCsv: string;
  templateFilename: string;
  cancelHref: string;
  backHref: string;
  backLabel: string;
  formatExplainer: ReactNode;
}) {
  const [state, formAction] = useActionState<BulkImportState, FormData>(
    action,
    undefined,
  );
  useImportToast(state);

  const templateHref = `data:text/csv;charset=utf-8,${encodeURIComponent(sampleCsv)}`;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-stroke bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground">CSV format</h2>
        <div className="mt-1 text-sm text-body">{formatExplainer}</div>
        <div className="mt-3 flex flex-wrap gap-3 text-xs">
          <a
            href={templateHref}
            download={templateFilename}
            className="rounded-md border border-stroke px-2.5 py-1 font-medium text-body hover:border-primary hover:text-primary"
          >
            Download template
          </a>
        </div>
      </section>

      <form
        action={formAction}
        encType="multipart/form-data"
        className="space-y-5 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stroke"
      >
        <div className="space-y-1.5">
          <label
            htmlFor="file"
            className="block text-sm font-medium text-foreground"
          >
            CSV file
          </label>
          <input
            id="file"
            name="file"
            type="file"
            accept=".csv,text/csv"
            required
            className="block w-full cursor-pointer rounded-lg border border-stroke bg-white px-3 py-2 text-sm text-foreground file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-primary-dark"
          />
        </div>

        {state && !state.ok ? (
          <div
            role="alert"
            className="rounded-lg border border-meta-1/30 bg-meta-1/10 px-3 py-2 text-sm text-meta-1"
          >
            {state.error}
          </div>
        ) : null}

        <div className="flex items-center gap-3">
          <Submit />
          <Link
            href={cancelHref}
            className="text-sm font-medium text-body hover:text-foreground"
          >
            Cancel
          </Link>
        </div>
      </form>

      {state && state.ok ? (
        <Results state={state} backHref={backHref} backLabel={backLabel} />
      ) : null}
    </div>
  );
}

function Results({
  state,
  backHref,
  backLabel,
}: {
  state: { ok: true; result: NonNullable<Extract<BulkImportState, { ok: true }>["result"]> };
  backHref: string;
  backLabel: string;
}) {
  const { created, skipped, failed, totalDataRows } = state.result;
  return (
    <section className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Stat label="Rows in file" value={totalDataRows} tone="body" />
        <Stat label="Created" value={created} tone="ok" />
        <Stat label="Skipped (duplicates)" value={skipped.length} tone="warn" />
        <Stat label="Failed" value={failed.length} tone="error" />
      </div>

      {skipped.length > 0 ? (
        <RowTable title="Skipped (duplicates)" rows={skipped} />
      ) : null}
      {failed.length > 0 ? (
        <RowTable title="Failed rows" rows={failed} />
      ) : null}

      <div className="flex items-center gap-3">
        <Link
          href={backHref}
          className="inline-flex items-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-dark"
        >
          {backLabel}
        </Link>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "ok" | "warn" | "error" | "body";
}) {
  const toneClass =
    tone === "ok"
      ? "text-meta-3"
      : tone === "warn"
        ? "text-foreground"
        : tone === "error"
          ? "text-meta-1"
          : "text-foreground";
  return (
    <div className="rounded-xl border border-stroke bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-body">
        {label}
      </p>
      <p className={"mt-1 text-2xl font-bold " + toneClass}>{value}</p>
    </div>
  );
}

function RowTable({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ row: number; email: string; reason: string }>;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-stroke bg-white shadow-sm">
      <div className="border-b border-stroke px-5 py-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-whiter text-left text-xs uppercase tracking-wide text-body">
          <tr>
            <th className="px-4 py-2.5">Row</th>
            <th className="px-4 py-2.5">Email</th>
            <th className="px-4 py-2.5">Reason</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stroke">
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="px-4 py-2 font-mono text-xs text-body">
                {r.row}
              </td>
              <td className="px-4 py-2 text-body">{r.email || "—"}</td>
              <td className="px-4 py-2 text-body">{r.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
