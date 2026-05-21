/**
 * Minimal CSV writer. Quotes fields that contain commas, quotes, or newlines;
 * doubles internal quotes per RFC 4180.
 */
export function toCsv(
  rows: Array<Record<string, unknown>>,
  headers: string[],
): string {
  const lines: string[] = [];
  lines.push(headers.map(escapeCell).join(","));
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCell(row[h])).join(","));
  }
  // CRLF per RFC 4180 — friendliest for Excel
  return lines.join("\r\n");
}

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Sanitize a string for use in a downloaded filename. Spaces → `-`, strip
 * filesystem-unfriendly chars.
 */
export function safeFilename(name: string): string {
  return name
    .trim()
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase();
}

/**
 * Parse CSV text into a 2D grid of strings. RFC 4180-aware:
 *  - quoted fields may contain commas and newlines
 *  - `""` inside a quoted field is a literal `"`
 *  - accepts LF or CRLF line endings
 *  - strips a leading UTF-8 BOM
 *  - rows that are entirely empty are dropped
 */
export function parseCsv(text: string): string[][] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      cell += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ",") {
      row.push(cell);
      cell = "";
      i++;
      continue;
    }
    if (ch === "\r") {
      i++;
      continue;
    }
    if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      cell = "";
      row = [];
      i++;
      continue;
    }
    cell += ch;
    i++;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim().length > 0));
}

/**
 * Parse a CSV string into records keyed by lower-cased header. Returns the
 * header list (for column-existence checks) and one record per data row.
 */
export function csvToRecords(text: string): {
  headers: string[];
  rows: Record<string, string>[];
} {
  const grid = parseCsv(text);
  if (grid.length === 0) return { headers: [], rows: [] };
  const headers = grid[0].map((h) => h.trim().toLowerCase());
  const rows = grid.slice(1).map((r) => {
    const o: Record<string, string> = {};
    headers.forEach((h, i) => {
      o[h] = (r[i] ?? "").trim();
    });
    return o;
  });
  return { headers, rows };
}
