import type { ZodError } from "zod";

export type FormState =
  | { ok: true; message?: string }
  | { ok: false; error: string }
  | undefined;

export function zodToError(err: ZodError): string {
  return err.issues.map((i) => i.message).join("; ");
}

export function mongoDuplicateMessage(err: unknown): string | null {
  if (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: number }).code === 11000
  ) {
    const keyValue =
      typeof err === "object" && "keyValue" in err
        ? (err as { keyValue?: Record<string, unknown> }).keyValue
        : undefined;
    if (keyValue) {
      const field = Object.keys(keyValue)[0];
      return `A record with that ${field} already exists.`;
    }
    return "A record with those details already exists.";
  }
  return null;
}
