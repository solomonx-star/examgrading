/**
 * Format a 0–100 number as a percentage label.
 *   75    → "75%"
 *   75.5  → "75.5%"
 *   33.33 → "33.33%"
 *
 * Drops trailing zeros and the decimal point when the value is a clean integer
 * so the most common case ("75 out of 100") reads cleanly.
 */
export function formatPercent(value: number): string {
  return `${value.toFixed(2).replace(/\.?0+$/, "")}%`;
}

export function formatDateTime(d: Date | string): string {
  return new Date(d).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
