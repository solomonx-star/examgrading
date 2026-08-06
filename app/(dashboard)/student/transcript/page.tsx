import Image from "next/image";
import Link from "next/link";
import { connectDB } from "@/lib/db";
import { requireActiveStudentAccess } from "@/lib/student-scope";
import {
  averageGPA,
  getEnrolledModules,
  getPublishedGradesForStudent,
} from "@/lib/student-data";
import { PageHeader } from "@/components/ui/PageHeader";
import { AutoRefresh } from "@/components/ui/AutoRefresh";
import { PrintButton } from "@/components/ui/PrintButton";

export const dynamic = "force-dynamic";

type Row = {
  moduleId: string;
  code: string;
  name: string;
  academicYear: string;
  semester: "First" | "Second" | "Summer";
  score: number | null;
  grade: string | null;
  gpa: number | null;
  remark: string | null;
};

const PASS_GPA = 2.9;

function periodKey(year: string, semester: string) {
  return `${year}::${semester}`;
}

export default async function StudentTranscriptPage() {
  const me = await requireActiveStudentAccess();
  await connectDB();

  const [modules, grades] = await Promise.all([
    getEnrolledModules(me.userId),
    getPublishedGradesForStudent(me.userId),
  ]);

  const moduleById = new Map(modules.map((m) => [m.id, m]));

  const rows: Row[] = grades
    .map((g) => {
      const m = moduleById.get(String(g.courseId));
      if (!m) return null;
      return {
        moduleId: m.id,
        code: m.code,
        name: m.name,
        academicYear: g.academicYear,
        semester: g.semester,
        score: g.calculatedScore ?? null,
        grade: g.calculatedGrade ?? null,
        gpa: g.calculatedGPA ?? null,
        remark: g.calculatedRemark ?? null,
      };
    })
    .filter((r): r is Row => r !== null);

  // Sort each period's rows by code, period order ascending (earliest first)
  const byPeriod = new Map<string, Row[]>();
  for (const r of rows) {
    const k = periodKey(r.academicYear, r.semester);
    const arr = byPeriod.get(k) ?? [];
    arr.push(r);
    byPeriod.set(k, arr);
  }
  for (const arr of byPeriod.values()) {
    arr.sort((a, b) => a.code.localeCompare(b.code));
  }
  const sortedPeriods = [...byPeriod.entries()].sort((a, b) =>
    a[0] < b[0] ? -1 : 1,
  );

  const cumulative = averageGPA(rows);

  const issuedOn = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="print:bg-white">
      <AutoRefresh intervalMs={60_000} />
      <div className="print:hidden">
        <PageHeader
          title="Academic transcript"
          description="Only published grades are included. Save as PDF or print a signed copy."
        />
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <PrintButton label="Print / Save transcript as PDF" />
          <Link
            href="/student/grades"
            className="text-sm font-medium text-body hover:text-foreground"
          >
            ← Back to grades
          </Link>
        </div>
      </div>

      {/* IAM CO letterhead — visible both on screen and in print so the user
          sees what they're about to print. Rendered as <div> not <header>
          so globals.css's print rule doesn't suppress it. */}
      <div className="mb-6 rounded-2xl border border-stroke bg-white p-6 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none">
        <div className="text-center">
          <Image
            src="/IAMCOLOGO.png"
            alt="I AM Community College logo"
            width={96}
            height={96}
            priority
            className="mx-auto mb-3 h-20 w-20 object-contain print:h-16 print:w-16"
          />
          <h1 className="text-lg font-bold uppercase tracking-wide text-foreground">
            I AM Community College (I AM CO)
          </h1>
          <p className="text-xs text-body">
            24C Luke Lane, Tengbeh Town, Freetown
          </p>
          <p className="text-xs text-body">
            Tel: +232 79424282 / 77573195 · Email: iamcogmsl@gmail.com
          </p>
          <h2 className="mt-3 text-sm font-semibold uppercase tracking-wide text-foreground">
            Academic Transcript
          </h2>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <span className="text-body">Name: </span>
            <span className="font-semibold text-foreground">{me.name}</span>
          </div>
          <div>
            <span className="text-body">Student ID: </span>
            <span className="font-mono text-foreground">
              {me.studentId ?? "—"}
            </span>
          </div>
          <div>
            <span className="text-body">Programme: </span>
            <span className="text-foreground">{me.programmeName ?? "—"}</span>
          </div>
          <div>
            <span className="text-body">Year level: </span>
            <span className="text-foreground">
              {me.yearLevel ? `Year ${me.yearLevel}` : "—"}
            </span>
          </div>
          <div>
            <span className="text-body">Department: </span>
            <span className="text-foreground">{me.department ?? "—"}</span>
          </div>
          <div>
            <span className="text-body">Issued: </span>
            <span className="text-foreground">{issuedOn}</span>
          </div>
        </div>
      </div>

      {sortedPeriods.length === 0 ? (
        <div className="rounded-2xl border border-stroke bg-white p-6 text-center text-sm text-body shadow-sm print:border-0 print:shadow-none">
          No published grades to display yet.
        </div>
      ) : (
        <div className="space-y-6 print:space-y-4">
          {sortedPeriods.map(([key, periodRows]) => {
            const [year, semester] = key.split("::");
            const pgpa = averageGPA(periodRows);
            return (
              <section
                key={key}
                className="overflow-x-auto rounded-2xl border border-stroke bg-white shadow-sm print:rounded-none print:border-0 print:shadow-none print:break-inside-avoid"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stroke px-5 py-3 print:px-0">
                  <h2 className="text-sm font-semibold text-foreground">
                    {year} · {semester} Semester
                  </h2>
                  <p className="text-xs text-body">
                    Semester GPA{" "}
                    <span
                      className={`font-semibold ${pgpa.gpa === null ? "text-foreground" : pgpa.gpa >= PASS_GPA ? "text-meta-3" : "text-meta-1"}`}
                    >
                      {pgpa.gpa === null ? "—" : pgpa.gpa.toFixed(2)}
                    </span>{" "}
                    · {pgpa.count} module{pgpa.count === 1 ? "" : "s"}
                  </p>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-whiter text-left text-xs uppercase tracking-wide text-body print:bg-white">
                    <tr>
                      <th className="px-5 py-2 print:px-0">Code</th>
                      <th className="px-5 py-2 print:px-0">Module</th>
                      <th className="hidden px-5 py-2 text-right md:table-cell print:table-cell print:px-0">
                        Score
                      </th>
                      <th className="px-5 py-2 print:px-0">Grade</th>
                      <th className="hidden px-5 py-2 sm:table-cell print:table-cell print:px-0">
                        Remarks
                      </th>
                      <th className="px-5 py-2 text-right print:px-0">GPA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stroke">
                    {periodRows.map((r) => (
                      <tr key={r.moduleId}>
                        <td className="px-5 py-2 font-mono text-xs text-foreground print:px-0">
                          {r.code}
                        </td>
                        <td className="px-5 py-2 text-foreground print:px-0">
                          {r.name}
                        </td>
                        <td className="hidden px-5 py-2 text-right text-body md:table-cell print:table-cell print:px-0">
                          {r.score?.toFixed(2) ?? "—"}
                        </td>
                        <td className="px-5 py-2 font-semibold text-foreground print:px-0">
                          {r.grade ?? "—"}
                        </td>
                        <td className="hidden px-5 py-2 text-body sm:table-cell print:table-cell print:px-0">
                          {r.remark ?? "—"}
                        </td>
                        <td
                          className={`px-5 py-2 text-right font-semibold print:px-0 ${r.gpa === null ? "text-body" : r.gpa >= PASS_GPA ? "text-meta-3" : "text-meta-1"}`}
                        >
                          {r.gpa?.toFixed(2) ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            );
          })}

          <section className="rounded-2xl border border-stroke bg-white p-5 shadow-sm print:rounded-none print:border-t-2 print:border-b-0 print:border-x-0 print:border-foreground print:bg-white print:p-0 print:pt-3 print:shadow-none print:break-inside-avoid">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-body">
                  Cumulative
                </p>
                <p
                  className={`text-2xl font-bold ${cumulative.gpa === null ? "text-foreground" : cumulative.gpa >= PASS_GPA ? "text-meta-3" : "text-meta-1"}`}
                >
                  {cumulative.gpa === null
                    ? "—"
                    : cumulative.gpa.toFixed(2)}
                </p>
              </div>
              <p className="text-sm text-body">
                Across {cumulative.count} published module
                {cumulative.count === 1 ? "" : "s"} (simple average of module
                GPAs)
              </p>
            </div>
          </section>
        </div>
      )}

      {/* Print-only signature block (Exams Office signs the transcript). */}
      <section className="mt-8 hidden text-xs print:block">
        <div className="grid grid-cols-2 gap-8">
          <div>
            <p className="font-semibold">Exam&apos;s Office</p>
            <p className="mt-4">
              Sign: .........................................
            </p>
            <p className="mt-2">
              Date: .........................................
            </p>
          </div>
          <div>
            <p className="font-semibold">Registrar</p>
            <p className="mt-4">
              Sign: .........................................
            </p>
            <p className="mt-2">
              Date: .........................................
            </p>
          </div>
        </div>
      </section>

      <p className="mt-4 hidden text-[10px] text-body print:block">
        Generated {new Date().toLocaleString("en-GB")} · This document lists
        only grades that have been officially published by the Exam&apos;s
        Office. Not valid without official signature and stamp.
      </p>
    </div>
  );
}
