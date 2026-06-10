import Link from "next/link";
import mongoose from "mongoose";
import { notFound } from "next/navigation";
import { connectDB } from "@/lib/db";
import { Course } from "@/models/Course";
import { Test } from "@/models/Test";
import { TestSubmission } from "@/models/TestSubmission";
import { requireActiveStudentAccess } from "@/lib/student-scope";
import { PageHeader } from "@/components/ui/PageHeader";
import { TestStartCountdown } from "@/components/dashboard/TestStartCountdown";
import { formatPercent } from "@/lib/format";
import { TakeTest } from "./take-test";

export const dynamic = "force-dynamic";

export default async function StudentTakeTestPage({
  params,
}: {
  params: Promise<{ id: string; testId: string }>;
}) {
  const me = await requireActiveStudentAccess();
  const { id, testId } = await params;
  if (
    !mongoose.Types.ObjectId.isValid(id) ||
    !mongoose.Types.ObjectId.isValid(testId)
  )
    notFound();

  await connectDB();
  const meOid = new mongoose.Types.ObjectId(me.userId);
  const mod = await Course.findOne({
    _id: id,
    enrolledStudents: meOid,
  }).lean();
  if (!mod) notFound();

  const test = await Test.findOne({
    _id: testId,
    courseId: mod._id,
    isPublished: true,
  }).lean();
  if (!test) notFound();

  const submission = await TestSubmission.findOne({
    testId: test._id,
    studentId: meOid,
  }).lean();

  const now = new Date();
  const notYet = now < test.startsAt;
  const closed = now > test.endsAt;
  const alreadySubmitted = submission?.status === "submitted";

  if (alreadySubmitted) {
    return (
      <div>
        <PageHeader
          title={test.title}
          description={`${mod.code} — ${mod.name}`}
          secondaryAction={{
            href: `/student/modules/${id}/tests`,
            label: "← Back to tests",
          }}
        />
        <div className="rounded-2xl border border-meta-3/30 bg-meta-3/10 p-6 text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-meta-3">
            Submitted
          </p>
          <p className="mt-2 text-3xl font-bold text-foreground">
            {formatPercent(submission!.percentage)}
          </p>
          <p className="mt-1 text-sm text-body">
            Raw: {submission!.score} / {submission!.maxScore} point
            {submission!.maxScore === 1 ? "" : "s"}
          </p>
          <p className="mt-3 text-xs text-body">
            Your score has been recorded. It will appear on your grade once your
            lecturer submits and the exams office publishes the module&apos;s
            final grades.
          </p>
        </div>
      </div>
    );
  }

  if (notYet) {
    return (
      <div>
        <PageHeader
          title={test.title}
          description={`${mod.code} — ${mod.name}`}
          secondaryAction={{
            href: `/student/modules/${id}/tests`,
            label: "← Back to tests",
          }}
        />
        {test.description ? (
          <p className="mb-4 rounded-2xl border border-stroke bg-white p-4 text-sm text-body shadow-sm">
            {test.description}
          </p>
        ) : null}
        <TestStartCountdown startsAtIso={test.startsAt.toISOString()} />
      </div>
    );
  }

  if (closed) {
    return (
      <div>
        <PageHeader
          title={test.title}
          description={`${mod.code} — ${mod.name}`}
          secondaryAction={{
            href: `/student/modules/${id}/tests`,
            label: "← Back to tests",
          }}
        />
        <div className="rounded-2xl border border-meta-1/30 bg-meta-1/10 p-6 text-center text-sm text-meta-1">
          This test closed on {new Date(test.endsAt).toLocaleString("en-GB")}.
        </div>
        <Link
          href={`/student/modules/${id}/tests`}
          className="mt-4 inline-block text-sm font-medium text-body hover:text-foreground"
        >
          ← All tests
        </Link>
      </div>
    );
  }

  // Compute deadline as min(startedAt + durationMinutes, endsAt). If the
  // student hasn't started yet, the deadline is computed on the fly when they
  // click start.
  const startedAt = submission?.startedAt ? new Date(submission.startedAt) : null;
  const personalDeadline = startedAt
    ? new Date(startedAt.getTime() + test.durationMinutes * 60_000)
    : null;
  const deadline = personalDeadline
    ? personalDeadline < test.endsAt
      ? personalDeadline
      : test.endsAt
    : test.endsAt;

  return (
    <div>
      <PageHeader
        title={test.title}
        description={`${mod.code} — ${mod.name} · ${test.durationMinutes} min limit`}
        secondaryAction={{
          href: `/student/modules/${id}/tests`,
          label: "← Back to tests",
        }}
      />
      {test.description ? (
        <p className="mb-4 rounded-2xl border border-stroke bg-white p-4 text-sm text-body shadow-sm">
          {test.description}
        </p>
      ) : null}
      <TakeTest
        courseId={id}
        testId={String(test._id)}
        started={!!submission}
        deadlineIso={deadline.toISOString()}
        endsAtIso={test.endsAt.toISOString()}
        durationMinutes={test.durationMinutes}
        questions={test.questions.map((q) => ({
          id: String(q._id),
          type: q.type,
          prompt: q.prompt,
          points: q.points,
          options: q.options.map((o) => ({
            id: String(o._id),
            text: o.text,
          })),
        }))}
      />
    </div>
  );
}
