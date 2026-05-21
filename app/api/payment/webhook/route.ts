// Monime → server webhook. Mirrors the reference backend's plan.controller
// `handleWebhook`: respond fast, verify signature on the RAW body, then
// (idempotently) activate the access payment.

import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/monime";
import { handleAccessWebhookEvent } from "@/lib/payments-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // We read the body as raw text so HMAC verification works regardless of
  // whitespace / key ordering. JSON.parse the same string after verifying.
  let rawBody = "";
  try {
    rawBody = await req.text();
  } catch {
    return NextResponse.json({ success: true });
  }

  const hasSignature =
    req.headers.get("x-monime-signature") ||
    req.headers.get("x-webhook-signature") ||
    req.headers.get("monime-signature");

  if (!rawBody || !hasSignature) {
    console.warn(
      "[monime webhook] Missing raw body or signature header — rejecting",
    );
    return NextResponse.json({ success: true });
  }

  if (!verifyWebhookSignature(rawBody, req.headers)) {
    console.warn("[monime webhook] Invalid signature — rejecting");
    return NextResponse.json({ success: true });
  }

  let event: unknown = null;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ success: true });
  }

  // Fire-and-forget — Monime expects a fast 200, retries on non-2xx.
  Promise.resolve()
    .then(() =>
      handleAccessWebhookEvent(
        event as Parameters<typeof handleAccessWebhookEvent>[0],
      ),
    )
    .catch((err) => {
      console.error("[monime webhook] Error processing event:", err);
    });

  return NextResponse.json({ success: true });
}
