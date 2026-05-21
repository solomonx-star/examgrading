import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminScope } from "@/lib/admin-scope";
import { loadAttendanceReport, loadCourseHeader } from "@/lib/report-data";
import { PageHeader } from "@/components/ui/PageHeader";
import { PrintButton } from "@/components/ui/PrintButton";
import { AttendanceDonutChart } from "@/components/charts/AttendanceDonutChart";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<"present" | "absent" | "late", string> = {
  present: "Present",
  absent: "Absent",
  late: "Late",
};

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function parseYMD(value: string | undefined): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export default async function AttendanceReportViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ moduleId: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requireAdminScope();
  const { moduleId } = await params;
  const sp = await searchParams;
  const mod = await loadCourseHeader(moduleId);
  if (!mod) notFound();

  const from = parseYMD(sp.from);
  const toDate = parseYMD(sp.to);
  // Treat the to date as inclusive end-of-day
  const toEod = toDate
    ? new Date(toDate.getTime() + 24 * 60 * 60 * 1000 - 1)
    : undefined;

  const { summary, log } = await loadAttendanceReport(moduleId, from, toEod);

  const totals = summary.reduce(
    (acc, s) => {
      acc.present += s.present;
      acc.absent += s.absent;
      acc.late += s.late;
      return acc;
    },
    { present: 0, absent: 0, late: 0 },
  );

  const csvHref = `/api/admin/reports/attendance/${moduleId}/csv${
    sp.from || sp.to
      ? `?${[
          sp.from ? `from=${sp.from}` : null,
          sp.to ? `to=${sp.to}` : null,
        ]
          .filter(Boolean)
          .join("&")}`
      : ""
  }`;

  return (
    <div className="print:bg-white">
      <div className="print:hidden">
        <PageHeader
          title="Attendance report"
          description={`${mod.code} — ${mod.name} · ${mod.academicYear} · ${mod.semester}`}
        />

        <form className="mb-4 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
          <div>
            <label className="block text-xs font-medium text-foreground">
              From
            </label>
            <input
              type="date"
              name="from"
              defaultValue={sp.from ?? ""}
              className="mt-1 w-full rounded-lg border border-stroke bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:w-auto"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground">
              To
            </label>
            <input
              type="date"
              name="to"
              defaultValue={sp.to ?? ""}
              className="mt-1 w-full rounded-lg border border-stroke bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:w-auto"
            />
          </div>
          <button
            type="submit"
            className="col-span-2 rounded-lg border border-stroke px-3 py-2 text-sm font-medium hover:border-primary hover:text-primary sm:col-span-1"
          >
            Apply
          </button>
          <a
            href={csvHref}
            className="col-span-2 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-dark sm:col-span-1"
          >
            Download CSV
          </a>
          <PrintButton />
          <Link
            href="/admin/reports/attendance"
            className="col-span-2 text-sm font-medium text-body hover:text-foreground sm:col-span-1"
          >
            ← Back
          </Link>
        </form>
      </div>

      <div className="mb-4 hidden text-center print:block">
        <h1 className="text-lg font-bold uppercase tracking-wide">
          I AM Community College (I AM CO)
        </h1>
        <p className="text-xs">24C Luke Lane, Tengbeh Town, Freetown</p>
        <p className="text-xs">
          Tel: +232 79424282 / 77573195 · Email: iamcogmsl@gmail.com
        </p>
        <h2 className="mt-2 text-sm font-semibold uppercase">
          Attendance Sheet
        </h2>
        <p className="text-xs">
          {mod.code} — {mod.name} · {mod.academicYear} · {mod.semester} Semester
          {sp.from || sp.to
            ? ` · ${sp.from ?? "…"} → ${sp.to ?? "…"}`
            : ""}
        </p>
      </div>

      <section className="mb-6 rounded-2xl border border-stroke bg-white p-5 shadow-sm print:hidden">
        <p className="text-xs font-medium uppercase tracking-wide text-body">
          Attendance breakdown
        </p>
        <p className="mt-1 mb-3 text-sm text-body">
          Across {summary.length} student{summary.length === 1 ? "" : "s"}
          {sp.from || sp.to
            ? ` from ${sp.from ?? "…"} to ${sp.to ?? "…"}`
            : ""}
          .
        </p>
        <AttendanceDonutChart
          present={totals.present}
          absent={totals.absent}
          late={totals.late}
        />
      </section>

      <section className="mb-6 overflow-x-auto rounded-2xl border border-stroke bg-white shadow-sm print:rounded-none print:border-0 print:shadow-none">
        <div className="border-b border-stroke px-5 py-3">
          <h2 className="text-sm font-semibold text-foreground">Summary</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-whiter text-left text-xs uppercase tracking-wide text-body print:bg-white">
            <tr>
              <th className="px-4 py-3">Student ID</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Sessions</th>
              <th className="px-4 py-3">Present</th>
              <th className="px-4 py-3">Absent</th>
              <th className="px-4 py-3">Late</th>
              <th className="px-4 py-3 text-right">%</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stroke">
            {summary.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-sm text-body"
                >
                  No enrolled students.
                </td>
              </tr>
            ) : (
              summary.map((s) => (
                <tr key={s.studentId}>
                  <td className="px-4 py-2 font-mono text-xs text-body">
                    {s.studentCode}
                  </td>
                  <td className="px-4 py-2 font-medium text-foreground">
                    {s.name}
                  </td>
                  <td className="px-4 py-2 text-body">{s.total}</td>
                  <td className="px-4 py-2 text-body">{s.present}</td>
                  <td className="px-4 py-2 text-body">{s.absent}</td>
                  <td className="px-4 py-2 text-body">{s.late}</td>
                  <td className="px-4 py-2 text-right">
                    {s.pct === null ? (
                      <span className="text-xs text-body">—</span>
                    ) : (
                      <span
                        className={
                          s.pct >= 75
                            ? "font-semibold text-meta-3"
                            : "font-semibold text-meta-1"
                        }
                      >
                        {s.pct}%
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section className="overflow-x-auto rounded-2xl border border-stroke bg-white shadow-sm print:rounded-none print:border-0 print:shadow-none">
        <div className="border-b border-stroke px-5 py-3">
          <h2 className="text-sm font-semibold text-foreground">Daily log</h2>
          <p className="text-xs text-body">
            {log.length} record{log.length === 1 ? "" : "s"}
          </p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-whiter text-left text-xs uppercase tracking-wide text-body print:bg-white">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Student ID</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stroke">
            {log.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-10 text-center text-sm text-body"
                >
                  No attendance records.
                </td>
              </tr>
            ) : (
              log.map((r, i) => (
                <tr key={i}>
                  <td className="px-4 py-2 text-body">{formatDate(r.date)}</td>
                  <td className="px-4 py-2 font-mono text-xs text-body">
                    {r.studentCode}
                  </td>
                  <td className="px-4 py-2 text-foreground">{r.name}</td>
                  <td className="px-4 py-2">
                    <span
                      className={
                        "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium print:bg-transparent " +
                        (r.status === "present"
                          ? "bg-meta-3/10 text-meta-3"
                          : r.status === "absent"
                            ? "bg-meta-1/10 text-meta-1"
                            : "bg-secondary/20 text-foreground")
                      }
                    >
                      {STATUS_LABEL[r.status]}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-body">{r.notes ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <p className="mt-4 hidden text-[10px] text-body print:block">
        Generated {new Date().toLocaleString("en-GB")} · IAM CO Exam Management
      </p>
    </div>
  );
}
