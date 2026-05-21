import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/db";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { PageHeader } from "@/components/ui/PageHeader";
import { PeriodRowActions } from "./row-actions";
import { NewPeriodForm } from "./new-period-form";

export const dynamic = "force-dynamic";

function formatDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function AcademicPeriodsPage() {
  const session = await auth();
  if (session?.user?.role !== "superadmin") redirect("/");

  await connectDB();
  const periods = await AcademicPeriod.find()
    .sort({ year: -1, semester: 1 })
    .lean();

  return (
    <div>
      <PageHeader
        title="Academic periods"
        description="Set the current semester/year. Only one period can be current at a time."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="overflow-x-auto rounded-2xl border border-stroke bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-whiter text-left text-xs uppercase tracking-wide text-body">
                <tr>
                  <th className="px-4 py-3">Year</th>
                  <th className="px-4 py-3">Semester</th>
                  <th className="px-4 py-3">Start</th>
                  <th className="px-4 py-3">End</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stroke">
                {periods.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-10 text-center text-sm text-body"
                    >
                      No academic periods yet.
                    </td>
                  </tr>
                ) : (
                  periods.map((p) => {
                    const id = String(p._id);
                    return (
                      <tr key={id} className="hover:bg-whiter">
                        <td className="px-4 py-3 font-medium text-foreground">
                          {p.year}
                        </td>
                        <td className="px-4 py-3 text-body">{p.semester}</td>
                        <td className="px-4 py-3 text-body">
                          {formatDate(p.startDate)}
                        </td>
                        <td className="px-4 py-3 text-body">
                          {formatDate(p.endDate)}
                        </td>
                        <td className="px-4 py-3">
                          {p.isCurrent ? (
                            <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                              Current
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full bg-whiter px-2.5 py-0.5 text-xs font-medium text-body">
                              Inactive
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <PeriodRowActions
                            id={id}
                            isCurrent={p.isCurrent}
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div className="rounded-2xl border border-stroke bg-white p-5 shadow-sm">
            <h2 className="mb-1 text-sm font-semibold text-foreground">
              Add academic period
            </h2>
            <p className="mb-3 text-xs text-body">
              Year format: <code>2025/2026</code>.
            </p>
            <NewPeriodForm />
          </div>
        </div>
      </div>
    </div>
  );
}
