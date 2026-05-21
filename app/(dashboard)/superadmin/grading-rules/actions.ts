"use server";

import { revalidatePath } from "next/cache";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { GradingRule } from "@/models/GradingRule";
import { auth } from "@/lib/auth";
import { gradingRuleUpdateSchema } from "@/lib/validators";
import { zodToError, type FormState } from "@/lib/form-state";
import { audit } from "@/lib/audit";

async function requireSuperAdmin() {
  const session = await auth();
  if (session?.user?.role !== "superadmin") {
    throw new Error("Forbidden");
  }
}

function parseScale(formData: FormData) {
  // Bands are submitted as gradeScale[N][min|max|grade|gpa|remark]
  const bands: Array<{
    min: string;
    max: string;
    grade: string;
    gpa: string;
    remark: string;
  }> = [];
  for (const [key, value] of formData.entries()) {
    const m = key.match(/^gradeScale\[(\d+)\]\[(\w+)\]$/);
    if (!m) continue;
    const idx = Number(m[1]);
    const field = m[2] as keyof (typeof bands)[number];
    bands[idx] = bands[idx] ?? {
      min: "",
      max: "",
      grade: "",
      gpa: "",
      remark: "",
    };
    bands[idx][field] = String(value);
  }
  return bands.filter(Boolean);
}

export async function updateGradingRuleAction(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireSuperAdmin();
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return { ok: false, error: "Invalid rule id." };
  }

  const parsed = gradingRuleUpdateSchema.safeParse({
    name: formData.get("name"),
    caWeight: formData.get("caWeight"),
    examWeight: formData.get("examWeight"),
    attendanceThreshold: formData.get("attendanceThreshold"),
    gradeScale: parseScale(formData),
  });
  if (!parsed.success) return { ok: false, error: zodToError(parsed.error) };

  await connectDB();
  try {
    const rule = await GradingRule.findById(id);
    if (!rule) return { ok: false, error: "Rule not found." };
    rule.name = parsed.data.name;
    rule.caWeight = parsed.data.caWeight;
    rule.examWeight = parsed.data.examWeight;
    rule.attendanceThreshold = parsed.data.attendanceThreshold;
    rule.gradeScale = parsed.data.gradeScale;
    await rule.save();
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "Could not update grading rule.",
    };
  }

  await audit({
    action: "grading_rule.update",
    summary: `Updated grading rule "${parsed.data.name}" (CA ${parsed.data.caWeight}% / Exam ${parsed.data.examWeight}%, attendance ${parsed.data.attendanceThreshold}%)`,
    entityType: "GradingRule",
    entityId: id,
    metadata: {
      caWeight: parsed.data.caWeight,
      examWeight: parsed.data.examWeight,
      attendanceThreshold: parsed.data.attendanceThreshold,
      bands: parsed.data.gradeScale.length,
    },
  });
  revalidatePath("/superadmin/grading-rules");
  revalidatePath(`/superadmin/grading-rules/${id}`);
  return { ok: true, message: "Grading rule updated." };
}
