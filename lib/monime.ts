// Monime API client — TypeScript port of the reference backend's
// `src/services/monime.service.js` (collegemanagementsystembackend-main).
//
// Three responsibilities:
//   - createCheckoutSession: open a hosted-checkout session
//   - getCheckoutSession:    fetch its current status (used by verify)
//   - verifyWebhookSignature: HMAC-verify a webhook before trusting it
//
// All amounts on the wire are in MINOR units (cents). 100 minor units = 1 NLe.

import crypto from "crypto";

const BASE_URL = process.env.MONIME_BASE_URL || "https://api.monime.io";

function authHeaders(idempotencyKey?: string): HeadersInit {
  if (!process.env.MONIME_API_KEY) throw new Error("MONIME_API_KEY is not set");
  if (!process.env.MONIME_SPACE_ID) throw new Error("MONIME_SPACE_ID is not set");
  const headers: Record<string, string> = {
    Authorization: `Bearer ${process.env.MONIME_API_KEY}`,
    "Content-Type": "application/json",
    "Monime-Space-Id": process.env.MONIME_SPACE_ID,
  };
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  return headers;
}

export type CheckoutSession = {
  id: string;
  status: string;
  redirectUrl: string;
  reference?: string;
  metadata?: Record<string, string>;
};

type MonimeEnvelope<T> = {
  success: boolean;
  result?: T;
  error?: { message?: string };
};

export type CreateCheckoutInput = {
  name: string;
  description?: string;
  priceInMinorUnits: number;
  currency?: string;
  successUrl: string;
  cancelUrl: string;
  reference: string;
  metadata?: Record<string, string>;
};

export async function createCheckoutSession(
  input: CreateCheckoutInput,
): Promise<CheckoutSession> {
  const idempotencyKey = `checkout-${input.reference}`;
  const url = `${BASE_URL}/v1/checkout-sessions`;
  console.log("[monime] POST", url, "space:", process.env.MONIME_SPACE_ID?.slice(0, 8));
  const res = await fetch(url, {
    method: "POST",
    headers: authHeaders(idempotencyKey),
    body: JSON.stringify({
      name: input.name,
      ...(input.description && { description: input.description }),
      lineItems: [
        {
          type: "custom",
          name: input.name,
          price: {
            value: input.priceInMinorUnits,
            currency: input.currency ?? "SLE",
          },
          quantity: 1,
        },
      ],
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
      reference: input.reference,
      metadata: input.metadata,
    }),
  });
  const rawText = await res.text();
  let data: MonimeEnvelope<CheckoutSession>;
  try {
    data = JSON.parse(rawText) as MonimeEnvelope<CheckoutSession>;
  } catch {
    console.error("[monime] createCheckoutSession non-JSON response", res.status, rawText.slice(0, 500));
    throw new Error(`Monime returned a non-JSON response (HTTP ${res.status})`);
  }
  if (!data.success || !data.result) {
    console.error("[monime] createCheckoutSession error response", res.status, rawText.slice(0, 500));
    throw new Error(
      data.error?.message || "Failed to create Monime checkout session",
    );
  }
  return data.result;
}

export async function getCheckoutSession(
  sessionId: string,
): Promise<CheckoutSession> {
  const res = await fetch(`${BASE_URL}/v1/checkout-sessions/${sessionId}`, {
    headers: authHeaders(),
  });
  const rawText = await res.text();
  let data: MonimeEnvelope<CheckoutSession>;
  try {
    data = JSON.parse(rawText) as MonimeEnvelope<CheckoutSession>;
  } catch {
    console.error("[monime] getCheckoutSession non-JSON response", res.status, rawText.slice(0, 500));
    throw new Error(`Monime returned a non-JSON response (HTTP ${res.status})`);
  }
  if (!data.success || !data.result) {
    console.error("[monime] getCheckoutSession error response", res.status, rawText.slice(0, 500));
    throw new Error(data.error?.message || "Monime session not found");
  }
  return data.result;
}

/**
 * Constant-time HMAC verification of a Monime webhook. Callers MUST pass the
 * raw request body — not the parsed JSON — because any whitespace difference
 * will break the signature.
 *
 * Accepts the signature from any of three header names Monime has used.
 */
export function verifyWebhookSignature(
  rawBody: string,
  headers: Headers,
): boolean {
  const secret = process.env.MONIME_WEBHOOK_SECRET;
  if (!secret) return false;

  const signature =
    headers.get("x-monime-signature") ||
    headers.get("x-webhook-signature") ||
    headers.get("monime-signature") ||
    "";
  if (!signature) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature.replace(/^sha256=/, ""), "hex"),
      Buffer.from(expected, "hex"),
    );
  } catch {
    return false;
  }
}

export type MonimeWebhookEvent = {
  event?: { name?: string };
  object?: { id?: string };
  data?: {
    id?: string;
    metadata?: Record<string, string>;
    [k: string]: unknown;
  };
};
