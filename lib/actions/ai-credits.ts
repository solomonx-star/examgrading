"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { requireAdminScope } from "@/lib/admin-scope";
import { requireActiveStudentAccess } from "@/lib/student-scope";
import { topUpCredits, getBalance } from "@/lib/ai-credits-service";
import {
  createCreditsCheckout,
  verifyAndCreditPurchase,
} from "@/lib/credits-payment-service";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notifications";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";

const objectIdRe = /^[a-f\d]{24}$/i;

const topUpSchema = z.object({
  studentId: z.string().regex(objectIdRe, "Invalid student id"),
  amount: z.coerce
    .number()
    .int("Must be a whole number")
    .min(1, "Minimum top-up is 1 credit")
    .max(1000, "Maximum top-up is 1000 credits at a time"),
  note: z.string().trim().max(200).optional().default(""),
});

export async function addCreditsAction(args: {
  studentId: string;
  amount: number;
  note?: string;
}): Promise<{ ok: boolean; error?: string; balance?: number }> {
  try {
    const session = await auth();
    if (
      session?.user?.role !== "admin" &&
      session?.user?.role !== "superadmin"
    ) {
      return { ok: false, error: "Only admins can add credits." };
    }

    const parsed = topUpSchema.safeParse(args);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid input.",
      };
    }

    await connectDB();
    const student = await User.findOne({
      _id: parsed.data.studentId,
      role: "student",
    })
      .select("name")
      .lean();
    if (!student) return { ok: false, error: "Student not found." };

    const balance = await topUpCredits({
      studentId: parsed.data.studentId,
      amount: parsed.data.amount,
      note: parsed.data.note,
      actorId: session.user.id,
    });

    await audit({
      action: "ai_credits.topup",
      summary: `Added ${parsed.data.amount} AI credits to ${student.name} (balance now ${balance})`,
      entityType: "User",
      entityId: parsed.data.studentId,
      metadata: { amount: parsed.data.amount, balance, note: parsed.data.note },
    });

    await notify({
      userId: parsed.data.studentId,
      type: "ai_credits.topup",
      title: "AI credits added",
      body: `${parsed.data.amount} AI credit${parsed.data.amount === 1 ? "" : "s"} have been added to your account. New balance: ${balance}.`,
      link: "/student/credits",
    });

    revalidatePath(`/admin/students/${parsed.data.studentId}`);
    revalidatePath("/student/credits");
    revalidatePath("/student/access");

    return { ok: true, balance };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not add credits.",
    };
  }
}

export async function getMyBalanceAction(): Promise<{
  ok: boolean;
  balance?: number;
  error?: string;
}> {
  try {
    const me = await requireActiveStudentAccess();
    const balance = await getBalance(me.userId);
    return { ok: true, balance };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not fetch balance.",
    };
  }
}

export async function buyCreditPackageAction(packageId: string): Promise<{
  ok: boolean;
  checkoutUrl?: string;
  sessionId?: string;
  error?: string;
}> {
  try {
    const me = await requireActiveStudentAccess();
    const result = await createCreditsCheckout({
      studentId: me.userId,
      packageId,
    });
    return { ok: true, checkoutUrl: result.checkoutUrl, sessionId: result.sessionId };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not start checkout.",
    };
  }
}

export async function verifyCreditPurchaseAction(args: {
  sessionId: string;
}): Promise<{ ok: boolean; credits?: number; balance?: number; error?: string }> {
  try {
    await requireActiveStudentAccess();
    const result = await verifyAndCreditPurchase(args.sessionId);
    if (result.ok) {
      revalidatePath("/student/credits");
    }
    return result;
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Verification failed.",
    };
  }
}
