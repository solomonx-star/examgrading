"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { verifyCreditPurchaseAction } from "@/lib/actions/ai-credits";

export default function CreditPurchaseSuccessPage() {
  const [state, setState] = useState<"verifying" | "success" | "error">("verifying");
  const [credits, setCredits] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let sessionId = "";
    try {
      sessionId = localStorage.getItem("monime_credits_session_id") ?? "";
    } catch {
      /* ignore */
    }
    if (!sessionId) {
      setErrorMsg("Missing session reference — cannot verify payment.");
      setState("error");
      return;
    }
    verifyCreditPurchaseAction({ sessionId })
      .then((res) => {
        if (!res.ok) {
          setErrorMsg(res.error ?? "Verification failed.");
          setState("error");
          return;
        }
        try {
          localStorage.removeItem("monime_credits_session_id");
        } catch {
          /* ignore */
        }
        setCredits(res.credits ?? 0);
        setState("success");
      })
      .catch(() => {
        setErrorMsg("Unexpected error during verification.");
        setState("error");
      });
  }, []);

  if (state === "verifying") {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-body">Verifying your payment…</p>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-meta-1/30 bg-meta-1/5 p-8 text-center">
        <p className="text-lg font-semibold text-meta-1">Verification failed</p>
        <p className="mt-2 text-sm text-body">{errorMsg}</p>
        <p className="mt-3 text-sm text-body">
          Your payment may still have gone through — credits will appear automatically once confirmed.
        </p>
        <Link
          href="/student/credits"
          className="mt-6 inline-block rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white"
        >
          Back to credits
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-meta-3/30 bg-meta-3/5 p-8 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-meta-3/10">
        <span className="text-2xl">✓</span>
      </div>
      <p className="text-lg font-semibold text-meta-3">Payment successful!</p>
      <p className="mt-2 text-sm text-body">
        <span className="font-semibold text-foreground">{credits} AI credit{credits === 1 ? "" : "s"}</span>{" "}
        have been added to your account.
      </p>
      <Link
        href="/student/credits"
        className="mt-6 inline-block rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white"
      >
        View my credits
      </Link>
    </div>
  );
}
