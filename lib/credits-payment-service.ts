import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { CreditPurchase } from "@/models/CreditPurchase";
import { topUpCredits } from "@/lib/ai-credits-service";
import {
  createCheckoutSession,
  getCheckoutSession,
  type MonimeWebhookEvent,
} from "@/lib/monime";
import { notify } from "@/lib/notifications";
import { appUrl } from "@/lib/app-url";

export type CreditPackage = {
  id: string;
  credits: number;
  priceInMinorUnits: number;
  label: string;
};

export const CREDIT_PACKAGES: CreditPackage[] = [
  { id: "starter", credits: 10, priceInMinorUnits: 500, label: "Starter" },
  { id: "standard", credits: 30, priceInMinorUnits: 1200, label: "Standard" },
  { id: "pro", credits: 60, priceInMinorUnits: 2000, label: "Pro" },
];

export async function createCreditsCheckout(args: {
  studentId: string;
  packageId: string;
}): Promise<{ checkoutUrl: string; sessionId: string; credits: number; amount: number }> {
  const pkg = CREDIT_PACKAGES.find((p) => p.id === args.packageId);
  if (!pkg) throw new Error("Invalid credit package.");

  await connectDB();

  const purchaseId = new mongoose.Types.ObjectId();
  const purchase = await CreditPurchase.create({
    _id: purchaseId,
    student: new mongoose.Types.ObjectId(args.studentId),
    credits: pkg.credits,
    amount: pkg.priceInMinorUnits,
    checkoutSessionId: `pending-${purchaseId}`,
    status: "pending",
  });

  const reference = `credits-${purchase._id}`;
  const session = await createCheckoutSession({
    name: `AI Credits — ${pkg.label} Pack (${pkg.credits} credits)`,
    description: `${pkg.credits} AI credits for exam management portal`,
    priceInMinorUnits: pkg.priceInMinorUnits,
    successUrl: `${appUrl()}/api/payment/credits/success`,
    cancelUrl: `${appUrl()}/student/credits/cancel`,
    reference,
    metadata: {
      type: "credits",
      studentId: args.studentId,
      purchaseId: String(purchase._id),
      credits: String(pkg.credits),
    },
  });

  await CreditPurchase.findByIdAndUpdate(purchase._id, {
    checkoutSessionId: session.id,
  });

  return { checkoutUrl: session.redirectUrl, sessionId: session.id, credits: pkg.credits, amount: pkg.priceInMinorUnits };
}

export async function verifyAndCreditPurchase(
  checkoutSessionId: string,
): Promise<{ ok: boolean; credits?: number; balance?: number; error?: string }> {
  if (!checkoutSessionId) return { ok: false, error: "Missing session ID." };

  await connectDB();

  const purchase = await CreditPurchase.findOne({ checkoutSessionId });
  if (!purchase) return { ok: false, error: "Purchase record not found." };
  if (purchase.status === "paid") {
    return { ok: true, credits: purchase.credits };
  }

  let session;
  try {
    session = await getCheckoutSession(checkoutSessionId);
  } catch {
    return { ok: false, error: "Could not reach payment provider." };
  }

  if (session.status !== "completed" && session.status !== "paid") {
    return { ok: false, error: "Payment not yet completed." };
  }

  // Idempotent — only credit once.
  const updated = await CreditPurchase.findOneAndUpdate(
    { _id: purchase._id, status: "pending" },
    { status: "paid" },
    { new: true },
  );
  if (!updated) return { ok: true, credits: purchase.credits };

  const balance = await topUpCredits({
    studentId: String(purchase.student),
    amount: purchase.credits,
    note: `Online purchase (${purchase.credits} credits, session ${checkoutSessionId})`,
    actorId: null,
    reason: "topup.purchase",
  });

  await notify({
    userId: String(purchase.student),
    type: "ai_credits.topup",
    title: "AI credits added",
    body: `${purchase.credits} AI credit${purchase.credits === 1 ? "" : "s"} added via online purchase. New balance: ${balance}.`,
    link: "/student/credits",
  });

  return { ok: true, credits: purchase.credits, balance };
}

export async function handleCreditsWebhookEvent(event: MonimeWebhookEvent) {
  const type = event?.event?.name;
  if (!type) return;

  const purchaseId = event?.data?.metadata?.purchaseId;
  if (!purchaseId || typeof purchaseId !== "string") return;

  // The session ID this webhook is about (from the envelope).
  const webhookSessionId = event?.object?.id ?? (event?.data?.id as string | undefined);

  await connectDB();
  const purchase = await CreditPurchase.findById(purchaseId);
  if (!purchase) return;

  if (type === "checkout_session.completed") {
    await verifyAndCreditPurchase(purchase.checkoutSessionId);
    return;
  }

  if (type === "checkout_session.expired" || type === "checkout_session.cancelled") {
    // Only fail if this webhook is for the session we currently have on record —
    // guards against stale webhooks from a previous session for the same purchase.
    await CreditPurchase.findOneAndUpdate(
      {
        _id: purchase._id,
        status: "pending",
        ...(webhookSessionId ? { checkoutSessionId: webhookSessionId } : {}),
      },
      { status: "failed" },
    );
  }
}
