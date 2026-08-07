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
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  if (!verifyWebhookSignature(rawBody, req.headers)) {
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
