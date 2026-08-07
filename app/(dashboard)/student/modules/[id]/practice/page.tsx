import mongoose from "mongoose";
import { notFound } from "next/navigation";
import { connectDB } from "@/lib/db";
import { Course } from "@/models/Course";
import { requireActiveStudentAccess } from "@/lib/student-scope";
import { getBalance } from "@/lib/ai-credits-service";
import { PageHeader } from "@/components/ui/PageHeader";
import { PracticeForm } from "./practice-form";

export const dynamic = "force-dynamic";

export default async function PracticeSetupPage({
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

  const balance = await getBalance(me.userId);

  return (
    <div>
      <PageHeader
        title="Generate practice test"
        description={`${mod.code} — ${mod.name}`}
        secondaryAction={{
          href: `/student/modules/${id}`,
          label: "← Module",
        }}
      />

      <div className="mb-6 rounded-2xl border border-stroke bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-sm text-body">Your AI credit balance</p>
          <p className="text-lg font-bold text-foreground">
            {balance} credit{balance === 1 ? "" : "s"}
          </p>
        </div>
        <p className="mt-1 text-xs text-body">
          Generating a practice test costs <strong>3 credits</strong>.
        </p>
      </div>

      <PracticeForm courseId={String(mod._id)} balance={balance} />
    </div>
  );
}
