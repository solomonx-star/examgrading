"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { createAccessCheckoutAction } from "@/lib/actions/payment";
import { trackEvent, GA_EVENTS } from "@/lib/analytics";

export function PayAccessButton({
  amount,
  hasPending,
}: {
  amount: number;
  hasPending: boolean;
}) {
  const [pending, start] = useTransition();

  function pay() {
    trackEvent(GA_EVENTS.PAYMENT_START, {
      value: amount / 100,
      currency: "SLE",
      items: [{ item_name: "Exam Access" }],
    });
    start(async () => {
      const res = await createAccessCheckoutAction();
      if (!res.ok || !res.checkoutUrl || !res.sessionId) {
        toast.error(res.error ?? "Could not start payment.");
        trackEvent("payment_error", { error: res.error });
        return;
      }
      // Only redirect to Monime — never to an arbitrary host.
      let host = "";
      try {
        host = new URL(res.checkoutUrl).hostname;
      } catch {
        toast.error("Bad checkout URL.");
        return;
      }
      if (host !== "monime.io" && !host.endsWith(".monime.io")) {
        toast.error("Refusing redirect to an untrusted host.");
        return;
      }
      try {
        localStorage.setItem("monime_session_id", res.sessionId);
      } catch {
        /* ignore — verification can still recover via webhook */
      }
      window.location.href = res.checkoutUrl;
    });
  }

  return (
    <button
      type="button"
      onClick={pay}
      disabled={pending}
      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending
        ? "Redirecting…"
        : `Pay NLe ${amount.toLocaleString()} — Card / Mobile Money${
            hasPending ? " (resume)" : ""
          }`}
    </button>
  );
}
