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

function pickIdsFromForm(formData: FormData, field: string): string[] {
  return formData
    .getAll(field)
    .map((v) => String(v))
    .filter((v) => /^[a-f\d]{24}$/i.test(v));
}

/**
 * Cross-checks: every programme + the lecturer must exist; every enrolled
 * student must belong to one of the module's programmes and match its year.
 * Shared modules accept students from any listed programme.
 */
async function validateRefs(
  programmeIds: string[],
  yearLevel: number,
  lecturerId: string | undefined,
  enrolled: string[],
): Promise<string | null> {
  const uniqueProgrammes = Array.from(new Set(programmeIds));
  const programmeCount = await Programme.countDocuments({
    _id: { $in: uniqueProgrammes },
  });
  if (programmeCount !== uniqueProgrammes.length) {
    return "One or more selected programmes do not exist.";
  }

  if (lecturerId) {
    const ok = await User.exists({ _id: lecturerId, role: "lecturer" });
    if (!ok) return "Selected lecturer does not exist.";
  }

  if (enrolled.length) {
    const count = await User.countDocuments({
      _id: { $in: enrolled },
      role: "student",
      programmeId: { $in: uniqueProgrammes },
      yearLevel,
    });
    if (count !== enrolled.length) {
      return "One or more selected students are not in this module's programmes + year.";
    }
  }
  return null;
}

export async function createCourseAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdminScope();

  const parsed = courseCreateSchema.safeParse({
    name: formData.get("name"),
    code: formData.get("code"),
    programmeIds: pickIdsFromForm(formData, "programmeIds"),
    yearLevel: formData.get("yearLevel"),
    academicYear: formData.get("academicYear"),
    semester: formData.get("semester"),
    lecturerId: formData.get("lecturerId"),
    gradingRuleId: formData.get("gradingRuleId"),
    enrolledStudents: pickIdsFromForm(formData, "enrolledStudents"),
  });
  if (!parsed.success) return { ok: false, error: zodToError(parsed.error) };

  await connectDB();
  const scopeErr = await validateRefs(
    parsed.data.programmeIds,
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
      programmeIds: parsed.data.programmeIds,
      yearLevel: parsed.data.yearLevel,
      academicYear: parsed.data.academicYear,
      semester: parsed.data.semester,
      lecturerId: parsed.data.lecturerId || undefined,
      gradingRuleId: parsed.data.gradingRuleId || undefined,
      enrolledStudents: parsed.data.enrolledStudents,
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
  await requireAdminScope();
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return { ok: false, error: "Invalid module id." };
  }

  const parsed = courseUpdateSchema.safeParse({
    name: formData.get("name"),
    code: formData.get("code"),
    programmeIds: pickIdsFromForm(formData, "programmeIds"),
    yearLevel: formData.get("yearLevel"),
    academicYear: formData.get("academicYear"),
    semester: formData.get("semester"),
    lecturerId: formData.get("lecturerId"),
    gradingRuleId: formData.get("gradingRuleId"),
    enrolledStudents: pickIdsFromForm(formData, "enrolledStudents"),
    isActive: formData.get("isActive") === "on",
  });
  if (!parsed.success) return { ok: false, error: zodToError(parsed.error) };

  await connectDB();
  const scopeErr = await validateRefs(
    parsed.data.programmeIds,
    parsed.data.yearLevel,
    parsed.data.lecturerId || undefined,
    parsed.data.enrolledStudents,
  );
  if (scopeErr) return { ok: false, error: scopeErr };

  try {
    const updated = await Course.findOneAndUpdate(
      { _id: id },
      {
        $set: {
          name: parsed.data.name,
          code: parsed.data.code,
          programmeIds: parsed.data.programmeIds,
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
  await requireAdminScope();
  if (!mongoose.Types.ObjectId.isValid(id)) return;
  await connectDB();
  const mod = await Course.findById(id);
  if (!mod) return;
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
