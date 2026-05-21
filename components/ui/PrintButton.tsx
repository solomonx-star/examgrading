"use client";

export function PrintButton({ label = "Print / Save as PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center rounded-lg border border-stroke bg-white px-4 py-2 text-sm font-medium text-body shadow-sm transition hover:border-primary hover:text-primary print:hidden"
    >
      {label}
    </button>
  );
}
