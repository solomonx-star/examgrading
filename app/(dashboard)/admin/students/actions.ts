"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { Programme } from "@/models/Programme";
import { Course } from "@/models/Course";
import { Grade } from "@/models/Grade";
import { Attendance } from "@/models/Attendance";
import { AccessPayment } from "@/models/AccessPayment";
import { Notification } from "@/models/Notification";
import { requireAdminScope } from "@/lib/admin-scope";
import { DEFAULT_PASSWORD } from "@/lib/constants";
import {
  studentCreateSchema,
  studentUpdateSchema,
} from "@/lib/validators";
import {
  mongoDuplicateMessage,
  zodToError,
  type FormState,
} from "@/lib/form-state";
import {
  processCsvImport,
  type BulkImportState,
} from "@/lib/bulk-import";
import { audit } from "@/lib/audit";

export type { BulkImportState } from "@/lib/bulk-import";

async function programmeExists(programmeId: string): Promise<boolean> {
  if (!mongoose.Types.ObjectId.isValid(programmeId)) return false;
  const p = await Programme.findOne({ _id: programmeId }).select("_id").lean();
  return !!p;
}

export async function createStudentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdminScope();

  const parsed = studentCreateSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    programmeId: formData.get("programmeId"),
    yearLevel: formData.get("yearLevel"),
  });
  if (!parsed.success) return { ok: false, error: zodToError(parsed.error) };

  await connectDB();
  if (!(await programmeExists(parsed.data.programmeId))) {
    return { ok: false, error: "Selected programme does not exist." };
  }

  let createdId: string;
  try {
    const doc = await User.create({
      name: parsed.data.name,
      email: parsed.data.email,
      programmeId: parsed.data.programmeId,
      yearLevel: parsed.data.yearLevel,
      role: "student",
      password: DEFAULT_PASSWORD,
      isActive: true,
      mustChangePassword: true,
    });
    createdId = String(doc._id);
  } catch (err) {
    const dup = mongoDuplicateMessage(err);
    if (dup) return { ok: false, error: dup };
    return { ok: false, error: "Could not create student." };
  }

  await audit({
    action: "student.create",
    summary: `Created student ${parsed.data.name} (${parsed.data.email})`,
    entityType: "User",
    entityId: createdId,
    metadata: { yearLevel: parsed.data.yearLevel },
  });
  revalidatePath("/admin/students");
  revalidatePath("/admin");
  redirect("/admin/students?created=1");
}

export async function updateStudentAction(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdminScope();
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return { ok: false, error: "Invalid student id." };
  }

  const parsed = studentUpdateSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    programmeId: formData.get("programmeId"),
    yearLevel: formData.get("yearLevel"),
    isActive: formData.get("isActive") === "on",
    mustChangePassword: formData.get("mustChangePassword") === "on",
  });
  if (!parsed.success) return { ok: false, error: zodToError(parsed.error) };

  await connectDB();
  if (!(await programmeExists(parsed.data.programmeId))) {
    return { ok: false, error: "Selected programme does not exist." };
  }

  try {
    const updated = await User.findOneAndUpdate(
      { _id: id, role: "student" },
      {
        $set: {
          name: parsed.data.name,
          email: parsed.data.email,
          programmeId: parsed.data.programmeId,
          yearLevel: parsed.data.yearLevel,
          isActive: parsed.data.isActive,
          mustChangePassword: parsed.data.mustChangePassword,
        },
      },
      { returnDocument: "after" },
    );
    if (!updated) return { ok: false, error: "Student not found." };
  } catch (err) {
    const dup = mongoDuplicateMessage(err);
    if (dup) return { ok: false, error: dup };
    return { ok: false, error: "Could not update student." };
  }

  await audit({
    action: "student.update",
    summary: `Updated student ${parsed.data.name} (${parsed.data.email})`,
    entityType: "User",
    entityId: id,
    metadata: { isActive: parsed.data.isActive },
  });
  revalidatePath("/admin/students");
  revalidatePath(`/admin/students/${id}`);
  return { ok: true, message: "Student updated." };
}

export async function toggleStudentActiveAction(id: string): Promise<void> {
  await requireAdminScope();
  if (!mongoose.Types.ObjectId.isValid(id)) return;
  await connectDB();
  const user = await User.findOne({ _id: id, role: "student" });
  if (!user) return;
  user.isActive = !user.isActive;
  await user.save();
  await audit({
    action: user.isActive ? "student.activate" : "student.deactivate",
    summary: `${user.isActive ? "Activated" : "Deactivated"} student ${user.name} (${user.email})`,
    entityType: "User",
    entityId: id,
  });
  revalidatePath("/admin/students");
}

