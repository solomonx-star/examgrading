import Link from "next/link";
import { requireActiveStudentAccess } from "@/lib/student-scope";
import {
  getAttendanceStatsForStudent,
  getEnrolledModules,
} from "@/lib/student-data";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default async function StudentAttendancePage() {
  const me = await requireActiveStudentAccess();
  const modules = await getEnrolledModules(me.userId);
  const stats = await getAttendanceStatsForStudent(
    me.userId,
    modules.map((m) => m.id),
  );

  return (
    <div>
      <PageHeader
        title="Attendance"
        description="Your attendance across every enrolled module."
      />

      <div className="overflow-x-auto rounded-2xl border border-stroke bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-whiter text-left text-xs uppercase tracking-wide text-body">
            <tr>
              <th className="px-4 py-3">Module</th>
              <th className="hidden px-4 py-3 lg:table-cell">Period</th>
              <th className="hidden px-4 py-3 sm:table-cell">Sessions</th>
              <th className="hidden px-4 py-3 md:table-cell">Present</th>
              <th className="hidden px-4 py-3 md:table-cell">Absent</th>
              <th className="hidden px-4 py-3 md:table-cell">Late</th>
              <th className="px-4 py-3 text-right">%</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stroke">
            {modules.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-sm text-body"
                >
                  No enrolled modules.
                </td>
              </tr>
            ) : (
              modules.map((m) => {
                const s = stats.get(m.id);
                return (
                  <tr key={m.id} className="hover:bg-whiter">
                    <td className="px-4 py-3">
                      <Link
                        href={`/student/modules/${m.id}`}
                        className="font-medium text-foreground hover:text-primary"
                      >
                        <span className="font-mono text-xs">{m.code}</span>
                        <span className="mx-2 text-body">·</span>
                        {m.name}
                      </Link>
                    </td>
                    <td className="hidden px-4 py-3 text-body lg:table-cell">
                      {m.academicYear} · {m.semester}
                    </td>
                    <td className="hidden px-4 py-3 text-body sm:table-cell">
                      {s?.total ?? 0}
                    </td>
                    <td className="hidden px-4 py-3 text-body md:table-cell">
                      {s?.present ?? 0}
                    </td>
                    <td className="hidden px-4 py-3 text-body md:table-cell">
                      {s?.absent ?? 0}
                    </td>
                    <td className="hidden px-4 py-3 text-body md:table-cell">
                      {s?.late ?? 0}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {s && s.pct !== null ? (
                        <span
                          className={
                            s.pct >= 75
                              ? "font-semibold text-meta-3"
                              : "font-semibold text-meta-1"
                          }
                        >
                          {s.pct}%
                        </span>
                      ) : (
                        <span className="text-xs text-body">—</span>
                      )}
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
