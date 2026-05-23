import { requireAdminScope } from "@/lib/admin-scope";
import { loadAuditPage, listAuditActions } from "@/lib/audit-data";
import { PageHeader } from "@/components/ui/PageHeader";
import { AuditTable } from "@/components/dashboard/AuditTable";
import { AuditFilterForm } from "@/components/dashboard/AuditFilterForm";

export const dynamic = "force-dynamic";

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{
    actor?: string;
    action?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}) {
  await requireAdminScope();
  const sp = await searchParams;

  const page = sp.page && /^\d+$/.test(sp.page) ? Number(sp.page) : 1;

  const [pageData, actions] = await Promise.all([
    loadAuditPage({
      filters: {
        actor: sp.actor?.trim() || undefined,
        action: sp.action?.trim() || undefined,
        fromYMD: sp.from?.trim() || undefined,
        toYMD: sp.to?.trim() || undefined,
        excludeActorRoles: ["superadmin"],
        excludeActionPrefixes: ["access_payment."],
      },
      page,
      pageSize: 50,
    }),
    listAuditActions({
      excludeActorRoles: ["superadmin"],
      excludeActionPrefixes: ["access_payment."],
    }),
  ]);

  function hrefForPage(p: number): string {
    const params = new URLSearchParams();
    if (sp.actor) params.set("actor", sp.actor);
    if (sp.action) params.set("action", sp.action);
    if (sp.from) params.set("from", sp.from);
    if (sp.to) params.set("to", sp.to);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/admin/audit?${qs}` : "/admin/audit";
  }

  return (
    <div>
      <PageHeader
        title="Audit log"
        description="Every grade, attendance, user and module change on the platform."
      />

      <AuditFilterForm
        baseHref="/admin/audit"
        actions={actions}
        defaults={{
          actor: sp.actor,
          action: sp.action,
          from: sp.from,
          to: sp.to,
        }}
      />

      <AuditTable
        rows={pageData.rows}
        page={pageData.page}
        totalPages={pageData.totalPages}
        total={pageData.total}
        buildHref={hrefForPage}
        showDepartment={false}
      />
    </div>
  );
}
