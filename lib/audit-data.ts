// Server-only: paginated audit-log query.
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { AuditLog, type IAuditLog } from "@/models/AuditLog";

export type AuditFilters = {
  // Optional substring matched against actor name (case-insensitive)
  actor?: string;
  // Exact match against the dotted action key, or "*" for any
  action?: string;
  // ISO yyyy-mm-dd inclusive on both ends
  fromYMD?: string;
  toYMD?: string;
  // Restrict to events from a specific department (admin scope)
  department?: string;
};

export type AuditLogLite = {
  id: string;
  at: Date;
  actorId: string | null;
  actorName: string | null;
  actorRole: IAuditLog["actorRole"];
  actorDepartment: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  summary: string;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
};

function parseYMD(value?: string): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export type AuditPage = {
  rows: AuditLogLite[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export async function loadAuditPage(args: {
  filters: AuditFilters;
  page?: number;
  pageSize?: number;
}): Promise<AuditPage> {
  const page = Math.max(1, args.page ?? 1);
  const pageSize = Math.min(200, Math.max(10, args.pageSize ?? 50));

  await connectDB();

  const f = args.filters;
  const filter: Record<string, unknown> = {};
  if (f.department) filter.actorDepartment = f.department;
  if (f.action && f.action !== "*") filter.action = f.action;
  if (f.actor) {
    const escaped = f.actor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.actorName = new RegExp(escaped, "i");
  }
  const from = parseYMD(f.fromYMD);
  const to = parseYMD(f.toYMD);
  if (from || to) {
    const range: Record<string, Date> = {};
    if (from) range.$gte = from;
    if (to) {
      // Treat the `to` date as inclusive end-of-day
      range.$lte = new Date(to.getTime() + 24 * 60 * 60 * 1000 - 1);
    }
    filter.at = range;
  }

  const [total, docs, distinctActions] = await Promise.all([
    AuditLog.countDocuments(filter),
    AuditLog.find(filter)
      .sort({ at: -1, _id: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    // Bonus: feed the filter dropdown with whatever actions actually exist
    AuditLog.distinct("action", f.department ? { actorDepartment: f.department } : {}),
  ]);

  void distinctActions; // computed inline by callers via /list helper if needed

  const rows: AuditLogLite[] = docs.map((d) => ({
    id: String(d._id),
    at: d.at,
    actorId: d.actorId ? String(d.actorId) : null,
    actorName: d.actorName ?? null,
    actorRole: d.actorRole ?? undefined,
    actorDepartment: d.actorDepartment ?? null,
    action: d.action,
    entityType: d.entityType ?? null,
    entityId: d.entityId ? String(d.entityId) : null,
    summary: d.summary,
    metadata: (d.metadata as Record<string, unknown>) ?? null,
    ip: d.ip ?? null,
    userAgent: d.userAgent ?? null,
  }));

  return {
    rows,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/**
 * Returns the list of `action` values present in the audit log, optionally
 * scoped to a department. Drives the action filter dropdown.
 */
export async function listAuditActions(department?: string): Promise<string[]> {
  await connectDB();
  const filter = department ? { actorDepartment: department } : {};
  const actions = (await AuditLog.distinct("action", filter)) as string[];
  return actions.sort((a, b) => a.localeCompare(b));
}

// Unused but kept to silence the unused-var hint on mongoose import in some envs
void mongoose;
