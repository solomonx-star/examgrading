import Link from "next/link";
import mongoose from "mongoose";
import { notFound } from "next/navigation";
import { connectDB } from "@/lib/db";
import { Course } from "@/models/Course";
import { Test } from "@/models/Test";
import { TestSubmission } from "@/models/TestSubmission";
import { requireActiveStudentAccess } from "@/lib/student-scope";
import { PageHeader } from "@/components/ui/PageHeader";
import { AutoRefresh } from "@/components/ui/AutoRefresh";
import { TestStartCountdown } from "@/components/dashboard/TestStartCountdown";
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

export default async function StudentTestsListPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requireActiveStudentAccess();
  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) notFound();

  await connectDB();
  const meOid = new mongoose.Types.ObjectId(me.userId);
  const mod = await Course.findOne({
    _id: id,
    enrolledStudents: meOid,
  }).lean();
  if (!mod) notFound();

  const [tests, submissions] = await Promise.all([
    Test.find({ courseId: mod._id, isPublished: true })
      .sort({ startsAt: 1 })
      .lean(),
    TestSubmission.find({ courseId: mod._id, studentId: meOid }).lean(),
  ]);

  const submissionByTest = new Map(
    submissions.map((s) => [String(s.testId), s]),
  );
  const now = new Date();

  return (
    <div>
      <AutoRefresh intervalMs={30_000} />
      <PageHeader
        title="Tests"
        description={`${mod.code} — ${mod.name}`}
        secondaryAction={{
          href: `/student/modules/${id}`,
          label: "← Module",
        }}
      />

      {tests.length === 0 ? (
        <div className="rounded-2xl border border-stroke bg-white p-10 text-center text-sm text-body shadow-sm">
          No tests have been published for this module yet.
        </div>
      ) : (
        <div className="space-y-4">
          {tests.map((t) => {
            const sub = submissionByTest.get(String(t._id));
            const closed = now > t.endsAt;
            const notYet = now < t.startsAt;
            const inWindow = !closed && !notYet;

            let state:
              | "submitted"
              | "in_progress"
              | "available"
              | "missed"
              | "scheduled";
            if (sub?.status === "submitted") state = "submitted";
            else if (sub?.status === "in_progress" && inWindow)
              state = "in_progress";
            else if (closed && !sub) state = "missed";
            else if (notYet) state = "scheduled";
            else state = "available";

            return (
              <article
                key={String(t._id)}
                className="rounded-2xl border border-stroke bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">
                      {t.title}
                    </h2>
                    {t.description ? (
                      <p className="mt-1 text-sm text-body">{t.description}</p>
                    ) : null}
                    <p className="mt-2 text-xs text-body">
                      Opens {formatDateTime(t.startsAt)} · closes{" "}
                      {formatDateTime(t.endsAt)} · {t.durationMinutes} min limit
                      · {t.questions.length} question
                      {t.questions.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="text-right">
                    {state === "submitted" ? (
                      <>
                        <span className="inline-flex rounded-full bg-meta-3/10 px-2.5 py-0.5 text-xs font-medium text-meta-3">
                          Submitted
                        </span>
                        <p className="mt-2 text-sm font-semibold text-foreground">
                          {sub ? formatPercent(sub.percentage) : "—"}
                        </p>
                        <p className="text-[11px] text-body">
                          Raw {sub?.score} / {sub?.maxScore} pts
                        </p>
                      </>
                    ) : state === "in_progress" ? (
                      <span className="inline-flex rounded-full bg-secondary/20 px-2.5 py-0.5 text-xs font-medium text-foreground">
                        In progress
                      </span>
                    ) : state === "missed" ? (
                      <span className="inline-flex rounded-full bg-meta-1/10 px-2.5 py-0.5 text-xs font-medium text-meta-1">
                        Closed — not taken
                      </span>
                    ) : state === "scheduled" ? (
                      <TestStartCountdown
                        startsAtIso={new Date(t.startsAt).toISOString()}
                        variant="inline"
                      />
                    ) : (
                      <span className="inline-flex rounded-full bg-meta-3/10 px-2.5 py-0.5 text-xs font-medium text-meta-3">
                        Available now
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-end">
                  {state === "available" || state === "in_progress" ? (
                    <Link
                      href={`/student/modules/${id}/tests/${t._id}`}
                      className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-dark"
                    >
                      {state === "in_progress" ? "Resume test" : "Start test"}
                    </Link>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
