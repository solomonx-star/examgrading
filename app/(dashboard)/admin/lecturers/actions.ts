"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { Course } from "@/models/Course";
import { Grade } from "@/models/Grade";
import { Attendance } from "@/models/Attendance";
import { Notification } from "@/models/Notification";
import { requireAdminScope } from "@/lib/admin-scope";
import { DEFAULT_PASSWORD } from "@/lib/constants";
import {
  lecturerCreateSchema,
  lecturerUpdateSchema,
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

export async function createLecturerAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdminScope();

  const parsed = lecturerCreateSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    staffId: formData.get("staffId"),
  });
  if (!parsed.success) return { ok: false, error: zodToError(parsed.error) };

  await connectDB();
  let createdId: string;
  try {
    const doc = await User.create({
      name: parsed.data.name,
      email: parsed.data.email,
      staffId: parsed.data.staffId || undefined,
      role: "lecturer",
      password: DEFAULT_PASSWORD,
      isActive: true,
      mustChangePassword: true,
    });
    createdId = String(doc._id);
  } catch (err) {
    const dup = mongoDuplicateMessage(err);
    if (dup) return { ok: false, error: dup };
    return { ok: false, error: "Could not create lecturer." };
  }

  await audit({
    action: "lecturer.create",
    summary: `Created lecturer ${parsed.data.name} (${parsed.data.email})`,
    entityType: "User",
    entityId: createdId,
  });
  revalidatePath("/admin/lecturers");
  revalidatePath("/admin");
  redirect("/admin/lecturers");
}

export async function updateLecturerAction(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdminScope();
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return { ok: false, error: "Invalid lecturer id." };
  }

  const parsed = lecturerUpdateSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    staffId: formData.get("staffId"),
    isActive: formData.get("isActive") === "on",
    mustChangePassword: formData.get("mustChangePassword") === "on",
  });
  if (!parsed.success) return { ok: false, error: zodToError(parsed.error) };

  await connectDB();
  try {
    const updated = await User.findOneAndUpdate(
      { _id: id, role: "lecturer" },
      {
        $set: {
          name: parsed.data.name,
          email: parsed.data.email,
          staffId: parsed.data.staffId || undefined,
          isActive: parsed.data.isActive,
          mustChangePassword: parsed.data.mustChangePassword,
        },
      },
      { new: true },
    );
    if (!updated) return { ok: false, error: "Lecturer not found." };
  } catch (err) {
    const dup = mongoDuplicateMessage(err);
    if (dup) return { ok: false, error: dup };
    return { ok: false, error: "Could not update lecturer." };
  }

  await audit({
    action: "lecturer.update",
    summary: `Updated lecturer ${parsed.data.name} (${parsed.data.email})`,
    entityType: "User",
    entityId: id,
    metadata: { isActive: parsed.data.isActive },
  });
  revalidatePath("/admin/lecturers");
  revalidatePath(`/admin/lecturers/${id}`);
  return { ok: true, message: "Lecturer updated." };
}

export async function toggleLecturerActiveAction(id: string): Promise<void> {
  await requireAdminScope();
  if (!mongoose.Types.ObjectId.isValid(id)) return;
  await connectDB();
  const user = await User.findOne({ _id: id, role: "lecturer" });
  if (!user) return;
  user.isActive = !user.isActive;
  await user.save();
  await audit({
    action: user.isActive ? "lecturer.activate" : "lecturer.deactivate",
    summary: `${user.isActive ? "Activated" : "Deactivated"} lecturer ${user.name} (${user.email})`,
    entityType: "User",
    entityId: id,
  });
  revalidatePath("/admin/lecturers");
}

export async function deleteLecturerAction(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireAdminScope();
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return { ok: false, error: "Invalid lecturer id." };
  }
  await connectDB();
  const user = await User.findOne({ _id: id, role: "lecturer" })
    .select("name email")
    .lean();
  if (!user) return { ok: false, error: "Lecturer not found." };

  const lecturerOid = new mongoose.Types.ObjectId(id);
  const [assignedToCourse, hasGrades, hasAttendance] = await Promise.all([
    Course.exists({ lecturerId: lecturerOid }),
    Grade.exists({ lecturerId: lecturerOid }),
    Attendance.exists({ lecturerId: lecturerOid }),
  ]);
  if (assignedToCourse) {
    return {
      ok: false,
      error:
        "Lecturer is assigned to one or more modules. Reassign the modules first.",
    };
  }
  if (hasGrades || hasAttendance) {
    return {
      ok: false,
      error:
        "Lecturer has grade or attendance records on file. For audit compliance, deactivate instead of deleting.",
    };
  }

  await Notification.deleteMany({ userId: lecturerOid });
  await User.deleteOne({ _id: lecturerOid });

  await audit({
    action: "lecturer.delete",
    summary: `Deleted lecturer ${user.name} (${user.email})`,
    entityType: "User",
    entityId: id,
  });
  revalidatePath("/admin/lecturers");
  revalidatePath("/admin");
  return { ok: true };
}

export async function resetLecturerPasswordAction(id: string): Promise<void> {
  await requireAdminScope();
  if (!mongoose.Types.ObjectId.isValid(id)) return;
  await connectDB();
  const user = await User.findOne({ _id: id, role: "lecturer" });
  if (!user) return;
  user.password = DEFAULT_PASSWORD;
  user.mustChangePassword = true;
  await user.save();
  await audit({
    action: "lecturer.password.reset",
    summary: `Reset password for lecturer ${user.name} (${user.email})`,
    entityType: "User",
    entityId: id,
  });
  revalidatePath("/admin/lecturers");
}

export async function bulkImportLecturersAction(
  _prev: BulkImportState,
  formData: FormData,
): Promise<BulkImportState> {
  await requireAdminScope();

  const state = await processCsvImport({
    formData,
    requiredColumns: ["name", "email"],
    processRow: (r) => {
      const parsed = lecturerCreateSchema.safeParse({
        name: r.name,
        email: r.email,
        staffId: r.staffid ?? r.staffId ?? "",
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
          staffId: parsed.data.staffId || undefined,
          role: "lecturer",
          password: DEFAULT_PASSWORD,
          isActive: true,
          mustChangePassword: true,
        },
      };
    },
  });

  if (state?.ok) {
    revalidatePath("/admin/lecturers");
    revalidatePath("/admin");
    const r = state.result;
    await audit({
      action: "lecturer.bulk_import",
      summary: `Bulk-imported lecturers: ${r.created} created, ${r.skipped.length} skipped, ${r.failed.length} failed`,
      entityType: "User",
      metadata: {
        created: r.created,
        skipped: r.skipped.length,
        failed: r.failed.length,
      },
    });
  }
  return state;
}
