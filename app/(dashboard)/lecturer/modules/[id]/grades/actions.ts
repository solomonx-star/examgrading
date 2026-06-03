"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Grade } from "@/models/Grade";
import { Programme } from "@/models/Programme";
import { User } from "@/models/User";
import { requireLecturerCourse } from "@/lib/lecturer-course";
import { getEffectiveGradingRule } from "@/lib/grading-server";
import { calculateGrade } from "@/lib/grading";
import { computeAttendanceMet } from "@/lib/grade-engine";
import { audit } from "@/lib/audit";
import { notifyMany } from "@/lib/notifications";
import { zodToError, type FormState } from "@/lib/form-state";

const objectIdRe = /^[a-f\d]{24}$/i;

const studentRowSchema = z.object({
  studentId: z.string().regex(objectIdRe),
  testScore: z.coerce.number().min(0).max(100),
  examScore: z.coerce.number().min(0).max(100),
});

function parseStudentRows(
  formData: FormData,
): Array<{ studentId: string; testScore: string; examScore: string }> {
  const acc: Record<
    string,
    { studentId: string; testScore: string; examScore: string }
  > = {};
  for (const [k, v] of formData.entries()) {
    let m = k.match(/^row\[([a-f\d]{24})\]\[test\]$/i);
    if (m) {
      acc[m[1]] = acc[m[1]] ?? {
        studentId: m[1],
        testScore: "0",
        examScore: "0",
      };
      acc[m[1]].testScore = String(v);
      continue;
    }
    m = k.match(/^row\[([a-f\d]{24})\]\[exam\]$/i);
    if (m) {
      acc[m[1]] = acc[m[1]] ?? {
        studentId: m[1],
        testScore: "0",
        examScore: "0",
      };
      acc[m[1]].examScore = String(v);
    }
  }
  return Object.values(acc);
}

export async function saveGradesAction(
  courseId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { me, course: mod } = await requireLecturerCourse(courseId);

  // GUARD: if ANY grade in this period has already been submitted (locked),
  // refuse the whole save. Lecturers must recall the submission first.
  await connectDB();
  const locked = await Grade.exists({
    courseId: mod._id,
    academicYear: mod.academicYear,
    semester: mod.semester,
    submissionStatus: "submitted",
  });
  if (locked) {
    return {
      ok: false,
      error:
        "Grades for this period are already submitted for review. Recall the submission before editing.",
    };
  }

  const rowsRaw = parseStudentRows(formData);
  const rows: Array<z.infer<typeof studentRowSchema>> = [];
  for (const r of rowsRaw) {
    const parsed = studentRowSchema.safeParse(r);
    if (!parsed.success) {
      return { ok: false, error: zodToError(parsed.error) };
    }
    rows.push(parsed.data);
  }

  const enrolled = new Set(mod.enrolledStudents.map((s) => String(s)));
  const allowed = rows.filter((r) => enrolled.has(r.studentId));
  if (allowed.length === 0) {
    return { ok: false, error: "No valid student rows to save." };
  }

  const rule = await getEffectiveGradingRule(courseId);
  if (!rule) {
    return {
      ok: false,
      error:
        "No grading rule attached to this module and no global default. Ask your admin.",
    };
  }

  const attendanceFlags = await computeAttendanceMet(
    courseId,
    allowed.map((r) => r.studentId),
    rule.attendanceThreshold,
  );
  const lecturerObjectId = new mongoose.Types.ObjectId(me.userId);
  await Grade.bulkWrite(
    allowed.map((r) => {
      const result = calculateGrade({
        testScore: r.testScore,
        testMaxScore: 100,
        examScore: r.examScore,
        examMaxScore: 100,
        caWeight: rule.caWeight,
        examWeight: rule.examWeight,
        gradeScale: rule.gradeScale,
      });
      const setFields: Record<string, unknown> = {
        lecturerId: lecturerObjectId,
        testScore: r.testScore,
        testMaxScore: 100,
        examScore: r.examScore,
        examMaxScore: 100,
        calculatedScore: result.finalScore,
        calculatedGrade: result.grade ?? undefined,
        calculatedGPA: result.gpa ?? undefined,
        calculatedRemark: result.remark ?? undefined,
        submissionStatus: "draft",
      };
      const met = attendanceFlags.get(r.studentId);
      if (typeof met === "boolean") setFields.attendanceMet = met;
      return {
        updateOne: {
          filter: {
            courseId: mod._id,
            studentId: new mongoose.Types.ObjectId(r.studentId),
            academicYear: mod.academicYear,
            semester: mod.semester,
          },
          update: {
            $set: setFields,
            $setOnInsert: {
              isPublished: false,
            },
          },
          upsert: true,
        },
      };
    }),
  );

  revalidatePath(`/lecturer/modules/${courseId}/grades`);
  revalidatePath(`/lecturer/modules/${courseId}`);
  await audit({
    action: "grade.save",
    summary: `Saved grades for ${allowed.length} student${allowed.length === 1 ? "" : "s"} in ${mod.code} (${mod.academicYear} · ${mod.semester})`,
    entityType: "Course",
    entityId: String(mod._id),
    metadata: { count: allowed.length, code: mod.code, academicYear: mod.academicYear, semester: mod.semester },
  });
  return {
    ok: true,
    message: `Saved grades for ${allowed.length} student${allowed.length === 1 ? "" : "s"}.`,
  };
}

