import mongoose from "mongoose";
import { notFound } from "next/navigation";
import { connectDB } from "@/lib/db";
import { Course } from "@/models/Course";
import { Programme } from "@/models/Programme";
import { User } from "@/models/User";
import { GradingRule } from "@/models/GradingRule";
import { requireAdminScope } from "@/lib/admin-scope";
import { PageHeader } from "@/components/ui/PageHeader";
import { CourseForm } from "../module-form";

export const dynamic = "force-dynamic";

export default async function EditCoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminScope();
  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) notFound();

  await connectDB();
  const mod = await Course.findById(id).lean();
  if (!mod) notFound();

  const [programmes, lecturers, students, rules] = await Promise.all([
    Programme.find({ isActive: true })
      .select("name code")
      .sort({ name: 1 })
      .lean(),
    User.find({ role: "lecturer", isActive: true })
      .select("name email")
      .sort({ name: 1 })
      .lean(),
    User.find({ role: "student" })
      .select("name studentId programmeId yearLevel isActive")
      .sort({ name: 1 })
      .lean(),
    GradingRule.find().select("name courseId").sort({ name: 1 }).lean(),
  ]);

  const programmeName = new Map(
    programmes.map((p) => [String(p._id), p.name as string]),
  );
  const modProgrammeIds = mod.programmeIds ?? [];
  const programmesLabel =
    modProgrammeIds
      .map((pid) => programmeName.get(String(pid)) ?? null)
      .filter((n): n is string => !!n)
      .join(", ") || "No programmes";

  return (
    <div>
      <PageHeader
        title={`${mod.code} — ${mod.name}`}
        description={`${programmesLabel} · Year ${mod.yearLevel} · ${mod.academicYear} · ${mod.semester}`}
      />
      <CourseForm
        mode="edit"
        courseId={String(mod._id)}
        defaults={{
          name: mod.name,
          code: mod.code,
          programmeIds: modProgrammeIds.map((pid) => String(pid)),
          yearLevel: mod.yearLevel,
          academicYear: mod.academicYear,
          semester: mod.semester,
          lecturerId: mod.lecturerId ? String(mod.lecturerId) : "",
          gradingRuleId: mod.gradingRuleId ? String(mod.gradingRuleId) : "",
          enrolledStudents: mod.enrolledStudents.map((s) => String(s)),
          isActive: mod.isActive,
        }}
        choices={{
          programmes: programmes.map((p) => ({
            id: String(p._id),
            name: p.name as string,
            code: p.code as string,
          })),
          lecturers: lecturers.map((l) => ({
            id: String(l._id),
            name: l.name as string,
            email: l.email as string,
          })),
          students: students
            .filter((s) => s.programmeId && s.yearLevel)
            .map((s) => ({
              id: String(s._id),
              name: s.name as string,
              studentId: s.studentId ?? "",
              programmeId: String(s.programmeId),
              yearLevel: s.yearLevel as number,
              inactive: !s.isActive,
            })),
          rules: rules.map((r) => ({
            id: String(r._id),
            name: r.name as string,
            global: !r.courseId,
          })),
        }}
      />
    </div>
  );
}
