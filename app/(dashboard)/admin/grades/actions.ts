"use server";

import { revalidatePath } from "next/cache";
import mongoose from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Grade } from "@/models/Grade";
import { User } from "@/models/User";
import { Module } from "@/models/Module";
import { Course } from "@/models/Course";
import { Programme } from "@/models/Programme";
import { requireAdminScope } from "@/lib/admin-scope";
import { audit } from "@/lib/audit";
import { notify, notifyMany } from "@/lib/notifications";
import { getEffectiveGradingRule } from "@/lib/grading-server";
import { calculateGrade } from "@/lib/grading";
import { computeAttendanceMet } from "@/lib/grade-engine";

const semesterSchema = z.enum(["First", "Second", "Summer"]);

const editGradeSchema = z.object({
  courseId: z.string().regex(/^[a-f\d]{24}$/i),
  studentId: z.string().regex(/^[a-f\d]{24}$/i),
  academicYear: z.string().regex(/^\d{4}\/\d{4}$/),
  semester: semesterSchema,
  testScore: z.coerce.number().min(0).max(100),
  examScore: z.coerce.number().min(0).max(100),
});

/**
 * Lets the admin override a lecturer's grade entry (test + exam scores) for
 * one student in one module. Recomputes the calculated grade/GPA/remark using
 * the same engine the lecturer uses, so finals stay consistent. Preserves
 * submissionStatus and isPublished — published grades stay published, draft
 * stays draft. If the row doesn't exist yet, creates it as "submitted" so the
 * admin can publish straight away.
 */
export async function adminEditGradeAction(args: {
  courseId: string;
  studentId: string;
  academicYear: string;
  semester: "First" | "Second" | "Summer";
  testScore: number;
  examScore: number;
}): Promise<{ ok: boolean; error?: string }> {
  const me = await requireAdminScope();
  const parsed = editGradeSchema.safeParse(args);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  await connectDB();
  const mod = await Course.findOne({
    _id: parsed.data.courseId,
    academicYear: parsed.data.academicYear,
    semester: parsed.data.semester,
  })
    .select("_id code name lecturerId enrolledStudents")
    .lean();
  if (!mod) return { ok: false, error: "Module not found for this period." };

  const isEnrolled = mod.enrolledStudents.some(
    (s) => String(s) === parsed.data.studentId,
  );
  if (!isEnrolled) {
    return { ok: false, error: "Student is not enrolled in this module." };
  }

  const rule = await getEffectiveGradingRule(parsed.data.courseId);
  if (!rule) {
    return {
      ok: false,
      error:
        "No grading rule attached to this module and no global default. Set one first.",
    };
  }

  const result = calculateGrade({
    testScore: parsed.data.testScore,
    testMaxScore: 100,
    examScore: parsed.data.examScore,
    examMaxScore: 100,
    caWeight: rule.caWeight,
    examWeight: rule.examWeight,
    gradeScale: rule.gradeScale,
  });

  const attendanceFlags = await computeAttendanceMet(
    parsed.data.courseId,
    [parsed.data.studentId],
    rule.attendanceThreshold,
  );
  const met = attendanceFlags.get(parsed.data.studentId);

  const adminOid = new mongoose.Types.ObjectId(me.userId);
  const existing = await Grade.findOne({
    courseId: mod._id,
    studentId: new mongoose.Types.ObjectId(parsed.data.studentId),
    academicYear: parsed.data.academicYear,
    semester: parsed.data.semester,
  }).select("_id submissionStatus isPublished testScore examScore");

  const setFields: Record<string, unknown> = {
    testScore: parsed.data.testScore,
    testMaxScore: 100,
    examScore: parsed.data.examScore,
    examMaxScore: 100,
    calculatedScore: result.finalScore,
    calculatedGrade: result.grade ?? undefined,
    calculatedGPA: result.gpa ?? undefined,
    calculatedRemark: result.remark ?? undefined,
  };
  if (typeof met === "boolean") setFields.attendanceMet = met;

  if (!existing) {
    setFields.lecturerId = mod.lecturerId ?? adminOid;
    setFields.submissionStatus = "submitted";
    setFields.submittedAt = new Date();
    setFields.submittedBy = adminOid;
    setFields.isPublished = false;
    await Grade.create({
      courseId: mod._id,
      studentId: new mongoose.Types.ObjectId(parsed.data.studentId),
      academicYear: parsed.data.academicYear,
      semester: parsed.data.semester,
      ...setFields,
    });
  } else {
    await Grade.updateOne({ _id: existing._id }, { $set: setFields });
  }

  await audit({
    action: "grade.admin_edit",
    summary: `Admin edited grade for student in ${mod.code} (${parsed.data.academicYear} · ${parsed.data.semester}): test ${parsed.data.testScore}, exam ${parsed.data.examScore} → ${result.grade ?? "—"} (${result.finalScore?.toFixed(2) ?? "—"})`,
    entityType: "Course",
    entityId: String(mod._id),
    metadata: {
      studentId: parsed.data.studentId,
      academicYear: parsed.data.academicYear,
      semester: parsed.data.semester,
      testScore: parsed.data.testScore,
      examScore: parsed.data.examScore,
      grade: result.grade ?? null,
      finalScore: result.finalScore ?? null,
      previous: existing
        ? { testScore: existing.testScore, examScore: existing.examScore }
        : null,
    },
  });

  // If the grade is already published, the student needs to see the new value.
  if (existing?.isPublished) {
    await notify({
      userId: parsed.data.studentId,
      type: "grade.published",
      title: "Grade updated",
      body: `Your grade for ${mod.code} (${parsed.data.academicYear} · ${parsed.data.semester}) has been updated by an administrator.`,
      link: "/student/grades",
      metadata: {
        academicYear: parsed.data.academicYear,
        semester: parsed.data.semester,
      },
    });
  }

  revalidatePath("/admin/grades");
  return { ok: true };
}