export async function deleteStudentAction(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireAdminScope();
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return { ok: false, error: "Invalid student id." };
  }
  await connectDB();
  const user = await User.findOne({ _id: id, role: "student" })
    .select("name email")
    .lean();
  if (!user) return { ok: false, error: "Student not found." };

  const studentOid = new mongoose.Types.ObjectId(id);
  const [hasGrades, hasAttendance, hasPayments] = await Promise.all([
    Grade.exists({ studentId: studentOid }),
    Attendance.exists({ studentId: studentOid }),
    AccessPayment.exists({ student: studentOid }),
  ]);
  if (hasGrades) {
    return {
      ok: false,
      error:
        "Student has grade records. Clear them first, or deactivate the student instead.",
    };
  }
  if (hasAttendance) {
    return {
      ok: false,
      error:
        "Student has attendance records. Clear them first, or deactivate the student instead.",
    };
  }
  if (hasPayments) {
    return {
      ok: false,
      error:
        "Student has access-fee payment history. For audit compliance, deactivate instead of deleting.",
    };
  }

  // Safe to delete — also clean enrolment lists and unread notifications.
  await Course.updateMany(
    { enrolledStudents: studentOid },
    { $pull: { enrolledStudents: studentOid } },
  );
  await Notification.deleteMany({ userId: studentOid });
  await User.deleteOne({ _id: studentOid });

  await audit({
    action: "student.delete",
    summary: `Deleted student ${user.name} (${user.email})`,
    entityType: "User",
    entityId: id,
  });
  revalidatePath("/admin/students");
  revalidatePath("/admin");
  return { ok: true };
}

export async function resetStudentPasswordAction(id: string): Promise<void> {
  await requireAdminScope();
  if (!mongoose.Types.ObjectId.isValid(id)) return;
  await connectDB();
  const user = await User.findOne({ _id: id, role: "student" });
  if (!user) return;
  user.password = DEFAULT_PASSWORD;
  user.mustChangePassword = true;
  await user.save();
  await audit({
    action: "student.password.reset",
    summary: `Reset password for student ${user.name} (${user.email})`,
    entityType: "User",
    entityId: id,
  });
  revalidatePath("/admin/students");
}

export async function bulkImportStudentsAction(
  _prev: BulkImportState,
  formData: FormData,
): Promise<BulkImportState> {
  await requireAdminScope();

  // Pre-fetch the programme code → ObjectId map ONCE, not per row.
  await connectDB();
  const programmes = await Programme.find({}).select("code").lean();
  const programmeIdByCode = new Map<string, string>(
    programmes.map((p) => [p.code.toUpperCase(), String(p._id)]),
  );

  const state = await processCsvImport({
    formData,
    requiredColumns: ["name", "email", "programme", "yearlevel"],
    processRow: (r) => {
      const code = (r.programme ?? "").trim().toUpperCase();
      const programmeId = programmeIdByCode.get(code);
      if (!programmeId) {
        return {
          action: "fail",
          email: r.email ?? "",
          reason: `Programme code "${code}" not found.`,
        };
      }

      const parsed = studentCreateSchema.safeParse({
        name: r.name,
        email: r.email,
        programmeId,
        yearLevel: r.yearlevel,
      });
      if (!parsed.success) {
        return {
          action: "fail",
          email: r.email ?? "",
          reason: zodToError(parsed.error),
        };
      }
      return {
        action: "create",
        email: parsed.data.email,
        doc: {
          name: parsed.data.name,
          email: parsed.data.email,
          programmeId: parsed.data.programmeId,
          yearLevel: parsed.data.yearLevel,
          role: "student",
          password: DEFAULT_PASSWORD,
          isActive: true,
          mustChangePassword: true,
        },
      };
    },
  });

  if (state?.ok) {
    revalidatePath("/admin/students");
    revalidatePath("/admin");
    const r = state.result;
    await audit({
      action: "student.bulk_import",
      summary: `Bulk-imported students: ${r.created} created, ${r.skipped.length} skipped, ${r.failed.length} failed`,
      entityType: "User",
      metadata: {
        created: r.created,
        skipped: r.skipped.length,
        failed: r.failed.length,
        totalDataRows: r.totalDataRows,
      },
    });
  }
  return state;
}
