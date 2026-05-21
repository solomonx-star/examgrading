import Link from "next/link";
import { requireLecturerScope } from "@/lib/lecturer-scope";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default async function LecturerReportsLandingPage() {
  await requireLecturerScope();
  return (
    <div>
      <PageHeader
        title="Reports"
        description="Reports for the modules you teach. Choose a report below."
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Link
          href="/lecturer/reports/grades"
          className="group rounded-2xl border border-stroke bg-white p-5 shadow-sm transition hover:border-primary"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-body">
            Report
          </p>
          <p className="mt-1 text-lg font-semibold text-foreground group-hover:text-primary">
            Grade report
          </p>
          <p className="mt-1 text-sm text-body">
            Per-module breakdown of CA, exam, final grade and GPA for every
            enrolled student. CSV download or print to PDF.
          </p>
        </Link>
        <Link
          href="/lecturer/reports/attendance"
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
