import Link from "next/link";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { Programme } from "@/models/Programme";
import { Attendance } from "@/models/Attendance";
import { Grade } from "@/models/Grade";
import { requireLecturerCourse } from "@/lib/lecturer-course";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";

export const dynamic = "force-dynamic";

export default async function LecturerCoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { course: mod } = await requireLecturerCourse(id);

  await connectDB();
  const [enrolled, attendanceCount, gradeStats, programme] = await Promise.all([
    User.countDocuments({
      _id: { $in: mod.enrolledStudents },
      isActive: true,
    }),
    Attendance.countDocuments({ courseId: mod._id }),
    Grade.aggregate<{
      _id: null;
      total: number;
      submitted: number;
      published: number;
    }>([
      { $match: { courseId: mod._id } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          submitted: {
            $sum: { $cond: [{ $eq: ["$submissionStatus", "submitted"] }, 1, 0] },
          },
          published: { $sum: { $cond: ["$isPublished", 1, 0] } },
        },
      },
    ]),
    Programme.findById(mod.programmeId).select("name code").lean(),
  ]);

  const grades = gradeStats[0] ?? { total: 0, submitted: 0, published: 0 };

  return (
    <div>
      <PageHeader
        title={`${mod.code} — ${mod.name}`}
        description={`${programme?.name ?? ""} · Year ${mod.yearLevel} · ${mod.academicYear} · ${mod.semester}`}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Active students" value={enrolled} />
        <StatCard
          label="Attendance entries"
          value={attendanceCount}
          hint="Total records across all sessions"
        />
        <StatCard
          label="Grades"
          value={`${grades.submitted}/${grades.total}`}
          hint={`${grades.published} published by admin`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Link
          href={`/lecturer/modules/${id}/attendance`}
          className="group rounded-2xl border border-stroke bg-white p-5 shadow-sm transition hover:border-primary"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-body">
            Action
          </p>
          <p className="mt-1 text-lg font-semibold text-foreground group-hover:text-primary">
            Take / edit attendance
          </p>
          <p className="mt-1 text-sm text-body">
            Mark each enrolled student as present, absent, or late for a chosen
            date.
          </p>
        </Link>
        <Link
          href={`/lecturer/modules/${id}/grades`}
          className="group rounded-2xl border border-stroke bg-white p-5 shadow-sm transition hover:border-primary"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-body">
            Action
          </p>
          <p className="mt-1 text-lg font-semibold text-foreground group-hover:text-primary">
            Enter / submit grades
          </p>
          <p className="mt-1 text-sm text-body">
            Enter each student&apos;s 30% test score and 70% exam score.
            Submit to the admin for review and publishing.
          </p>
        </Link>
        <Link
          href={`/lecturer/modules/${id}/print`}
          className="group rounded-2xl border border-stroke bg-white p-5 shadow-sm transition hover:border-primary"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-body">
            Action
          </p>
          <p className="mt-1 text-lg font-semibold text-foreground group-hover:text-primary">
            Print grade sheet
          </p>
          <p className="mt-1 text-sm text-body">
            Print or save a PDF of the official IAM CO grade sheet with your
            current entries — useful for HoD review before submission.
          </p>
        </Link>
      </div>
    </div>
  );
}