async function moduleIdsForCohort(
  programmeId: string,
  yearLevel: number,
  academicYear: string,
  semester: "First" | "Second" | "Summer",
): Promise<mongoose.Types.ObjectId[]> {
  await connectDB();
  const modules = await Module.find({
    programmeIds: programmeId,
    yearLevel,
    academicYear,
    semester,
  })
    .select("_id")
    .lean();
  return modules.map((m) => m._id);
}

async function programmeExists(programmeId: string): Promise<boolean> {
  if (!mongoose.Types.ObjectId.isValid(programmeId)) return false;
  await connectDB();
  const p = await Programme.findOne({ _id: programmeId }).select("_id").lean();
  return !!p;
}

/**
 * Publish every submitted-but-unpublished grade for ONE student in this
 * (programme, year, period). Partial cohorts are fine: a module still in
 * "draft" stays unpublished and the admin can come back later.
 */
export async function publishStudentGradesAction(args: {
  studentId: string;
  programmeId: string;
  yearLevel: number;
  academicYear: string;
  semester: "First" | "Second" | "Summer";
}): Promise<{ ok: boolean; error?: string; count?: number }> {
  const me = await requireAdminScope();
  const parsed = z
    .object({
      studentId: z.string().regex(/^[a-f\d]{24}$/i),
      programmeId: z.string().regex(/^[a-f\d]{24}$/i),
      yearLevel: z.coerce.number().int().min(1).max(4),
      academicYear: z.string().regex(/^\d{4}\/\d{4}$/),
      semester: semesterSchema,
    })
    .safeParse(args);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  await connectDB();
  if (!(await programmeExists(parsed.data.programmeId))) {
    return { ok: false, error: "Programme does not exist." };
  }

  // Confirm the student is in the cohort
  const student = await User.findOne({
    _id: parsed.data.studentId,
    role: "student",
    programmeId: parsed.data.programmeId,
    yearLevel: parsed.data.yearLevel,
  }).select("_id").lean();
  if (!student) return { ok: false, error: "Student is not in this cohort." };

  const moduleIds = await moduleIdsForCohort(
    parsed.data.programmeId,
    parsed.data.yearLevel,
    parsed.data.academicYear,
    parsed.data.semester,
  );
  if (moduleIds.length === 0) return { ok: false, error: "No modules in cohort." };

  const result = await Grade.updateMany(
    {
      courseId: { $in: moduleIds },
      studentId: new mongoose.Types.ObjectId(parsed.data.studentId),
      academicYear: parsed.data.academicYear,
      semester: parsed.data.semester,
      submissionStatus: "submitted",
      isPublished: { $ne: true },
    },
    {
      $set: {
        isPublished: true,
        publishedAt: new Date(),
        publishedBy: new mongoose.Types.ObjectId(me.userId),
      },
    },
  );

  if (result.modifiedCount === 0) {
    return {
      ok: false,
      error: "Nothing to publish. The lecturer may not have submitted yet.",
    };
  }
  revalidatePath("/admin/grades");
  await audit({
    action: "grade.publish.student",
    summary: `Published ${result.modifiedCount} grade${result.modifiedCount === 1 ? "" : "s"} for one student (${parsed.data.academicYear} · ${parsed.data.semester})`,
    entityType: "User",
    entityId: parsed.data.studentId,
    metadata: {
      count: result.modifiedCount,
      programmeId: parsed.data.programmeId,
      yearLevel: parsed.data.yearLevel,
      academicYear: parsed.data.academicYear,
      semester: parsed.data.semester,
    },
  });
  await notify({
    userId: parsed.data.studentId,
    type: "grade.published",
    title: "New grades available",
    body: `${result.modifiedCount} of your grade${result.modifiedCount === 1 ? "" : "s"} for ${parsed.data.academicYear} · ${parsed.data.semester} ${result.modifiedCount === 1 ? "has" : "have"} been published.`,
    link: "/student/grades",
    metadata: {
      count: result.modifiedCount,
      academicYear: parsed.data.academicYear,
      semester: parsed.data.semester,
    },
  });
  return { ok: true, count: result.modifiedCount };
}

/**
 * Inverse of publishStudentGradesAction — rolls back published grades for
 * one student in one period.
 */
