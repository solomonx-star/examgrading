import Link from "next/link";
import { connectDB } from "@/lib/db";
import { Test } from "@/models/Test";
import { TestSubmission } from "@/models/TestSubmission";
import { requireLecturerCourse } from "@/lib/lecturer-course";
import { PageHeader } from "@/components/ui/PageHeader";

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

function windowStatus(now: Date, startsAt: Date, endsAt: Date): {
  label: string;
  tone: "scheduled" | "live" | "closed";
} {
  if (now < startsAt) return { label: "Scheduled", tone: "scheduled" };
  if (now > endsAt) return { label: "Closed", tone: "closed" };
  return { label: "Live", tone: "live" };
}

export default async function LecturerTestsListPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { course: mod } = await requireLecturerCourse(id);

  await connectDB();
  const tests = await Test.find({ courseId: mod._id })
    .sort({ startsAt: -1, createdAt: -1 })
    .lean();

  const testIds = tests.map((t) => t._id);
  const submissionCounts = testIds.length
    ? await TestSubmission.aggregate<{ _id: unknown; count: number }>([
        {
          $match: {
            testId: { $in: testIds },
            status: "submitted",
          },
        },
        { $group: { _id: "$testId", count: { $sum: 1 } } },
      ])
    : [];
  const countByTest = new Map(
    submissionCounts.map((s) => [String(s._id), s.count]),
  );
  const now = new Date();

  return (
    <div>
      <PageHeader
        title="Tests"
        description={`${mod.code} — ${mod.name} · ${mod.academicYear} · ${mod.semester}`}
        action={{
          href: `/lecturer/modules/${id}/tests/new`,
          label: "Create test",
        }}
        secondaryAction={{
          href: `/lecturer/modules/${id}`,
          label: "← Module",
        }}
      />

      {tests.length === 0 ? (
        <div className="rounded-2xl border border-stroke bg-white p-10 text-center text-sm text-body shadow-sm">
          No tests yet. Create one to give your students an objective test for
          this module — results auto-fill the test column on the grade sheet.
        </div>
      ) : (
        <section className="overflow-x-auto rounded-2xl border border-stroke bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-whiter text-left text-xs uppercase tracking-wide text-body">
              <tr>
                <th className="px-4 py-3">Test</th>
                <th className="px-4 py-3">Window</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3">Questions</th>
                <th className="px-4 py-3">Submissions</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stroke">
              {tests.map((t) => {
                const status = windowStatus(now, t.startsAt, t.endsAt);
                const submissions = countByTest.get(String(t._id)) ?? 0;
                const tone =
                  status.tone === "live"
                    ? "bg-meta-3/10 text-meta-3"
                    : status.tone === "scheduled"
                      ? "bg-secondary/20 text-foreground"
                      : "bg-whiter text-body";
                return (
                  <tr key={String(t._id)} className="hover:bg-whiter">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">
                        {t.title}
                      </div>
                      {t.description ? (
                        <div className="text-xs text-body">
                          {t.description}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-body">
                      <div>{formatDateTime(t.startsAt)}</div>
                      <div className="text-xs">
                        → {formatDateTime(t.endsAt)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-body">
                      {t.durationMinutes} min
                    </td>
                    <td className="px-4 py-3 text-body">
                      {t.questions.length}
                    </td>
                    <td className="px-4 py-3 text-body">{submissions}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${tone}`}
                      >
                        {t.isPublished ? status.label : "Draft"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      <Link
                        href={`/lecturer/modules/${id}/tests/${t._id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        Edit
                      </Link>
                      <span className="px-2 text-body">·</span>
                      <Link
                        href={`/lecturer/modules/${id}/tests/${t._id}/results`}
                        className="font-medium text-primary hover:underline"
                      >
                        Results
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
