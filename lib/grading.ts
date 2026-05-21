import type { IGradeBand } from "@/models/GradingRule";

export type GradeResult = {
  finalScore: number;
  grade: string | null;
  gpa: number | null;
  remark: string | null;
};

/**
 * IAM CO grade calculator. Pure — no DB, no Node-only deps; safe to import
 * from client. Score is `(testScore/testMaxScore) * caWeight +
 * (examScore/examMaxScore) * examWeight`, rounded to 2dp.
 */
export function calculateGrade(args: {
  testScore: number;
  testMaxScore: number;
  examScore: number;
  examMaxScore: number;
  caWeight: number;
  examWeight: number;
  gradeScale: IGradeBand[];
}): GradeResult {
  const {
    testScore,
    testMaxScore,
    examScore,
    examMaxScore,
    caWeight,
    examWeight,
  } = args;

  const testRatio = testMaxScore > 0 ? testScore / testMaxScore : 0;
  const examRatio = examMaxScore > 0 ? examScore / examMaxScore : 0;
  const finalScore =
    Math.round(((testRatio * caWeight + examRatio * examWeight) + Number.EPSILON) * 100) /
    100;

  const band = applyGradeScale(finalScore, args.gradeScale);
  return {
    finalScore,
    grade: band?.grade ?? null,
    gpa: band?.gpa ?? null,
    remark: band?.remark ?? null,
  };
}

export function applyGradeScale(
  finalScore: number,
  scale: IGradeBand[],
): IGradeBand | null {
  for (const band of scale) {
    if (finalScore >= band.min && finalScore <= band.max) {
      return band;
    }
  }
  return null;
}
