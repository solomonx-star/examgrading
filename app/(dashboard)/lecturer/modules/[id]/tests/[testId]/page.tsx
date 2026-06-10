import mongoose from "mongoose";
import { notFound } from "next/navigation";
import { connectDB } from "@/lib/db";
import { Test } from "@/models/Test";
import { TestSubmission } from "@/models/TestSubmission";
import { requireLecturerCourse } from "@/lib/lecturer-course";
import { PageHeader } from "@/components/ui/PageHeader";
import { TestEditor } from "./test-editor";

export const dynamic = "force-dynamic";

export default async function LecturerTestEditPage({
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

  const anySubmissions = !!(await TestSubmission.exists({ testId: test._id }));

  function toLocalInput(d: Date): string {
    const offset = new Date(d).getTimezoneOffset();
    const local = new Date(new Date(d).getTime() - offset * 60_000);
    return local.toISOString().slice(0, 16);
  }

  return (
    <div>
      <PageHeader
        title={test.title}
        description={`${mod.code} — ${mod.name} · ${test.isPublished ? "Published" : "Draft"}`}
        secondaryAction={{
          href: `/lecturer/modules/${id}/tests`,
          label: "← Back to tests",
        }}
        action={{
          href: `/lecturer/modules/${id}/tests/${testId}/results`,
          label: "View results",
        }}
      />
      <TestEditor
        courseId={id}
        testId={String(test._id)}
        isPublished={test.isPublished}
        anySubmissions={anySubmissions}
        initial={{
          title: test.title,
          description: test.description ?? "",
          startsAt: toLocalInput(test.startsAt),
          endsAt: toLocalInput(test.endsAt),
          durationMinutes: test.durationMinutes,
          questions: test.questions.map((q) => ({
            id: String(q._id),
            type: q.type,
            prompt: q.prompt,
            points: q.points,
            options: q.options.map((o) => ({
              id: String(o._id),
              text: o.text,
              isCorrect: o.isCorrect,
            })),
          })),
        }}
      />
    </div>
  );
}
