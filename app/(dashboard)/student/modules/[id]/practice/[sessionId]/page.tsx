import mongoose from "mongoose";
import { notFound } from "next/navigation";
import { connectDB } from "@/lib/db";
import { Course } from "@/models/Course";
import { PracticeSession } from "@/models/PracticeSession";
import { requireActiveStudentAccess } from "@/lib/student-scope";
import { PageHeader } from "@/components/ui/PageHeader";
import { TakePractice } from "./take-practice";

export const dynamic = "force-dynamic";

export default async function PracticeSessionPage({
  params,
}: {
  params: Promise<{ id: string; sessionId: string }>;
}) {
  const me = await requireActiveStudentAccess();
  const { id, sessionId } = await params;
  if (
    !mongoose.Types.ObjectId.isValid(id) ||
    !mongoose.Types.ObjectId.isValid(sessionId)
  )
    notFound();

  await connectDB();
  const meOid = new mongoose.Types.ObjectId(me.userId);

  const [mod, session] = await Promise.all([
    Course.findOne({ _id: id, enrolledStudents: meOid })
      .select("_id code name")
      .lean(),
    PracticeSession.findOne({
      _id: sessionId,
      studentId: meOid,
      courseId: id,
    }).lean(),
  ]);

  if (!mod || !session) notFound();

  const questions = session.questions.map((q) => ({
    id: q.id,
    prompt: q.prompt,
    options: q.options,
    // Only expose correct answer if already submitted
    correctId: session.submittedAt ? q.correctId : null,
    explanation: session.submittedAt ? q.explanation : null,
  }));

  const submittedAnswers = session.submittedAt
    ? Object.fromEntries(session.answers as unknown as Map<string, string>)
    : null;

  return (
    <div>
      <PageHeader
        title="Practice test"
        description={`${mod.code} — ${mod.name} · ${session.difficulty.charAt(0).toUpperCase() + session.difficulty.slice(1)}`}
        secondaryAction={{
          href: `/student/modules/${id}`,
          label: "← Module",
        }}
      />

      <div className="mb-4 rounded-xl border border-secondary/30 bg-secondary/10 px-4 py-2.5 text-sm text-foreground">
        This is a <strong>practice test</strong> — results are not recorded in
        your grades.
      </div>

      <TakePractice
        sessionId={sessionId}
        questions={questions}
        alreadySubmitted={!!session.submittedAt}
        initialScore={session.score}
        maxScore={session.maxScore}
        submittedAnswers={submittedAnswers}
      />
    </div>
  );
}
