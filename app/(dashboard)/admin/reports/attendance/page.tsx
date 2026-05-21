import Link from "next/link";
import { connectDB } from "@/lib/db";
import { Course } from "@/models/Course";
import { requireAdminScope } from "@/lib/admin-scope";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default async function AttendanceReportPickerPage() {
  await requireAdminScope();
  await connectDB();
  const courses = await Course.find({})
    .select("code name academicYear semester")
    .sort({ academicYear: -1, semester: 1, code: 1 })
    .lean();

  return (
    <div>
      <PageHeader
        title="Attendance report"
        description="Pick a module to view its attendance report."
      />
      <div className="overflow-x-auto rounded-2xl border border-stroke bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-whiter text-left text-xs uppercase tracking-wide text-body">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Period</th>
              <th className="px-4 py-3 text-right">Open</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stroke">
            {courses.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-10 text-center text-sm text-body"
                >
                  No modules yet.
                </td>
              </tr>
            ) : (
              courses.map((c) => {
                const id = String(c._id);
                return (
                  <tr key={id} className="hover:bg-whiter">
                    <td className="px-4 py-3 font-mono text-xs text-foreground">
                      {c.code}
                    </td>
                    <td className="px-4 py-3 text-foreground">{c.name}</td>
                    <td className="px-4 py-3 text-body">
                      {c.academicYear} · {c.semester}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/reports/attendance/${id}`}
                        className="rounded-md border border-stroke px-2.5 py-1 text-xs font-medium text-body hover:border-primary hover:text-primary"
                      >
                        Open report
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
