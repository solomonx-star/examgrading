import Link from "next/link";
import mongoose from "mongoose";
import { notFound } from "next/navigation";
import { connectDB } from "@/lib/db";
import { Test } from "@/models/Test";
import { TestSubmission } from "@/models/TestSubmission";
import { User } from "@/models/User";
import { requireLecturerCourse } from "@/lib/lecturer-course";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatPercent } from "@/lib/format";

export const dynamic = "force-dynamic";

function formatDateTime(d: Date | string): string {
  return new Date(d).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function LecturerTestResultsPage({
  params,
}: {
  params: Promise<{ id: string; testId: string }>;
}) {
  const { id, testId } = await params;
  const { course: mod } = await requireLecturerCourse(id);
  if (!mongoose.Types.ObjectId.isValid(testId)) notFound();

  await connectDB();
  const test = await Test.findOne({ _id: testId, courseId: mod._id }).lean();
  if (!test) notFound();

  const [submissions, enrolledUsers] = await Promise.all([
    TestSubmission.find({ testId: test._id })
      .sort({ submittedAt: -1 })
      .lean(),
    User.find({ _id: { $in: mod.enrolledStudents } })
      .select("name studentId")
      .lean(),
  ]);

  const userById = new Map(
    enrolledUsers.map((u) => [
      String(u._id),
      { name: u.name as string, studentId: u.studentId ?? "" },
    ]),
  );

  const submittedCount = submissions.filter(
    (s) => s.status === "submitted",
  ).length;
  const inProgressCount = submissions.filter(
    (s) => s.status === "in_progress",
  ).length;
  const enrolledCount = mod.enrolledStudents.length;

  return (
    <div>
      <PageHeader
        title={`Results · ${test.title}`}
        description={`${mod.code} — ${mod.name}`}
        secondaryAction={{
          href: `/lecturer/modules/${id}/tests/${testId}`,
          label: "← Edit test",
        }}
        action={{
          href: `/lecturer/modules/${id}/grades`,
          label: "Grade sheet →",
        }}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-stroke bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-body">
            Submitted
          </p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {submittedCount} / {enrolledCount}
          </p>
        </div>
        <div className="rounded-2xl border border-stroke bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-body">
            In progress
          </p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {inProgressCount}
          </p>
        </div>
        <div className="rounded-2xl border border-stroke bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-body">
            Window
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {formatDateTime(test.startsAt)}
          </p>
          <p className="text-xs text-body">→ {formatDateTime(test.endsAt)}</p>
        </div>
      </div>

      <section className="overflow-x-auto rounded-2xl border border-stroke bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-whiter text-left text-xs uppercase tracking-wide text-body">
            <tr>
              <th className="px-4 py-3">Student</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Started</th>
              <th className="px-4 py-3">Submitted</th>
              <th className="px-4 py-3 text-right">Raw points</th>
              <th className="px-4 py-3 text-right">Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stroke">
            {submissions.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-sm text-body"
                >
                  No attempts yet.
                </td>
              </tr>
            ) : (
              submissions.map((s) => {
                const user = userById.get(String(s.studentId));
                return (
                  <tr key={String(s._id)} className="hover:bg-whiter">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-foreground">
                        {user?.name ?? "Unknown"}
                      </div>
                      <div className="font-mono text-[11px] text-body">
                        {user?.studentId}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      {s.status === "submitted" ? (
                        <span className="inline-flex rounded-full bg-meta-3/10 px-2 py-0.5 text-[11px] font-medium text-meta-3">
                          Submitted
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-secondary/20 px-2 py-0.5 text-[11px] font-medium text-foreground">
                          In progress
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-body">
                      {formatDateTime(s.startedAt)}
                    </td>
                    <td className="px-4 py-2.5 text-body">
                      {s.submittedAt ? formatDateTime(s.submittedAt) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium text-foreground">
                      {s.status === "submitted"
                        ? `${s.score} / ${s.maxScore}`
                        : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-foreground">
                      {s.status === "submitted" ? formatPercent(s.percentage) : "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>

      <p className="mt-4 text-xs text-body">
        Submitted percentages auto-fill the test column on the grade sheet as
        drafts — you can still adjust them manually before submitting grades.
      </p>
      <Link
        href={`/lecturer/modules/${id}/tests`}
        className="mt-4 inline-block text-sm font-medium text-body hover:text-foreground"
      >
        ← All tests
      </Link>
    </div>
  );
}
