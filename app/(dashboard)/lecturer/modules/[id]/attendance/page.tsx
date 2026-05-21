import Link from "next/link";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { Attendance } from "@/models/Attendance";
import { requireLecturerCourse } from "@/lib/lecturer-course";
import { PageHeader } from "@/components/ui/PageHeader";
import { AttendanceSheet } from "./attendance-sheet";

export const dynamic = "force-dynamic";

function todayYMD(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default async function AttendancePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { course: mod } = await requireLecturerCourse(id);

  const date =
    sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : todayYMD();
  const dayUTC = new Date(`${date}T00:00:00.000Z`);

  await connectDB();
  const students = await User.find({
    _id: { $in: mod.enrolledStudents },
  })
    .select("name studentId isActive")
    .sort({ name: 1 })
    .lean();

  // Records for the chosen date
  const todays = await Attendance.find({
    courseId: mod._id,
    date: dayUTC,
  })
    .select("studentId status")
    .lean();
  const statusByStudent = new Map(
    todays.map((r) => [String(r.studentId), r.status as "present" | "absent" | "late"]),
  );

  // Overall attendance % per student for this course
  const summary = await Attendance.aggregate<{
    _id: typeof mod._id;
    total: number;
    present: number;
  }>([
    { $match: { courseId: mod._id, studentId: { $in: mod.enrolledStudents } } },
    {
      $group: {
        _id: "$studentId",
        total: { $sum: 1 },
        present: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } },
      },
    },
  ]);
  const pctByStudent = new Map<string, { total: number; present: number }>(
    summary.map((s) => [String(s._id), { total: s.total, present: s.present }]),
  );

  return (
    <div>
      <PageHeader
        title="Attendance"
        description={`${mod.code} — ${mod.name} · Year ${mod.yearLevel}`}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <form className="flex items-center gap-2">
          <label className="text-sm font-medium text-foreground">Date</label>
          <input
            name="date"
            type="date"
            defaultValue={date}
            className="rounded-lg border border-stroke bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            type="submit"
            className="rounded-lg border border-stroke px-3 py-2 text-sm font-medium hover:border-primary hover:text-primary"
          >
            Load
          </button>
        </form>
        <Link
          href={`/lecturer/modules/${id}`}
          className="text-sm font-medium text-body hover:text-foreground"
        >
          ← Course overview
        </Link>
      </div>

      <AttendanceSheet
        courseId={id}
        date={date}
        students={students.map((s) => {
          const sid = String(s._id);
          const stats = pctByStudent.get(sid);
          const pct = stats && stats.total > 0
            ? Math.round((stats.present / stats.total) * 100)
            : null;
          return {
            id: sid,
            name: s.name as string,
            studentId: s.studentId ?? "",
            inactive: !s.isActive,
            currentStatus: statusByStudent.get(sid) ?? null,
            percent: pct,
            total: stats?.total ?? 0,
          };
        })}
      />
    </div>
  );
}
