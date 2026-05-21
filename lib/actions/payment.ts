"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { requireStudentScope } from "@/lib/student-scope";
import {
  createAccessCheckout,
  recordManualAccessPayment,
  verifyAndActivateAccess,
} from "@/lib/payments-service";
import { audit } from "@/lib/audit";

const objectIdRe = /^[a-f\d]{24}$/i;

export async function createAccessCheckoutAction(): Promise<{
  ok: boolean;
  error?: string;
  checkoutUrl?: string;
  sessionId?: string;
  amount?: number;
}> {
  try {
    const me = await requireStudentScope();
    const result = await createAccessCheckout({
      studentId: me.userId,
      studentName: me.name,
    });
    await audit({
      action: "access_payment.checkout",
      summary: `Created Monime checkout session ${result.sessionId} for student ${me.name}`,
      entityType: "User",
      entityId: me.userId,
      metadata: { sessionId: result.sessionId, amount: result.amount },
    });
    return { ok: true, ...result };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not start checkout.",
    };
  }
}

export async function verifyAccessPaymentAction(args: {
  sessionId: string;
}): Promise<{ ok: boolean; error?: string; paymentId?: string }> {
  try {
    const me = await requireStudentScope();
    if (!args.sessionId || typeof args.sessionId !== "string") {
      return { ok: false, error: "Missing session id." };
    }
    const payment = await verifyAndActivateAccess(args.sessionId, me.userId);
    revalidatePath("/", "layout");
    return { ok: true, paymentId: payment ? String(payment._id) : undefined };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Verification failed.",
    };
  }
}

const manualSchema = z.object({
  studentId: z.string().regex(objectIdRe, "Invalid student id"),
  method: z.enum(["cash", "bank_transfer"]),
  reference: z.string().trim().max(120).optional().default(""),
  note: z.string().trim().max(500).optional().default(""),
});

export async function recordManualAccessPaymentAction(args: {
  studentId: string;
  method: "cash" | "bank_transfer";
  reference?: string;
  note?: string;
}): Promise<{ ok: boolean; error?: string; paymentId?: string }> {
  try {
    const session = await auth();
    if (session?.user?.role !== "superadmin") {
      return { ok: false, error: "Only a super admin can record payments." };
    }
    const parsed = manualSchema.safeParse(args);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
    }
    const payment = await recordManualAccessPayment(
      {
        studentId: parsed.data.studentId,
        method: parsed.data.method,
        reference: parsed.data.reference,
        note: parsed.data.note,
      },
      { userId: session.user.id },
    );
    await audit({
      action: "access_payment.manual",
      summary: `Recorded ${parsed.data.method} access payment for student ${parsed.data.studentId}`,
      entityType: "AccessPayment",
      entityId: payment ? String(payment._id) : undefined,
      metadata: {
        method: parsed.data.method,
        reference: parsed.data.reference,
      },
    });
    revalidatePath("/superadmin/access-payments");
    return { ok: true, paymentId: payment ? String(payment._id) : undefined };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not record payment.",
    };
  }
}
