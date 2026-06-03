import Link from "next/link";
import { connectDB } from "@/lib/db";
import { Programme } from "@/models/Programme";
import { requireActiveStudentAccess } from "@/lib/student-scope";
import {
  getAttendanceStatsForStudent,
  getEnrolledModules,
  getPublishedGradesForStudent,
} from "@/lib/student-data";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default async function StudentModulesPage() {
  const me = await requireActiveStudentAccess();
  await connectDB();

  const modules = await getEnrolledModules(me.userId);
  const ids = modules.map((m) => m.id);
  const [attStats, grades, programmes] = await Promise.all([
    getAttendanceStatsForStudent(me.userId, ids),
    getPublishedGradesForStudent(me.userId),
    Programme.find({
      _id: {
        $in: Array.from(
          new Set(modules.flatMap((m) => m.programmeIds ?? [])),
        ),
      },
    })
      .select("name code")
      .lean(),
  ]);

  const programmeById = new Map(
    programmes.map((p) => [
      String(p._id),
      { name: p.name as string, code: p.code as string },
    ]),
  );

  const gradeByModule = new Map(
    grades.map((g) => [
      String(g.courseId),
      {
        grade: g.calculatedGrade ?? null,
        gpa: g.calculatedGPA ?? null,
      },
    ]),
  );

  return (
    <div>
      <PageHeader
        title="My modules"
        description="All modules you are enrolled in, current and past."
      />
      <div className="overflow-x-auto rounded-2xl border border-stroke bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-whiter text-left text-xs uppercase tracking-wide text-body">
            <tr>
              <th className="hidden px-4 py-3 sm:table-cell">Code</th>
              <th className="px-4 py-3">Name</th>
              <th className="hidden px-4 py-3 lg:table-cell">Programme</th>
              <th className="px-4 py-3">Year</th>
              <th className="hidden px-4 py-3 lg:table-cell">Period</th>
              <th className="px-4 py-3">Attendance</th>
              <th className="px-4 py-3">Grade</th>
              <th className="px-4 py-3 text-right">Open</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stroke">
            {modules.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-10 text-center text-sm text-body"
                >
                  You are not enrolled in any modules yet.
                </td>
              </tr>
            ) : (
              modules.map((m) => {
                const att = attStats.get(m.id);
                const grade = gradeByModule.get(m.id);
                // Prefer the student's own programme if this module is shared
                // across multiple programmes — otherwise just show the first.
                const pids = m.programmeIds ?? [];
                const ownPid = me.programmeId ?? null;
                const matchedPid =
                  ownPid && pids.includes(ownPid) ? ownPid : pids[0];
                const programme = matchedPid
                  ? programmeById.get(matchedPid)
                  : undefined;
                return (
                  <tr key={m.id} className="hover:bg-whiter">
                    <td className="hidden px-4 py-3 font-mono text-xs text-foreground sm:table-cell">
                      {m.code}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/student/modules/${m.id}`}
                        className="font-medium text-foreground hover:text-primary"
                      >
                        <span className="font-mono text-xs text-body sm:hidden">
                          {m.code}
                        </span>
                        <span className="block sm:inline">{m.name}</span>
                      </Link>
                    </td>
                    <td className="hidden px-4 py-3 text-body lg:table-cell">
                      {programme?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-body">Year {m.yearLevel}</td>
                    <td className="hidden px-4 py-3 text-body lg:table-cell">
                      {m.academicYear} · {m.semester}
                    </td>
                    <td className="px-4 py-3 text-body">
                      {att && att.pct !== null ? `${att.pct}%` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {grade?.grade ? (
                        <span className="inline-flex rounded-full bg-meta-3/10 px-2.5 py-0.5 text-xs font-medium text-meta-3">
                          {grade.grade}
                          {grade.gpa !== null
                            ? ` · ${grade.gpa.toFixed(1)}`
                            : ""}
                        </span>
                      ) : (
                        <span className="text-xs text-body">Not published</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/student/modules/${m.id}`}
                        className="rounded-md border border-stroke px-2.5 py-1 text-xs font-medium text-body hover:border-primary hover:text-primary"
                      >
                        Open
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