/**
 * Lock the current period's grades and ship them to the admin for review.
 * Only flips rows that are still "draft" — already-submitted rows are left
 * alone so re-clicking is idempotent.
 */
export async function submitGradesAction(
  courseId: string,
): Promise<{ ok: boolean; error?: string; count?: number }> {
  const { me, course: mod } = await requireLecturerCourse(courseId);
  await connectDB();
  const lecturerObjectId = new mongoose.Types.ObjectId(me.userId);
  const result = await Grade.updateMany(
    {
      courseId: mod._id,
      academicYear: mod.academicYear,
      semester: mod.semester,
      submissionStatus: "draft",
    },
    {
      $set: {
        submissionStatus: "submitted",
        submittedAt: new Date(),
        submittedBy: lecturerObjectId,
      },
    },
  );
  if (result.matchedCount === 0) {
    return {
      ok: false,
      error: "Nothing to submit. Save grades first, or the period is already submitted.",
    };
  }
  revalidatePath(`/lecturer/modules/${courseId}/grades`);
  revalidatePath(`/lecturer/modules/${courseId}`);
  await audit({
    action: "grade.submit",
    summary: `Submitted ${result.modifiedCount ?? 0} grade${result.modifiedCount === 1 ? "" : "s"} for review in ${mod.code} (${mod.academicYear} · ${mod.semester})`,
    entityType: "Course",
    entityId: String(mod._id),
    metadata: { count: result.modifiedCount ?? 0, code: mod.code, academicYear: mod.academicYear, semester: mod.semester },
  });

  // Notify admins in any of the module's programme departments that grades
  // are ready for review. Shared modules span multiple departments, so we
  // union and dedupe.
  const programmes = mod.programmeIds.length
    ? await Programme.find({ _id: { $in: mod.programmeIds } })
        .select("department")
        .lean()
    : [];
  const departments = Array.from(
    new Set(
      programmes
        .map((p) => p.department)
        .filter((d): d is string => !!d),
    ),
  );
  if (departments.length) {
    const admins = await User.find({
      role: "admin",
      department: { $in: departments },
      isActive: true,
    })
      .select("_id")
      .lean();
    await notifyMany(
      admins.map((a) => String(a._id)),
      {
        type: "grade.submitted",
        title: `Grades submitted: ${mod.code}`,
        body: `${me.name} submitted ${result.modifiedCount ?? 0} grade${result.modifiedCount === 1 ? "" : "s"} for ${mod.code} (${mod.academicYear} · ${mod.semester}) for your review.`,
        link: `/admin/grades`,
        metadata: {
          courseId: String(mod._id),
          academicYear: mod.academicYear,
          semester: mod.semester,
          count: result.modifiedCount ?? 0,
        },
      },
    );
  }
  return { ok: true, count: result.modifiedCount ?? 0 };
}

/**
 * Recall a submission so the lecturer can edit again.
 * If ANY row was already published by the admin, fail the WHOLE recall so the
 * UI never enters a half-locked state.
 */
export async function recallSubmissionAction(
  courseId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { course: mod } = await requireLecturerCourse(courseId);
  await connectDB();
  const anyPublished = await Grade.exists({
    courseId: mod._id,
    academicYear: mod.academicYear,
    semester: mod.semester,
    isPublished: true,
  });
  if (anyPublished) {
    return {
      ok: false,
      error:
        "Some grades in this period have already been published. Ask the admin to unpublish first.",
    };
  }
  await Grade.updateMany(
    {
      courseId: mod._id,
      academicYear: mod.academicYear,
      semester: mod.semester,
      submissionStatus: "submitted",
    },
    {
      $set: { submissionStatus: "draft" },
      $unset: { submittedAt: 1, submittedBy: 1 },
    },
  );
  revalidatePath(`/lecturer/modules/${courseId}/grades`);
  revalidatePath(`/lecturer/modules/${courseId}`);
  await audit({
    action: "grade.recall",
    summary: `Recalled submitted grades for ${mod.code} (${mod.academicYear} · ${mod.semester})`,
    entityType: "Course",
    entityId: String(mod._id),
    metadata: { code: mod.code, academicYear: mod.academicYear, semester: mod.semester },
  });
  return { ok: true };
}
