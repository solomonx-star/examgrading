"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Programme } from "@/models/Programme";
import { Module } from "@/models/Module";
import { requireAdminScope } from "@/lib/admin-scope";
import {
  programmeCreateSchema,
  programmeUpdateSchema,
} from "@/lib/validators";
import { audit } from "@/lib/audit";
import {
  mongoDuplicateMessage,
  zodToError,
  type FormState,
} from "@/lib/form-state";

export async function createProgrammeAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await requireAdminScope();

  const parsed = programmeCreateSchema.safeParse({
    name: formData.get("name"),
    code: formData.get("code"),
    department: me.department, // forced server-side
  });
  if (!parsed.success) return { ok: false, error: zodToError(parsed.error) };

  await connectDB();
  let createdId: string;
  try {
    const doc = await Programme.create({
      name: parsed.data.name,
      code: parsed.data.code,
      department: me.department,
      isActive: true,
    });
    createdId = String(doc._id);
  } catch (err) {
    const dup = mongoDuplicateMessage(err);
    if (dup) return { ok: false, error: dup };
    return { ok: false, error: "Could not create programme." };
  }

  await audit({
    action: "programme.create",
    summary: `Created programme ${parsed.data.code} — ${parsed.data.name}`,
    entityType: "Programme",
    entityId: createdId,
  });
  revalidatePath("/admin/programmes");
  revalidatePath("/admin");
  redirect("/admin/programmes");
}

export async function updateProgrammeAction(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await requireAdminScope();
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return { ok: false, error: "Invalid programme id." };
  }

  const parsed = programmeUpdateSchema.safeParse({
    name: formData.get("name"),
    code: formData.get("code"),
    department: me.department,
    isActive: formData.get("isActive") === "on",
  });
  if (!parsed.success) return { ok: false, error: zodToError(parsed.error) };

  await connectDB();
  try {
    const updated = await Programme.findOneAndUpdate(
      { _id: id, department: me.department },
      {
        $set: {
          name: parsed.data.name,
          code: parsed.data.code,
          isActive: parsed.data.isActive,
        },
      },
      { returnDocument: "after" },
    );
    if (!updated) return { ok: false, error: "Programme not found." };
  } catch (err) {
    const dup = mongoDuplicateMessage(err);
    if (dup) return { ok: false, error: dup };
    return { ok: false, error: "Could not update programme." };
  }

  await audit({
    action: "programme.update",
    summary: `Updated programme ${parsed.data.code} — ${parsed.data.name}`,
    entityType: "Programme",
    entityId: id,
    metadata: { isActive: parsed.data.isActive },
  });
  revalidatePath("/admin/programmes");
  revalidatePath(`/admin/programmes/${id}`);
  return { ok: true, message: "Programme updated." };
}

export async function toggleProgrammeActiveAction(id: string): Promise<void> {
  const me = await requireAdminScope();
  if (!mongoose.Types.ObjectId.isValid(id)) return;
  await connectDB();
  const programme = await Programme.findOne({
    _id: id,
    department: me.department,
  });
  if (!programme) return;
  programme.isActive = !programme.isActive;
  await programme.save();
  await audit({
    action: programme.isActive ? "programme.activate" : "programme.deactivate",
    summary: `${programme.isActive ? "Activated" : "Deactivated"} programme ${programme.code} — ${programme.name}`,
    entityType: "Programme",
    entityId: id,
  });
  revalidatePath("/admin/programmes");
}

export async function deleteProgrammeAction(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const me = await requireAdminScope();
  if (!mongoose.Types.ObjectId.isValid(id)) return { ok: false, error: "Invalid id" };
  await connectDB();
  // Refuse delete if any module belongs to this programme
  const inUse = await Module.exists({ programmeId: id });
  if (inUse) {
    return {
      ok: false,
      error: "Programme has modules attached. Reassign or delete them first.",
    };
  }
  await Programme.deleteOne({ _id: id, department: me.department });
  await audit({
    action: "programme.delete",
    summary: `Deleted programme (id ${id})`,
    entityType: "Programme",
    entityId: id,
  });
  revalidatePath("/admin/programmes");
  return { ok: true };
}
