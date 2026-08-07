// Server-only payments service. Ports the lifecycle from the reference
// backend's `src/services/plan.service.js`:
//
//   - createAccessCheckout      : start a Monime hosted-checkout session
//   - verifyAndActivate         : success-page path; idempotent
//   - handleWebhookEvent        : webhook path; idempotent
//   - recordManualAccessPayment : admin records cash / bank transfer
//
// Activation is idempotent so a duplicate webhook OR a repeated /verify call
// cannot double-credit access.

import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { AccessPayment } from "@/models/AccessPayment";
import { AcademicPeriod, type IAcademicPeriod } from "@/models/AcademicPeriod";
import { User } from "@/models/User";
import {
  createCheckoutSession,
  getCheckoutSession,
  type MonimeWebhookEvent,
} from "@/lib/monime";
import { notify } from "@/lib/notifications";

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

async function getCurrentPeriod(): Promise<IAcademicPeriod | null> {
  await connectDB();
  return AcademicPeriod.findOne({ isCurrent: true }).lean();
}

/** Resolve the access fee for a given period. */
export function periodAccessFee(period: IAcademicPeriod): number {
  return Math.max(0, Number(period.accessFee ?? 0));
}

/**
 * True when the student has a completed AccessPayment for the period — i.e.
 * they may use the gated areas of the system.
 */
export async function studentHasAccess(
  studentId: string,
  periodId: string,
): Promise<boolean> {
  if (
    !mongoose.Types.ObjectId.isValid(studentId) ||
    !mongoose.Types.ObjectId.isValid(periodId)
  ) {
    return false;
  }
  await connectDB();
  const exists = await AccessPayment.exists({
    student: studentId,
    period: periodId,
    status: "completed",
  });
  return !!exists;
}

export type AccessBillingSummary = {
  period: {
    id: string;
    year: string;
    semester: "First" | "Second" | "Summer";
    accessFee: number;
    startDate: string;
    endDate: string;
  } | null;
  hasActiveAccess: boolean;
  pendingPaymentId: string | null;
};

export async function getStudentAccessSummary(
  studentId: string,
): Promise<AccessBillingSummary> {
  const period = await getCurrentPeriod();
  if (!period) {
    return { period: null, hasActiveAccess: false, pendingPaymentId: null };
  }
  const periodId = String(period._id);
  const [completed, pending] = await Promise.all([
    AccessPayment.exists({
      student: studentId,
      period: periodId,
      status: "completed",
    }),
    AccessPayment.findOne({
      student: studentId,
      period: periodId,
      status: "pending",
      channel: "online",
    })
      .select("_id")
      .lean(),
  ]);
  return {
    period: {
      id: periodId,
      year: period.year,
      semester: period.semester,
      accessFee: periodAccessFee(period),
      startDate: period.startDate.toISOString(),
      endDate: period.endDate.toISOString(),
    },
    hasActiveAccess: !!completed,
    pendingPaymentId: pending ? String(pending._id) : null,
  };
}

// ─── Online checkout (Monime) ──────────────────────────────────────────────
export async function createAccessCheckout(args: {
  studentId: string;
  studentName: string;
}): Promise<{ checkoutUrl: string; sessionId: string; amount: number }> {
  const period = await getCurrentPeriod();
  if (!period) throw new Error("No current academic period set.");
  const fee = periodAccessFee(period);
  if (fee <= 0) throw new Error("No access fee is configured for this period.");

  await connectDB();
  // Idempotency at the business level: re-use an existing pending payment if
  // there is one — avoids creating phantom checkout sessions.
  const existing = await AccessPayment.findOne({
    student: args.studentId,
    period: period._id,
    status: "pending",
    channel: "online",
  });

  const payment =
    existing ??
    (await AccessPayment.create({
      student: args.studentId,
      period: period._id,
      academicYear: period.year,
      semester: period.semester,
      amount: fee,
      method: "card",
      channel: "online",
      status: "pending",
    }));

  const slug = slugify(args.studentName || "student");
  const reference = `${slug}-access-${payment._id}`;

  try {
    const session = await createCheckoutSession({
      name: `System access — ${period.year} · ${period.semester}`,
      description: `Access fee for ${args.studentName || "student"}`,
      priceInMinorUnits: Math.round(fee * 100),
      currency: "SLE",
      successUrl: `${appUrl()}/api/payment/success`,
      cancelUrl: `${appUrl()}/api/payment/cancel`,
      reference,
      metadata: {
        accessPaymentId: String(payment._id),
        studentId: args.studentId,
        periodId: String(period._id),
        academicYear: period.year,
        semester: period.semester,
      },
    });

    payment.monimeSessionId = session.id;
    payment.reference = reference;
    await payment.save();

    return {
      checkoutUrl: session.redirectUrl,
      sessionId: session.id,
      amount: fee,
    };
  } catch (err) {
    payment.status = "failed";
    await payment.save();
    throw err;
  }
}

