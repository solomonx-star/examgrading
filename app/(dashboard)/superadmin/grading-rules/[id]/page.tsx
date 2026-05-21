import mongoose from "mongoose";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { GradingRule } from "@/models/GradingRule";
import { PageHeader } from "@/components/ui/PageHeader";
import { GradingRuleForm } from "./grading-rule-form";

export const dynamic = "force-dynamic";

export default async function EditGradingRulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (session?.user?.role !== "superadmin") redirect("/");

  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) notFound();

  await connectDB();
  const rule = await GradingRule.findById(id).lean();
  if (!rule) notFound();

  return (
    <div>
      <PageHeader
        title={rule.name}
        description={
          rule.courseId
            ? "Course-specific grading rule"
            : "Global grading rule"
        }
      />
      <GradingRuleForm
        id={String(rule._id)}
        defaults={{
          name: rule.name,
          caWeight: rule.caWeight,
          examWeight: rule.examWeight,
          attendanceThreshold: rule.attendanceThreshold,
          gradeScale: rule.gradeScale.map((b) => ({
            min: b.min,
            max: b.max,
            grade: b.grade,
            gpa: b.gpa,
            remark: b.remark,
          })),
        }}
      />
    </div>
  );
}