export async function unpublishStudentGradesAction(args: {
  studentId: string;
  programmeId: string;
  yearLevel: number;
  academicYear: string;
  semester: "First" | "Second" | "Summer";
}): Promise<{ ok: boolean; error?: string; count?: number }> {
  const me = await requireAdminScope();
  const parsed = z
    .object({
      studentId: z.string().regex(/^[a-f\d]{24}$/i),
      programmeId: z.string().regex(/^[a-f\d]{24}$/i),
      yearLevel: z.coerce.number().int().min(1).max(4),
      academicYear: z.string().regex(/^\d{4}\/\d{4}$/),
      semester: semesterSchema,
    })
    .safeParse(args);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  await connectDB();
  if (!(await programmeExists(parsed.data.programmeId))) {
    return { ok: false, error: "Programme does not exist." };
  }
  const moduleIds = await moduleIdsForCohort(
    parsed.data.programmeId,
    parsed.data.yearLevel,
    parsed.data.academicYear,
    parsed.data.semester,
  );

  const result = await Grade.updateMany(
    {
      courseId: { $in: moduleIds },
      studentId: new mongoose.Types.ObjectId(parsed.data.studentId),
      academicYear: parsed.data.academicYear,
      semester: parsed.data.semester,
      isPublished: true,
    },
    {
      $set: { isPublished: false },
      $unset: { publishedAt: 1, publishedBy: 1 },
    },
  );
  if (result.modifiedCount === 0) {
    return { ok: false, error: "Nothing to unpublish." };
  }
  revalidatePath("/admin/grades");
  await audit({
    action: "grade.unpublish.student",
    summary: `Unpublished ${result.modifiedCount} grade${result.modifiedCount === 1 ? "" : "s"} for one student (${parsed.data.academicYear} · ${parsed.data.semester})`,
    entityType: "User",
    entityId: parsed.data.studentId,
    metadata: {
      count: result.modifiedCount,
      programmeId: parsed.data.programmeId,
      yearLevel: parsed.data.yearLevel,
      academicYear: parsed.data.academicYear,
      semester: parsed.data.semester,
    },
  });
  return { ok: true, count: result.modifiedCount };
}

/**
 * Publish every submitted-but-unpublished grade across an ENTIRE cohort —
 * one click to release everyone's results for the period.
 */
export async function publishCohortGradesAction(args: {
  programmeId: string;
  yearLevel: number;
  academicYear: string;
  semester: "First" | "Second" | "Summer";
}): Promise<{ ok: boolean; error?: string; count?: number }> {
  const me = await requireAdminScope();
  const parsed = z
    .object({
      programmeId: z.string().regex(/^[a-f\d]{24}$/i),
      yearLevel: z.coerce.number().int().min(1).max(4),
      academicYear: z.string().regex(/^\d{4}\/\d{4}$/),
      semester: semesterSchema,
    })
    .safeParse(args);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  await connectDB();
  if (!(await programmeExists(parsed.data.programmeId))) {
    return { ok: false, error: "Programme does not exist." };
  }
  const moduleIds = await moduleIdsForCohort(
    parsed.data.programmeId,
    parsed.data.yearLevel,
    parsed.data.academicYear,
    parsed.data.semester,
  );

  const batchStartTime = new Date();
  const result = await Grade.updateMany(
    {
      courseId: { $in: moduleIds },
      academicYear: parsed.data.academicYear,
      semester: parsed.data.semester,
      submissionStatus: "submitted",
      isPublished: { $ne: true },
    },
    {
      $set: {
        isPublished: true,
        publishedAt: batchStartTime,
        publishedBy: new mongoose.Types.ObjectId(me.userId),
      },
    },
  );

  if (result.modifiedCount === 0) {
    return {
      ok: false,
      error:
        "Nothing to publish across this cohort. Lecturers may not have submitted yet.",
    };
  }
  revalidatePath("/admin/grades");
  await audit({
    action: "grade.publish.cohort",
    summary: `Published ${result.modifiedCount} grade${result.modifiedCount === 1 ? "" : "s"} across cohort (Year ${parsed.data.yearLevel} · ${parsed.data.academicYear} · ${parsed.data.semester})`,
    entityType: "Programme",
    entityId: parsed.data.programmeId,
    metadata: {
      count: result.modifiedCount,
      yearLevel: parsed.data.yearLevel,
      academicYear: parsed.data.academicYear,
      semester: parsed.data.semester,
    },
  });

  // Find the distinct students whose grades were just published in this batch.
  // Query by publishedAt >= batchStartTime rather than publishedBy so students
  // whose grades were previously touched by a different admin are not excluded.
  const publishedStudents = await Grade.distinct("studentId", {
    courseId: { $in: moduleIds },
    academicYear: parsed.data.academicYear,
    semester: parsed.data.semester,
    publishedAt: { $gte: batchStartTime },
  });
  await notifyMany(
    publishedStudents.map((sid) => String(sid)),
    {
      type: "grade.published",
      title: "New grades available",
      body: `Your grades for ${parsed.data.academicYear} · ${parsed.data.semester} have been published.`,
      link: "/student/grades",
      metadata: {
        academicYear: parsed.data.academicYear,
        semester: parsed.data.semester,
      },
    },
  );
  return { ok: true, count: result.modifiedCount };
}