// ─── Shared activation (idempotent) ────────────────────────────────────────
async function activateAccess(
  accessPaymentId: string,
  actorId: string | null = null,
) {
  await connectDB();
  const payment = await AccessPayment.findById(accessPaymentId);
  if (!payment) throw new Error("Access payment not found");
  if (payment.status === "completed") return payment;

  const year = new Date().getFullYear();
  const seq = String(
    (await AccessPayment.countDocuments({ status: "completed" })) + 1,
  ).padStart(5, "0");

  payment.status = "completed";
  payment.receiptNumber = `ACC-${year}-${seq}`;
  payment.paidAt = new Date();
  if (actorId && !payment.recordedBy) {
    payment.recordedBy = new mongoose.Types.ObjectId(actorId);
  }
  await payment.save();

  await notify({
    userId: String(payment.student),
    type: "access.activated",
    title: "System access activated",
    body: `Your access for ${payment.academicYear} · ${payment.semester} is active. Receipt ${payment.receiptNumber}.`,
    link: `/student/access/receipt/${String(payment._id)}`,
    metadata: {
      paymentId: String(payment._id),
      academicYear: payment.academicYear,
      semester: payment.semester,
    },
  });

  return payment;
}

// ─── Verify (success page path) ────────────────────────────────────────────
export async function verifyAndActivateAccess(
  sessionId: string,
  studentId: string,
) {
  await connectDB();
  const payment = await AccessPayment.findOne({ monimeSessionId: sessionId });
  if (!payment) throw new Error("Payment record not found");
  if (String(payment.student) !== studentId) {
    throw new Error("Not your payment");
  }

  if (payment.status !== "completed") {
    const session = await getCheckoutSession(sessionId);
    if (session.status !== "completed") {
      throw new Error(`Payment not completed. Status: ${session.status}`);
    }
    await activateAccess(String(payment._id), studentId);
  }

  return AccessPayment.findById(payment._id).lean();
}

// ─── Webhook (Monime → backend, async, idempotent) ─────────────────────────
export async function handleAccessWebhookEvent(event: MonimeWebhookEvent) {
  if (event?.type !== "checkout_session.completed") return;
  const accessPaymentId = event?.data?.metadata?.accessPaymentId;
  if (!accessPaymentId || typeof accessPaymentId !== "string") return;
  await activateAccess(accessPaymentId, null);
}

// ─── Manual payment (cash / bank transfer, recorded by an admin) ───────────
export async function recordManualAccessPayment(
  input: {
    studentId: string;
    method: "cash" | "bank_transfer";
    reference?: string;
    note?: string;
  },
  actor: { userId: string },
) {
  if (!mongoose.Types.ObjectId.isValid(input.studentId)) {
    throw new Error("Invalid student id");
  }
  if (!["cash", "bank_transfer"].includes(input.method)) {
    throw new Error("Method must be cash or bank_transfer");
  }

  const period = await getCurrentPeriod();
  if (!period) throw new Error("No current academic period set.");
  const fee = periodAccessFee(period);
  if (fee <= 0) throw new Error("No access fee is configured for this period.");

  await connectDB();
  const student = await User.findOne({ _id: input.studentId, role: "student" })
    .select("_id name")
    .lean();
  if (!student) throw new Error("Student not found");

  // If the student already paid for this period, no-op — return the existing
  // payment so the admin sees a sensible result.
  const existingCompleted = await AccessPayment.findOne({
    student: input.studentId,
    period: period._id,
    status: "completed",
  }).lean();
  if (existingCompleted) return existingCompleted;

  const payment = await AccessPayment.create({
    student: input.studentId,
    period: period._id,
    academicYear: period.year,
    semester: period.semester,
    amount: fee,
    method: input.method,
    channel: "manual",
    status: "pending",
    reference: input.reference ?? "",
    note: input.note ?? "",
    recordedBy: new mongoose.Types.ObjectId(actor.userId),
  });

  await activateAccess(String(payment._id), actor.userId);
  return AccessPayment.findById(payment._id).lean();
}
