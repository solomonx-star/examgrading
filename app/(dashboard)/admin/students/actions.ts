"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { Programme } from "@/models/Programme";
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

async function programmeInDept(
  programmeId: string,
  department: string,
): Promise<boolean> {
  if (!mongoose.Types.ObjectId.isValid(programmeId)) return false;
  const p = await Programme.findOne({ _id: programmeId, department })
    .select("_id")
    .lean();
  return !!p;
}

export async function createStudentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await requireAdminScope();

  const parsed = studentCreateSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    programmeId: formData.get("programmeId"),
    yearLevel: formData.get("yearLevel"),
    department: me.department, // force admin's department
  });
  if (!parsed.success) return { ok: false, error: zodToError(parsed.error) };

  await connectDB();
  if (!(await programmeInDept(parsed.data.programmeId, me.department))) {
    return { ok: false, error: "Selected programme is not in your department." };
  }

  let createdId: string;
  try {
    const doc = await User.create({
      name: parsed.data.name,
      email: parsed.data.email,
      programmeId: parsed.data.programmeId,
      yearLevel: parsed.data.yearLevel,
      department: me.department,
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
  redirect("/admin/students");
}

export async function updateStudentAction(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await requireAdminScope();
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return { ok: false, error: "Invalid student id." };
  }

  const parsed = studentUpdateSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    programmeId: formData.get("programmeId"),
    yearLevel: formData.get("yearLevel"),
    department: me.department,
    isActive: formData.get("isActive") === "on",
    mustChangePassword: formData.get("mustChangePassword") === "on",
  });
  if (!parsed.success) return { ok: false, error: zodToError(parsed.error) };

  await connectDB();
  if (!(await programmeInDept(parsed.data.programmeId, me.department))) {
    return { ok: false, error: "Selected programme is not in your department." };
  }

  try {
    const updated = await User.findOneAndUpdate(
      { _id: id, role: "student", department: me.department },
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
  const me = await requireAdminScope();
  if (!mongoose.Types.ObjectId.isValid(id)) return;
  await connectDB();
  const user = await User.findOne({
    _id: id,
    role: "student",
    department: me.department,
  });
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

export async function resetStudentPasswordAction(id: string): Promise<void> {
  const me = await requireAdminScope();
  if (!mongoose.Types.ObjectId.isValid(id)) return;
  await connectDB();
  const user = await User.findOne({
    _id: id,
    role: "student",
    department: me.department,
  });
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
  const me = await requireAdminScope();

  // Pre-fetch the programme code → ObjectId map ONCE, not per row.
  await connectDB();
  const programmes = await Programme.find({ department: me.department })
    .select("code")
    .lean();
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
          reason: `Programme code "${code}" not found in your department.`,
        };
      }

      const parsed = studentCreateSchema.safeParse({
        name: r.name,
        email: r.email,
        programmeId,
        yearLevel: r.yearlevel,
        department: me.department,
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
          department: me.department,
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
