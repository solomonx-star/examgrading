import mongoose from "mongoose";
import { notFound } from "next/navigation";
import { connectDB } from "@/lib/db";
import { Course } from "@/models/Course";
import { TutorSession } from "@/models/TutorSession";
import { requireActiveStudentAccess } from "@/lib/student-scope";
import { getBalance } from "@/lib/ai-credits-service";
import { PageHeader } from "@/components/ui/PageHeader";
import { TutorChat } from "./tutor-chat";

export const dynamic = "force-dynamic";

export default async function TutorPage({
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
  })
    .select("_id code name yearLevel")
    .lean();
  if (!mod) notFound();

  const [balance, tutorSession] = await Promise.all([
    getBalance(me.userId),
    TutorSession.findOne({ studentId: meOid, courseId: mod._id }).lean(),
  ]);

  const messages = (tutorSession?.messages ?? []).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  return (
    <div>
      <PageHeader
        title={`AI Tutor — ${mod.code}`}
        description={`${mod.name} · Ask questions, get explanations, deepen your understanding`}
        secondaryAction={{ href: `/student/modules/${id}`, label: "← Module" }}
      />

      <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground">
        Your AI tutor knows this module and helps you understand concepts — it does{" "}
        <strong>not</strong> have access to your grade or exam answers.
        Each message costs <strong>1 credit</strong>.
      </div>

      <TutorChat
        courseId={String(mod._id)}
        initialMessages={messages}
        initialBalance={balance}
      />
    </div>
  );
}
