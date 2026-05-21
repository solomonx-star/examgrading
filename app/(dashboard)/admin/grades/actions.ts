"use server";

import { revalidatePath } from "next/cache";
import mongoose from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Grade } from "@/models/Grade";
import { User } from "@/models/User";
import { Module } from "@/models/Module";
import { Programme } from "@/models/Programme";
import { requireAdminScope } from "@/lib/admin-scope";
import { audit } from "@/lib/audit";
import { notify, notifyMany } from "@/lib/notifications";

const semesterSchema = z.enum(["First", "Second", "Summer"]);

async function moduleIdsForCohort(
  programmeId: string,
  yearLevel: number,
  academicYear: string,
  semester: "First" | "Second" | "Summer",
): Promise<mongoose.Types.ObjectId[]> {
  const modules = await Module.find({
    programmeId,
    yearLevel,
    academicYear,
    semester,
  })
    .select("_id")
    .lean();
  return modules.map((m) => m._id);
}

async function assertCohortInDept(
  programmeId: string,
  department: string,
): Promise<boolean> {
  if (!mongoose.Types.ObjectId.isValid(programmeId)) return false;
  const p = await Programme.findOne({ _id: programmeId, department })
    .select("_id")
    .lean();
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
  if (!(await assertCohortInDept(parsed.data.programmeId, me.department))) {
    return { ok: false, error: "Programme is not in your department." };
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
      studentId: parsed.data.studentId,
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
  if (!(await assertCohortInDept(parsed.data.programmeId, me.department))) {
    return { ok: false, error: "Programme is not in your department." };
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
      studentId: parsed.data.studentId,
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
  if (!(await assertCohortInDept(parsed.data.programmeId, me.department))) {
    return { ok: false, error: "Programme is not in your department." };
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

  // Find the distinct students who actually had grades published and notify each.
  const publishedStudents = await Grade.distinct("studentId", {
    courseId: { $in: moduleIds },
    academicYear: parsed.data.academicYear,
    semester: parsed.data.semester,
    isPublished: true,
    publishedBy: new mongoose.Types.ObjectId(me.userId),
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
