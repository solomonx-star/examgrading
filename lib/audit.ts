// Server-only audit-log helpers. Writes never throw — auditing must not be
// allowed to block the business action that triggered it.
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { AuditLog, type AuditActorRole } from "@/models/AuditLog";

export type AuditActor = {
  userId: string;
  name: string;
  role: AuditActorRole;
  department?: string | null;
};

export type RecordAuditInput = {
  actor: AuditActor;
  action: string;
  summary: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
};

async function readClientHints(): Promise<{ ip?: string; userAgent?: string }> {
  try {
    const h = await headers();
    const fwd = h.get("x-forwarded-for");
    const ip = (fwd ? fwd.split(",")[0]?.trim() : null) || h.get("x-real-ip");
    return {
      ip: ip ?? undefined,
      userAgent: h.get("user-agent") ?? undefined,
    };
  } catch {
    return {};
  }
}

export async function recordAudit(input: RecordAuditInput): Promise<void> {
  try {
    await connectDB();
    const hints = await readClientHints();
    await AuditLog.create({
      at: new Date(),
      actorId: input.actor.userId || undefined,
      actorName: input.actor.name,
      actorRole: input.actor.role,
      actorDepartment: input.actor.department ?? undefined,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      summary: input.summary,
      metadata: input.metadata,
      ip: hints.ip,
      userAgent: hints.userAgent,
    });
  } catch (err) {
    // Never throw from an audit write — the business action has already happened.
    // eslint-disable-next-line no-console
    console.error("audit write failed:", err);
  }
}

/**
 * Pulls the current session, looks up the user's name + department, and
 * writes an audit entry. Convenience wrapper for server actions — they
 * already validated the user via their scope helper, so we just re-derive
 * the actor info for the log.
 */
export async function audit(
  input: Omit<RecordAuditInput, "actor">,
): Promise<void> {
  let actor: AuditActor = {
    userId: "",
    name: "system",
    role: "system",
    department: null,
  };
  try {
    const session = await auth();
    if (session?.user?.id) {
      await connectDB();
      const u = await User.findById(session.user.id)
        .select("name department")
        .lean();
      actor = {
        userId: session.user.id,
        name: u?.name ?? session.user.name ?? session.user.email ?? "Unknown",
        role: session.user.role as AuditActorRole,
        department: u?.department ?? null,
      };
    }
  } catch {
    // Fall through with system actor
  }
  await recordAudit({ ...input, actor });
}
