"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { Notification } from "@/models/Notification";
import { auth } from "@/lib/auth";
import { DEFAULT_PASSWORD } from "@/lib/constants";
import {
  adminCreateSchema,
  adminUpdateSchema,
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

async function requireSuperAdmin() {
  const session = await auth();
  if (session?.user?.role !== "superadmin") {
    throw new Error("Forbidden");
  }
  return session;
}

export async function createAdminAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireSuperAdmin();

  const parsed = adminCreateSchema.safeParse({
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
      role: "admin",
      password: DEFAULT_PASSWORD,
      isActive: true,
      mustChangePassword: true,
    });
    createdId = String(doc._id);
  } catch (err) {
    const dup = mongoDuplicateMessage(err);
    if (dup) return { ok: false, error: dup };
    return { ok: false, error: "Could not create admin." };
  }

  await audit({
    action: "admin.create",
    summary: `Created admin ${parsed.data.name} (${parsed.data.email})`,
    entityType: "User",
    entityId: createdId,
  });
  revalidatePath("/superadmin/admins");
  revalidatePath("/superadmin");
  redirect("/superadmin/admins");
}

export async function updateAdminAction(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireSuperAdmin();
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return { ok: false, error: "Invalid admin id." };
  }

  const parsed = adminUpdateSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    staffId: formData.get("staffId"),
    isActive: formData.get("isActive") === "on",
    mustChangePassword: formData.get("mustChangePassword") === "on",
  });
  if (!parsed.success) return { ok: false, error: zodToError(parsed.error) };

  await connectDB();
  try {
    const user = await User.findOneAndUpdate(
      { _id: id, role: "admin" },
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
    if (!user) return { ok: false, error: "Admin not found." };
  } catch (err) {
    const dup = mongoDuplicateMessage(err);
    if (dup) return { ok: false, error: dup };
    return { ok: false, error: "Could not update admin." };
  }

  await audit({
    action: "admin.update",
    summary: `Updated admin ${parsed.data.name} (${parsed.data.email})`,
    entityType: "User",
    entityId: id,
    metadata: { isActive: parsed.data.isActive },
  });
  revalidatePath("/superadmin/admins");
  revalidatePath(`/superadmin/admins/${id}`);
  return { ok: true, message: "Admin updated." };
}

export async function toggleAdminActiveAction(id: string): Promise<void> {
  await requireSuperAdmin();
  if (!mongoose.Types.ObjectId.isValid(id)) return;
  await connectDB();
  const user = await User.findOne({ _id: id, role: "admin" });
  if (!user) return;
  user.isActive = !user.isActive;
  await user.save();
  await audit({
    action: user.isActive ? "admin.activate" : "admin.deactivate",
    summary: `${user.isActive ? "Activated" : "Deactivated"} admin ${user.name} (${user.email})`,
    entityType: "User",
    entityId: id,
  });
  revalidatePath("/superadmin/admins");
}

export async function deleteAdminAction(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireSuperAdmin();
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return { ok: false, error: "Invalid admin id." };
  }
  if (session.user?.id === id) {
    return { ok: false, error: "You can't delete your own account." };
  }
  await connectDB();
  const user = await User.findOne({ _id: id, role: "admin" })
    .select("name email")
    .lean();
  if (!user) return { ok: false, error: "Admin not found." };

  const adminOid = new mongoose.Types.ObjectId(id);
  await Notification.deleteMany({ userId: adminOid });
  await User.deleteOne({ _id: adminOid });

  await audit({
    action: "admin.delete",
    summary: `Deleted admin ${user.name} (${user.email})`,
    entityType: "User",
    entityId: id,
  });
  revalidatePath("/superadmin/admins");
  revalidatePath("/superadmin");
  return { ok: true };
}

export async function resetAdminPasswordAction(id: string): Promise<void> {
  await requireSuperAdmin();
  if (!mongoose.Types.ObjectId.isValid(id)) return;
  await connectDB();
  const user = await User.findOne({ _id: id, role: "admin" });
  if (!user) return;
  user.password = DEFAULT_PASSWORD;
  user.mustChangePassword = true;
  await user.save();
  await audit({
    action: "admin.password.reset",
    summary: `Reset password for admin ${user.name} (${user.email})`,
    entityType: "User",
    entityId: id,
  });
  revalidatePath("/superadmin/admins");
}

export async function bulkImportAdminsAction(
  _prev: BulkImportState,
  formData: FormData,
): Promise<BulkImportState> {
  await requireSuperAdmin();

  const state = await processCsvImport({
    formData,
    requiredColumns: ["name", "email"],
    processRow: (r) => {
      const parsed = adminCreateSchema.safeParse({
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
          role: "admin",
          password: DEFAULT_PASSWORD,
          isActive: true,
          mustChangePassword: true,
        },
      };
    },
  });

  if (state?.ok) {
    revalidatePath("/superadmin/admins");
    revalidatePath("/superadmin");
    const r = state.result;
    await audit({
      action: "admin.bulk_import",
      summary: `Bulk-imported admins: ${r.created} created, ${r.skipped.length} skipped, ${r.failed.length} failed`,
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
