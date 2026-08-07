import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/monime";
import { handleCreditsWebhookEvent } from "@/lib/credits-payment-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let rawBody = "";
  try {
    rawBody = await req.text();
  } catch {
    return NextResponse.json({ error: "Failed to read body" }, { status: 400 });
  }

  const hasSignature =
    req.headers.get("x-monime-signature") ||
    req.headers.get("x-webhook-signature") ||
    req.headers.get("monime-signature");

  if (!rawBody || !hasSignature) {
    const allHeaders = Object.fromEntries(req.headers.entries());
    console.warn("[credits webhook] Missing signature. Headers:", JSON.stringify(allHeaders));
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  // Debug: log all headers and the raw signature so we can fix the verification
  const allHeaders = Object.fromEntries(req.headers.entries());
  const sigHeader =
    req.headers.get("x-monime-signature") ||
    req.headers.get("x-webhook-signature") ||
    req.headers.get("monime-signature") ||
    "(none found)";
  console.log("[credits webhook] headers:", JSON.stringify(allHeaders));
  console.log("[credits webhook] signature header value:", sigHeader);
  console.log("[credits webhook] body length:", rawBody.length, "body preview:", rawBody.slice(0, 100));

  if (!verifyWebhookSignature(rawBody, req.headers)) {
    console.warn("[credits webhook] Invalid signature. MONIME_WEBHOOK_SECRET set:", !!process.env.MONIME_WEBHOOK_SECRET);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: unknown = null;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  Promise.resolve()
    .then(() =>
      handleCreditsWebhookEvent(
        event as Parameters<typeof handleCreditsWebhookEvent>[0],
      ),
    )
    .catch((err) => {
      console.error("[credits webhook] Error processing event:", err);
    });

  return NextResponse.json({ success: true });
}
