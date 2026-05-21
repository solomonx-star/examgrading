import Link from "next/link";
import type { AuditLogLite } from "@/lib/audit-data";

function fmt(d: Date): string {
  return new Date(d).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const roleClass: Record<string, string> = {
  superadmin: "bg-primary/10 text-primary",
  admin: "bg-secondary/30 text-foreground",
  lecturer: "bg-meta-3/10 text-meta-3",
  student: "bg-whiter text-body",
  system: "bg-meta-1/10 text-meta-1",
};

export function AuditTable({
  rows,
  page,
  totalPages,
  total,
  buildHref,
  showDepartment,
}: {
  rows: AuditLogLite[];
  page: number;
  totalPages: number;
  total: number;
  buildHref: (page: number) => string;
  showDepartment: boolean;
}) {
  return (
    <>
      <div className="overflow-x-auto rounded-2xl border border-stroke bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-whiter text-left text-xs uppercase tracking-wide text-body">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Actor</th>
              {showDepartment ? (
                <th className="hidden px-4 py-3 lg:table-cell">Department</th>
              ) : null}
              <th className="hidden px-4 py-3 md:table-cell">Action</th>
              <th className="px-4 py-3">Summary</th>
              <th className="hidden px-4 py-3 lg:table-cell">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stroke">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={showDepartment ? 6 : 5}
                  className="px-4 py-10 text-center text-sm text-body"
                >
                  No audit entries match these filters.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const role = r.actorRole ?? "system";
                return (
                  <tr key={r.id} className="align-top hover:bg-whiter">
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono text-[11px] text-body">
                      {fmt(r.at)}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-foreground">
                        {r.actorName ?? "system"}
                      </div>
                      <span
                        className={
                          "mt-0.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium " +
                          (roleClass[role] ?? "bg-whiter text-body")
                        }
                      >
                        {role}
                      </span>
                    </td>
                    {showDepartment ? (
                      <td className="hidden px-4 py-2.5 text-body lg:table-cell">
                        {r.actorDepartment ?? "—"}
                      </td>
                    ) : null}
                    <td className="hidden px-4 py-2.5 md:table-cell">
                      <code className="rounded bg-whiter px-1.5 py-0.5 text-[11px] text-foreground">
                        {r.action}
                      </code>
                    </td>
                    <td className="px-4 py-2.5 text-foreground">
                      {r.summary}
                      {r.entityType && r.entityId ? (
                        <div className="mt-0.5 text-[10px] text-body">
                          {r.entityType} · {r.entityId}
                        </div>
                      ) : null}
                    </td>
                    <td className="hidden px-4 py-2.5 font-mono text-[11px] text-body lg:table-cell">
                      {r.ip ?? "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-body">
        <p>
          Showing page {page} of {totalPages} · {total} total event
          {total === 1 ? "" : "s"}
        </p>
        <div className="flex items-center gap-2">
          {page > 1 ? (
            <Link
              href={buildHref(page - 1)}
              className="rounded-md border border-stroke px-3 py-1 text-xs font-medium hover:border-primary hover:text-primary"
            >
              ← Newer
            </Link>
          ) : (
            <span className="rounded-md border border-stroke px-3 py-1 text-xs font-medium opacity-40">
              ← Newer
            </span>
          )}
          {page < totalPages ? (
            <Link
              href={buildHref(page + 1)}
              className="rounded-md border border-stroke px-3 py-1 text-xs font-medium hover:border-primary hover:text-primary"
            >
              Older →
            </Link>
          ) : (
            <span className="rounded-md border border-stroke px-3 py-1 text-xs font-medium opacity-40">
              Older →
            </span>
          )}
        </div>
      </div>
    </>
  );
}
