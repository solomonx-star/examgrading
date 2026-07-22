import Link from "next/link";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Course } from "@/models/Course";
import { Test } from "@/models/Test";
import { TestSubmission } from "@/models/TestSubmission";
import { requireActiveStudentAccess } from "@/lib/student-scope";
import { PageHeader } from "@/components/ui/PageHeader";
import { AutoRefresh } from "@/components/ui/AutoRefresh";
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

export default async function StudentTestsOverviewPage() {
  const me = await requireActiveStudentAccess();
  await connectDB();

  const meOid = new mongoose.Types.ObjectId(me.userId);

  const modules = await Course.find({ enrolledStudents: meOid, isActive: true })
    .select("_id code name")
    .lean();

  const moduleIds = modules.map((m) => m._id);
  const moduleById = new Map(
    modules.map((m) => ({ id: String(m._id), code: m.code as string, name: m.name as string }))
      .map((m) => [m.id, m]),
  );

  const [tests, submissions] = await Promise.all([
    Test.find({ courseId: { $in: moduleIds }, isPublished: true })
      .sort({ endsAt: -1 })
      .lean(),
    TestSubmission.find({ courseId: { $in: moduleIds }, studentId: meOid }).lean(),
  ]);

  const submissionByTest = new Map(submissions.map((s) => [String(s.testId), s]));

  const now = new Date();
  const upcoming = tests.filter((t) => t.endsAt > now);
  const previous = tests.filter((t) => t.endsAt <= now);

  // Sort upcoming: soonest first
  upcoming.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  // Sort previous: most recent first
  previous.sort((a, b) => b.endsAt.getTime() - a.endsAt.getTime());

  function TestCard({ t, section }: { t: (typeof tests)[0]; section: "upcoming" | "previous" }) {
    const mod = moduleById.get(String(t.courseId));
    const sub = submissionByTest.get(String(t._id));
    const closed = now > t.endsAt;
    const notYet = now < t.startsAt;
    const inWindow = !closed && !notYet;

    let state: "submitted" | "in_progress" | "available" | "missed" | "scheduled";
    if (sub?.status === "submitted") state = "submitted";
    else if (sub?.status === "in_progress" && inWindow) state = "in_progress";
    else if (closed && !sub) state = "missed";
    else if (notYet) state = "scheduled";
    else state = "available";

    const testHref = `/student/modules/${String(t.courseId)}/tests/${String(t._id)}`;

    return (
      <article className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-stroke bg-white p-5 shadow-sm">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-body">{mod?.code}</span>
            <span className="text-xs text-body">·</span>
            <span className="text-xs text-body">{mod?.name}</span>
          </div>
          <h3 className="mt-1 text-base font-semibold text-foreground">{t.title}</h3>
          {t.description ? (
            <p className="mt-0.5 text-sm text-body">{t.description}</p>
          ) : null}
          <p className="mt-2 text-xs text-body">
            {section === "upcoming" ? (
              <>Opens {formatDateTime(t.startsAt)} · closes {formatDateTime(t.endsAt)}</>
            ) : (
              <>Closed {formatDateTime(t.endsAt)}</>
            )}{" "}
            · {t.durationMinutes} min · {t.questions.length} question
            {t.questions.length === 1 ? "" : "s"}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          {state === "submitted" ? (
            <>
              <span className="inline-flex rounded-full bg-meta-3/10 px-2.5 py-0.5 text-xs font-medium text-meta-3">
                Submitted
              </span>
              <p className="text-sm font-semibold text-foreground">
                {sub ? formatPercent(sub.percentage) : "—"}
              </p>
              <p className="text-[11px] text-body">
                Raw {sub?.score} / {sub?.maxScore} pts
              </p>
            </>
          ) : state === "in_progress" ? (
            <>
              <span className="inline-flex rounded-full bg-secondary/20 px-2.5 py-0.5 text-xs font-medium text-foreground">
                In progress
              </span>
              <Link
                href={testHref}
                className="inline-flex items-center rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-primary-dark"
              >
                Resume →
              </Link>
            </>
          ) : state === "available" ? (
            <>
              <span className="inline-flex rounded-full bg-meta-3/10 px-2.5 py-0.5 text-xs font-medium text-meta-3">
                Available now
              </span>
              <Link
                href={testHref}
                className="inline-flex items-center rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-primary-dark"
              >
                Start test →
              </Link>
            </>
          ) : state === "scheduled" ? (
            <span className="inline-flex rounded-full bg-secondary/20 px-2.5 py-0.5 text-xs font-medium text-foreground">
              Scheduled
            </span>
          ) : (
            <span className="inline-flex rounded-full bg-meta-1/10 px-2.5 py-0.5 text-xs font-medium text-meta-1">
              Closed — not taken
            </span>
          )}
        </div>
      </article>
    );
  }

  return (
    <div>
      <AutoRefresh intervalMs={30_000} />
      <PageHeader
        title="Tests"
        description="All upcoming and past tests across your enrolled modules."
      />

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-body">
          Upcoming
        </h2>
        {upcoming.length === 0 ? (
          <div className="rounded-2xl border border-stroke bg-white p-8 text-center text-sm text-body shadow-sm">
            No upcoming tests at the moment.
          </div>
        ) : (
          <div className="space-y-4">
            {upcoming.map((t) => (
              <TestCard key={String(t._id)} t={t} section="upcoming" />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-body">
          Previous
        </h2>
        {previous.length === 0 ? (
          <div className="rounded-2xl border border-stroke bg-white p-8 text-center text-sm text-body shadow-sm">
            No previous tests yet.
          </div>
        ) : (
          <div className="space-y-4">
            {previous.map((t) => (
              <TestCard key={String(t._id)} t={t} section="previous" />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
