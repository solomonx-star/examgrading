// Server-only: imports Mongoose. Do not import from client components —
// the bundler will fail with "Module not found: 'tls'" if you try.
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Course } from "@/models/Course";
import { GradingRule, type IGradeBand } from "@/models/GradingRule";

/**
 * Returns the grading rule attached to the course, or the global default
 * (courseId === null) if the course has no override. Returns null if neither
 * exists.
 *
 * Server-only — touches Mongo via Mongoose. Do not import from client code.
 */
export async function getEffectiveGradingRule(
  courseId: string,
): Promise<{
  _id: string;
  name: string;
  caWeight: number;
  examWeight: number;
  attendanceThreshold: number;
  gradeScale: IGradeBand[];
} | null> {
  if (!mongoose.Types.ObjectId.isValid(courseId)) return null;
  await connectDB();
  const mod = await Course.findById(courseId).select("gradingRuleId").lean();
  let ruleDoc = null;
  if (mod?.gradingRuleId) {
    ruleDoc = await GradingRule.findById(mod.gradingRuleId).lean();
  }
  if (!ruleDoc) {
    ruleDoc = await GradingRule.findOne({ courseId: null }).lean();
  }
  if (!ruleDoc) return null;
  return {
    _id: String(ruleDoc._id),
    name: ruleDoc.name,
    caWeight: ruleDoc.caWeight,
    examWeight: ruleDoc.examWeight,
    attendanceThreshold: ruleDoc.attendanceThreshold,
    gradeScale: ruleDoc.gradeScale,
  };
}
