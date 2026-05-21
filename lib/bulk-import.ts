// Server-only: shared pipeline for CSV bulk imports of User records.
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { csvToRecords } from "@/lib/csv";
import { mongoDuplicateMessage } from "@/lib/form-state";

export const MAX_IMPORT_ROWS = 500;
export const MAX_FILE_BYTES = 2_000_000; // 2 MB

export type ImportRowError = {
  row: number;
  email: string;
  reason: string;
};

export type ImportResult = {
  created: number;
  skipped: ImportRowError[];
  failed: ImportRowError[];
  totalDataRows: number;
};

export type BulkImportState =
  | { ok: true; result: ImportResult }
  | { ok: false; error: string }
  | undefined;

/**
 * A per-row processor returns either:
 *  - { action: "create", email, doc } — pass `doc` to User.create
 *  - { action: "skip", email, reason } — push into result.skipped
 *  - { action: "fail", email, reason } — push into result.failed
 *
 * The helper handles file parsing, size limits, header presence, duplicate
 * detection (both against the database and within the same file), and
 * accumulating the result. Caller is responsible for revalidatePath().
 */
export type RowDecision =
  | { action: "create"; email: string; doc: Record<string, unknown> }
  | { action: "skip"; email: string; reason: string }
  | { action: "fail"; email: string; reason: string };

export type RowProcessor = (
  row: Record<string, string>,
) => Promise<RowDecision> | RowDecision;

export async function processCsvImport({
  formData,
  requiredColumns,
  processRow,
}: {
  formData: FormData;
  requiredColumns: string[];
  processRow: RowProcessor;
}): Promise<BulkImportState> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Please choose a CSV file." };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, error: "CSV file is too large (max 2 MB)." };
  }

  let text: string;
  try {
    text = await file.text();
  } catch {
    return { ok: false, error: "Could not read the file." };
  }

  const { headers, rows } = csvToRecords(text);
  const missing = requiredColumns.filter((c) => !headers.includes(c));
  if (missing.length) {
    return {
      ok: false,
      error: `Missing required column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}. Expected: ${requiredColumns.join(", ")}.`,
    };
  }
  if (rows.length === 0) {
    return { ok: false, error: "No data rows found in the file." };
  }
  if (rows.length > MAX_IMPORT_ROWS) {
    return {
      ok: false,
      error: `Too many rows (${rows.length}). Maximum ${MAX_IMPORT_ROWS} per import.`,
    };
  }

  await connectDB();

  const incomingEmails = Array.from(
    new Set(
      rows
        .map((r) => (r.email ?? "").trim().toLowerCase())
        .filter((e) => e.length > 0),
    ),
  );
  const existingDocs = incomingEmails.length
    ? await User.find({ email: { $in: incomingEmails } })
        .select("email")
        .lean()
    : [];
  const existingSet = new Set(existingDocs.map((u) => u.email));
  const seenInBatch = new Set<string>();

  const result: ImportResult = {
    created: 0,
    skipped: [],
    failed: [],
    totalDataRows: rows.length,
  };

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNum = i + 2; // header is row 1
    const decision = await processRow(r);

    if (decision.action === "fail") {
      result.failed.push({
        row: rowNum,
        email: decision.email,
        reason: decision.reason,
      });
      continue;
    }
    if (decision.action === "skip") {
      result.skipped.push({
        row: rowNum,
        email: decision.email,
        reason: decision.reason,
      });
      continue;
    }

    const email = decision.email.trim().toLowerCase();
    if (seenInBatch.has(email)) {
      result.skipped.push({
        row: rowNum,
        email,
        reason: "Duplicate email appears earlier in this file.",
      });
      continue;
    }
    if (existingSet.has(email)) {
      result.skipped.push({
        row: rowNum,
        email,
        reason: "A user with this email already exists.",
      });
      continue;
    }

    try {
      await User.create(decision.doc);
      seenInBatch.add(email);
      existingSet.add(email);
      result.created += 1;
    } catch (err) {
      const dup = mongoDuplicateMessage(err);
      result.failed.push({
        row: rowNum,
        email,
        reason: dup ?? "Could not create user.",
      });
    }
  }

  return { ok: true, result };
}
