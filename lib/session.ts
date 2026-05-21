import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import type { Session } from "next-auth";
import type { UserRole } from "@/models/User";

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "AuthError";
  }
}

/**
 * Returns the session or throws AuthError(401). For API route handlers.
 */
export async function requireSession(): Promise<Session> {
  const session = await auth();
  if (!session?.user) {
    throw new AuthError("Unauthorized", 401);
  }
  return session;
}

/**
 * Like requireSession but also enforces role. Throws AuthError(403) on mismatch.
 */
export async function requireRole(
  ...allowed: UserRole[]
): Promise<Session> {
  const session = await requireSession();
  if (!allowed.includes(session.user.role)) {
    throw new AuthError("Forbidden", 403);
  }
  return session;
}

/**
 * Convert thrown AuthError (or anything else) into a JSON Response.
 * Use inside route handlers: `try { ... } catch (err) { return handleAuthError(err) }`
 */
export function handleAuthError(err: unknown): NextResponse | null {
  if (err instanceof AuthError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  return null;
}
