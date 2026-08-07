import { connectDB } from "@/lib/db";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { GradingRule } from "@/models/GradingRule";
import { Course } from "@/models/Course";
import { Grade } from "@/models/Grade";
import { requireActiveStudentAccess } from "@/lib/student-scope";
import { PageHeader } from "@/components/ui/PageHeader";
import { GradeCalculator, type ModuleCalcData } from "./grade-calculator";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

export default async function GradeCalculatorPage() {
  const me = await requireActiveStudentAccess();
  await connectDB();

  const meOid = new mongoose.Types.ObjectId(me.userId);

  const [current, defaultRule] = await Promise.all([
    AcademicPeriod.findOne({ isCurrent: true }).lean(),
    GradingRule.findOne({ courseId: null }).lean(),
  ]);

  if (!current || !defaultRule) {
    return (
      <div>
        <PageHeader
          title="Grade calculator"
          description="See what you need to pass, or project your final grade."
        />
        <div className="rounded-2xl border border-stroke bg-white p-6 text-sm text-body shadow-sm">
          {!current
            ? "No current academic period set. Ask your administrator."
            : "No grading rule configured. Ask your administrator."}
        </div>
      </div>
    );
  }

  const [modules, grades] = await Promise.all([
    Course.find({
      enrolledStudents: meOid,
      academicYear: current.year,
      semester: current.semester,
    })
      .select("code name gradingRuleId yearLevel")
      .lean(),
    Grade.find({
      studentId: meOid,
      academicYear: current.year,
      semester: current.semester,
    })
      .select("courseId testScore testMaxScore")
      .lean(),
  ]);

  const gradeByModule = new Map(
    grades.map((g) => [String(g.courseId), g]),
  );

  const moduleOverrideIds = modules
    .filter((m) => m.gradingRuleId)
    .map((m) => m.gradingRuleId!);

  const overrideRules =
    moduleOverrideIds.length > 0
      ? await GradingRule.find({ _id: { $in: moduleOverrideIds } }).lean()
      : [];

  const ruleById = new Map(overrideRules.map((r) => [String(r._id), r]));

  const calcModules: ModuleCalcData[] = modules.map((m) => {
    const rule = m.gradingRuleId
      ? (ruleById.get(String(m.gradingRuleId)) ?? defaultRule)
      : defaultRule;
    const g = gradeByModule.get(String(m._id));
    return {
      id: String(m._id),
      code: m.code,
      name: m.name,
      caWeight: rule.caWeight,
      examWeight: rule.examWeight,
      caMaxScore: 100,
      examMaxScore: 100,
      existingTestScore: g?.testScore ?? null,
      existingTestMaxScore: g?.testMaxScore ?? null,
      gradeScale: rule.gradeScale,
    };
  });

  return (
    <div>
      <PageHeader
        title="Grade calculator"
        description={`${current.year} · ${current.semester} semester — see what you need to pass, or project your final grade.`}
      />
      <div className="mx-auto max-w-xl rounded-2xl border border-stroke bg-white p-6 shadow-sm">
        <GradeCalculator modules={calcModules} />
      </div>
    </div>
  );
}
