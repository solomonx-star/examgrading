"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Course } from "@/models/Course";
import { Programme } from "@/models/Programme";
import { User } from "@/models/User";
import { requireAdminScope } from "@/lib/admin-scope";
import {
  courseCreateSchema,
  courseUpdateSchema,
} from "@/lib/validators";
import { audit } from "@/lib/audit";
import {
  mongoDuplicateMessage,
  zodToError,
  type FormState,
} from "@/lib/form-state";

function pickEnrolled(formData: FormData): string[] {
  return formData
    .getAll("enrolledStudents")
    .map((v) => String(v))
    .filter((v) => /^[a-f\d]{24}$/i.test(v));
}

/**
 * Cross-checks: programme must belong to admin's department, lecturer must be
 * in the same department, and every selected student must be in the same
 * programme AND year level as the course (so a Year 2 student can't be
 * dropped into a Year 1 course).
 */
async function validateProgrammeRefs(
  department: string,
  programmeId: string,
  yearLevel: number,
  lecturerId: string | undefined,
  enrolled: string[],
): Promise<string | null> {
  const programme = await Programme.findOne({
    _id: programmeId,
    department,
  }).select("_id").lean();
  if (!programme) return "Selected programme is not in your department.";

  if (lecturerId) {
    const ok = await User.exists({
      _id: lecturerId,
      role: "lecturer",
      department,
    });
    if (!ok) return "Selected lecturer is not in your department.";
  }

  if (enrolled.length) {
    const count = await User.countDocuments({
      _id: { $in: enrolled },
      role: "student",
      programmeId,
      yearLevel,
    });
    if (count !== enrolled.length) {
      return "One or more selected students are not in this programme + year.";
    }
  }
  return null;
}

export async function createCourseAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await requireAdminScope();

  const parsed = courseCreateSchema.safeParse({
    name: formData.get("name"),
    code: formData.get("code"),
    programmeId: formData.get("programmeId"),
    yearLevel: formData.get("yearLevel"),
    academicYear: formData.get("academicYear"),
    semester: formData.get("semester"),
    lecturerId: formData.get("lecturerId"),
    gradingRuleId: formData.get("gradingRuleId"),
    enrolledStudents: pickEnrolled(formData),
  });
  if (!parsed.success) return { ok: false, error: zodToError(parsed.error) };

  await connectDB();
  const scopeErr = await validateProgrammeRefs(
    me.department,
    parsed.data.programmeId,
    parsed.data.yearLevel,
    parsed.data.lecturerId || undefined,
    parsed.data.enrolledStudents,
  );
  if (scopeErr) return { ok: false, error: scopeErr };

  let createdId: string;
  try {
    const doc = await Course.create({
      name: parsed.data.name,
      code: parsed.data.code,
      programmeId: parsed.data.programmeId,
      yearLevel: parsed.data.yearLevel,
      academicYear: parsed.data.academicYear,
      semester: parsed.data.semester,
      lecturerId: parsed.data.lecturerId || undefined,
      gradingRuleId: parsed.data.gradingRuleId || undefined,
      enrolledStudents: parsed.data.enrolledStudents,
      department: me.department,
      isActive: true,
    });
    createdId = String(doc._id);
  } catch (err) {
    const dup = mongoDuplicateMessage(err);
    if (dup) return { ok: false, error: dup };
    return { ok: false, error: "Could not create module." };
  }

  await audit({
    action: "module.create",
    summary: `Created module ${parsed.data.code} — ${parsed.data.name} (Year ${parsed.data.yearLevel}, ${parsed.data.academicYear} · ${parsed.data.semester})`,
    entityType: "Course",
    entityId: createdId,
    metadata: { code: parsed.data.code, enrolled: parsed.data.enrolledStudents.length },
  });
  revalidatePath("/admin/modules");
  revalidatePath("/admin");
  redirect("/admin/modules");
}

export async function updateCourseAction(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await requireAdminScope();
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return { ok: false, error: "Invalid module id." };
  }

  const parsed = courseUpdateSchema.safeParse({
    name: formData.get("name"),
    code: formData.get("code"),
    programmeId: formData.get("programmeId"),
    yearLevel: formData.get("yearLevel"),
    academicYear: formData.get("academicYear"),
    semester: formData.get("semester"),
    lecturerId: formData.get("lecturerId"),
    gradingRuleId: formData.get("gradingRuleId"),
    enrolledStudents: pickEnrolled(formData),
    isActive: formData.get("isActive") === "on",
  });
  if (!parsed.success) return { ok: false, error: zodToError(parsed.error) };

  await connectDB();
  const scopeErr = await validateProgrammeRefs(
    me.department,
    parsed.data.programmeId,
    parsed.data.yearLevel,
    parsed.data.lecturerId || undefined,
    parsed.data.enrolledStudents,
  );
  if (scopeErr) return { ok: false, error: scopeErr };

  // Verify the course currently in DB also belongs to a programme in this dept
  const existing = await Course.findById(id)
    .populate({ path: "programmeId", select: "department" })
    .lean();
  if (!existing) return { ok: false, error: "Module not found." };
  const existingProgramme = existing.programmeId as unknown as
    | { department?: string }
    | null;
  if (existingProgramme?.department !== me.department) {
    return { ok: false, error: "Module not found." };
  }

  try {
    const updated = await Course.findOneAndUpdate(
      { _id: id },
      {
        $set: {
          name: parsed.data.name,
          code: parsed.data.code,
          programmeId: parsed.data.programmeId,
          yearLevel: parsed.data.yearLevel,
          academicYear: parsed.data.academicYear,
          semester: parsed.data.semester,
          lecturerId: parsed.data.lecturerId || null,
          gradingRuleId: parsed.data.gradingRuleId || null,
          enrolledStudents: parsed.data.enrolledStudents,
          isActive: parsed.data.isActive,
        },
      },
      { returnDocument: "after" },
    );
    if (!updated) return { ok: false, error: "Module not found." };
  } catch (err) {
    const dup = mongoDuplicateMessage(err);
    if (dup) return { ok: false, error: dup };
    return { ok: false, error: "Could not update module." };
  }

  await audit({
    action: "module.update",
    summary: `Updated module ${parsed.data.code} — ${parsed.data.name}`,
    entityType: "Course",
    entityId: id,
    metadata: { code: parsed.data.code, isActive: parsed.data.isActive },
  });
  revalidatePath("/admin/modules");
  revalidatePath(`/admin/modules/${id}`);
  return { ok: true, message: "Module updated." };
}

export async function toggleCourseActiveAction(id: string): Promise<void> {
  const me = await requireAdminScope();
  if (!mongoose.Types.ObjectId.isValid(id)) return;
  await connectDB();
  const mod = await Course.findById(id)
    .populate({ path: "programmeId", select: "department" });
  if (!mod) return;
  const programme = mod.programmeId as unknown as { department?: string } | null;
  if (programme?.department !== me.department) return;
  mod.isActive = !mod.isActive;
  await mod.save();
  await audit({
    action: mod.isActive ? "module.activate" : "module.deactivate",
    summary: `${mod.isActive ? "Activated" : "Deactivated"} module ${mod.code} — ${mod.name}`,
    entityType: "Course",
    entityId: id,
  });
  revalidatePath("/admin/modules");
}
