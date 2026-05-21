import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { Programme } from "@/models/Programme";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { GradingRule } from "@/models/GradingRule";
import { requireAdminScope } from "@/lib/admin-scope";
import { PageHeader } from "@/components/ui/PageHeader";
import { CourseForm } from "../module-form";

export const dynamic = "force-dynamic";

export default async function NewCoursePage() {
  const me = await requireAdminScope();
  await connectDB();

  const [programmes, lecturers, students, rules, current] = await Promise.all([
    Programme.find({ department: me.department, isActive: true })
      .select("name code")
      .sort({ name: 1 })
      .lean(),
    User.find({ role: "lecturer", department: me.department, isActive: true })
      .select("name email")
      .sort({ name: 1 })
      .lean(),
    User.find({ role: "student", department: me.department, isActive: true })
      .select("name studentId programmeId yearLevel")
      .sort({ name: 1 })
      .lean(),
    GradingRule.find().select("name courseId").sort({ name: 1 }).lean(),
    AcademicPeriod.findOne({ isCurrent: true }).lean(),
  ]);

  const globalRule = rules.find((r) => !r.courseId);
  const defaultProgrammeId =
    programmes.length === 1 ? String(programmes[0]._id) : "";

  return (
    <div>
      <PageHeader
        title="New module"
        description={`Department: ${me.department}. Pick a programme + year — the enrolment list filters to the matching cohort.`}
      />
      <CourseForm
        mode="create"
        defaults={{
          name: "",
          code: "",
          programmeId: defaultProgrammeId,
          yearLevel: 1,
          academicYear: current?.year ?? "",
          semester: (current?.semester as "First" | "Second" | "Summer") ?? "First",
          lecturerId: "",
          gradingRuleId: globalRule ? String(globalRule._id) : "",
          enrolledStudents: [],
          isActive: true,
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
            .filter((s) => s.programmeId && s.yearLevel) // only enrolled students
            .map((s) => ({
              id: String(s._id),
              name: s.name as string,
              studentId: s.studentId ?? "",
              programmeId: String(s.programmeId),
              yearLevel: s.yearLevel as number,
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
