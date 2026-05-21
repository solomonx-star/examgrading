import Link from "next/link";
import { requireAdminScope } from "@/lib/admin-scope";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default async function ReportsLandingPage() {
  const me = await requireAdminScope();
  return (
    <div>
      <PageHeader
        title="Reports"
        description={`Department: ${me.department}. Choose a report below.`}
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Link
          href="/admin/reports/grades"
          className="group rounded-2xl border border-stroke bg-white p-5 shadow-sm transition hover:border-primary"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-body">
            Report
          </p>
          <p className="mt-1 text-lg font-semibold text-foreground group-hover:text-primary">
            Grade report
          </p>
          <p className="mt-1 text-sm text-body">
            Per-module breakdown of CA components, exam score, final grade and
            GPA for every enrolled student. CSV download or print to PDF.
          </p>
        </Link>
        <Link
          href="/admin/reports/attendance"
          className="group rounded-2xl border border-stroke bg-white p-5 shadow-sm transition hover:border-primary"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-body">
            Report
          </p>
          <p className="mt-1 text-lg font-semibold text-foreground group-hover:text-primary">
            Attendance report
          </p>
          <p className="mt-1 text-sm text-body">
            Per-module attendance summary and full daily log over a chosen date
            range. CSV download or print to PDF.
          </p>
        </Link>
      </div>
    </div>
  );
}
