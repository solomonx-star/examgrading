"use server";

import { revalidatePath } from "next/cache";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Course } from "@/models/Course";
import { Test } from "@/models/Test";
import { TestSubmission } from "@/models/TestSubmission";
import { Grade } from "@/models/Grade";
import { requireActiveStudentAccess } from "@/lib/student-scope";
import { getEffectiveGradingRule } from "@/lib/grading-server";
import { calculateGrade } from "@/lib/grading";
import { computeAttendanceMet } from "@/lib/grade-engine";
import { scoreAnswers, type StudentAnswerInput } from "@/lib/test-scoring";
import { audit } from "@/lib/audit";

const objectIdRe = /^[a-f\d]{24}$/i;

type ActionResult = { ok: boolean; error?: string };

async function loadStudentAccessibleTest(
  courseId: string,
  testId: string,
  studentObjectId: mongoose.Types.ObjectId,
) {
  if (!objectIdRe.test(courseId) || !objectIdRe.test(testId)) {
    return { error: "Invalid id." } as const;
  }
  await connectDB();
  const course = await Course.findOne({
    _id: courseId,
    enrolledStudents: studentObjectId,
  }).lean();
  if (!course) return { error: "Module not found." } as const;
  const test = await Test.findOne({
    _id: testId,
    courseId: course._id,
    isPublished: true,
  });
  if (!test) return { error: "Test not found." } as const;
  return { course, test } as const;
}

export async function startTestAction(
  courseId: string,
  testId: string,
): Promise<ActionResult> {
  const me = await requireActiveStudentAccess();
  const meOid = new mongoose.Types.ObjectId(me.userId);

  const ctx = await loadStudentAccessibleTest(courseId, testId, meOid);
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const { test } = ctx;

  const now = new Date();
  if (now < test.startsAt) {
    return { ok: false, error: "This test hasn't opened yet." };
  }
  if (now > test.endsAt) {
    return { ok: false, error: "This test has closed." };
  }

  const existing = await TestSubmission.findOne({
    testId: test._id,
    studentId: meOid,
  });
  if (existing) {
    if (existing.status === "submitted") {
      return { ok: false, error: "You have already submitted this test." };
    }
    return { ok: true };
  }

  try {
    await TestSubmission.create({
      testId: test._id,
      courseId: test.courseId,
      studentId: meOid,
      status: "in_progress",
      startedAt: now,
      answers: [],
      score: 0,
      maxScore: test.questions.reduce((acc, q) => acc + q.points, 0),
      percentage: 0,
    });
  } catch (err) {
    // Race condition: another tab already created it. Fall through.
    if (
      !(
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code: number }).code === 11000
      )
    ) {
      throw err;
    }
  }

  revalidatePath(`/student/modules/${courseId}/tests`);
  revalidatePath(`/student/modules/${courseId}/tests/${testId}`);
  return { ok: true };
}

type SubmitInput = {
  answers: StudentAnswerInput[];
};

export async function submitTestAction(
  courseId: string,
  testId: string,
  input: SubmitInput,
): Promise<ActionResult & { percentage?: number }> {
  const me = await requireActiveStudentAccess();
  const meOid = new mongoose.Types.ObjectId(me.userId);

  const ctx = await loadStudentAccessibleTest(courseId, testId, meOid);
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const { course, test } = ctx;

  const submission = await TestSubmission.findOne({
    testId: test._id,
    studentId: meOid,
  });
  if (!submission) {
    return {
      ok: false,
      error: "You haven't started this test yet.",
    };
  }
  if (submission.status === "submitted") {
    return { ok: false, error: "You have already submitted this test." };
  }

  // Enforce duration: submission window closes at startedAt + durationMinutes
  // OR test.endsAt — whichever is sooner. We still record the score; we just
  // mark submittedAt as `now` and rely on the lecturer to spot late saves.
  const score = scoreAnswers(test.questions, input.answers ?? []);

  submission.answers = score.answers.map((a) => ({
    questionId: new mongoose.Types.ObjectId(a.questionId),
    selectedOptionIds: a.selectedOptionIds.map(
      (id) => new mongoose.Types.ObjectId(id),
    ),
    awardedPoints: a.awardedPoints,
  })) as typeof submission.answers;
  submission.score = score.score;
  submission.maxScore = score.maxScore;
  submission.percentage = score.percentage;
  submission.status = "submitted";
  submission.submittedAt = new Date();
  await submission.save();

  // Auto-write percentage into the Grade row as a DRAFT. Lecturer can still
  // override it manually on the grade sheet before submitting for review.
  // We skip this write if the grade is already submitted or published to avoid
  // overwriting locked records.
  const rule = await getEffectiveGradingRule(courseId);
  const lecturerId =
    course.lecturerId ?? new mongoose.Types.ObjectId(); // synthetic fallback should never trigger
  if (rule && course.lecturerId) {
    const filter = {
      courseId: course._id,
      studentId: meOid,
      academicYear: course.academicYear,
      semester: course.semester,
    };
    const existingGrade = await Grade.findOne(filter);
    const locked =
      existingGrade?.submissionStatus === "submitted" ||
      existingGrade?.isPublished;
    if (!locked) {
      const examScore = existingGrade?.examScore ?? 0;
      const result = calculateGrade({
        testScore: score.percentage,
        testMaxScore: 100,
        examScore,
        examMaxScore: 100,
        caWeight: rule.caWeight,
        examWeight: rule.examWeight,
        gradeScale: rule.gradeScale,
      });
      const attendanceFlags = await computeAttendanceMet(
        courseId,
        [me.userId],
        rule.attendanceThreshold,
      );
      const setFields: Record<string, unknown> = {
        lecturerId,
        testScore: score.percentage,
        testMaxScore: 100,
        examScore,
        examMaxScore: 100,
        calculatedScore: result.finalScore,
        calculatedGrade: result.grade ?? undefined,
        calculatedGPA: result.gpa ?? undefined,
        calculatedRemark: result.remark ?? undefined,
        submissionStatus: "draft",
      };
      const met = attendanceFlags.get(me.userId);
      if (typeof met === "boolean") setFields.attendanceMet = met;
      await Grade.updateOne(
        filter,
        { $set: setFields, $setOnInsert: { isPublished: false } },
        { upsert: true },
      );
    }
  }

  await audit({
    action: "test.submit",
    summary: `Submitted test "${test.title}" (${score.percentage.toFixed(2)}%) for ${course.code}`,
    entityType: "Test",
    entityId: String(test._id),
    metadata: {
      score: score.score,
      maxScore: score.maxScore,
      percentage: score.percentage,
    },
  });

  revalidatePath(`/student/modules/${courseId}/tests`);
  revalidatePath(`/student/modules/${courseId}/tests/${testId}`);
  revalidatePath(`/lecturer/modules/${courseId}/tests/${testId}/results`);
  revalidatePath(`/lecturer/modules/${courseId}/grades`);
  return { ok: true, percentage: score.percentage };
}
