"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { auth } from "@/lib/auth";
import { academicPeriodSchema } from "@/lib/validators";
import {
  mongoDuplicateMessage,
  zodToError,
  type FormState,
} from "@/lib/form-state";
import { audit } from "@/lib/audit";

async function requireSuperAdmin() {
  const session = await auth();
  if (session?.user?.role !== "superadmin") {
    throw new Error("Forbidden");
  }
}

export async function createAcademicPeriodAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireSuperAdmin();

  const parsed = academicPeriodSchema.safeParse({
    year: formData.get("year"),
    semester: formData.get("semester"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    isCurrent: formData.get("isCurrent") === "on",
    accessFee: formData.get("accessFee") ?? 0,
  });
  if (!parsed.success) return { ok: false, error: zodToError(parsed.error) };

  const start = new Date(parsed.data.startDate);
  const end = new Date(parsed.data.endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { ok: false, error: "Invalid date(s)." };
  }
  if (end <= start) {
    return { ok: false, error: "End date must be after start date." };
  }

  await connectDB();
  let createdId: string;
  try {
    const doc = await AcademicPeriod.create({
      year: parsed.data.year,
      semester: parsed.data.semester,
      startDate: start,
      endDate: end,
      isCurrent: parsed.data.isCurrent ?? false,
      accessFee: parsed.data.accessFee ?? 0,
    });
    createdId = String(doc._id);
  } catch (err) {
    const dup = mongoDuplicateMessage(err);
    if (dup) return { ok: false, error: dup };
    return { ok: false, error: "Could not create academic period." };
  }

  await audit({
    action: "academic_period.create",
    summary: `Created academic period ${parsed.data.year} · ${parsed.data.semester}${parsed.data.isCurrent ? " (set as current)" : ""}`,
    entityType: "AcademicPeriod",
    entityId: createdId,
    metadata: { year: parsed.data.year, semester: parsed.data.semester, isCurrent: !!parsed.data.isCurrent },
  });
  revalidatePath("/superadmin/academic-periods");
  revalidatePath("/superadmin");
  redirect("/superadmin/academic-periods");
}

export async function setCurrentPeriodAction(id: string): Promise<void> {
  await requireSuperAdmin();
  if (!mongoose.Types.ObjectId.isValid(id)) return;

  await connectDB();
  const period = await AcademicPeriod.findById(id);
  if (!period) return;
  period.isCurrent = true; // pre-save hook unsets others
  await period.save();
  await audit({
    action: "academic_period.set_current",
    summary: `Set academic period ${period.year} · ${period.semester} as current`,
    entityType: "AcademicPeriod",
    entityId: id,
  });
  revalidatePath("/superadmin/academic-periods");
  revalidatePath("/superadmin");
}

export async function deletePeriodAction(id: string): Promise<void> {
  await requireSuperAdmin();
  if (!mongoose.Types.ObjectId.isValid(id)) return;

  await connectDB();
  const result = await AcademicPeriod.deleteOne({ _id: id, isCurrent: false });
  if (result.deletedCount) {
    await audit({
      action: "academic_period.delete",
      summary: `Deleted academic period (id ${id})`,
      entityType: "AcademicPeriod",
      entityId: id,
    });
  }
  revalidatePath("/superadmin/academic-periods");
}
