"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { verifyAccessPaymentAction } from "@/lib/actions/payment";
import { trackEvent, GA_EVENTS } from "@/lib/analytics";

export default function AccessSuccessPage() {
  const router = useRouter();
  const [state, setState] = useState<"verifying" | "success" | "error">(
    "verifying",
  );
  const [receiptId, setReceiptId] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let sessionId = "";
    try {
      sessionId = localStorage.getItem("monime_session_id") ?? "";
    } catch {
      /* ignore */
    }
    if (!sessionId) {
      setErrorMsg("Missing session reference — cannot verify payment.");
      setState("error");
      return;
    }
    verifyAccessPaymentAction({ sessionId })
      .then((res) => {
        if (!res.ok) {
          setErrorMsg(res.error ?? "Verification failed.");
          setState("error");
          trackEvent("payment_verification_failure", { error: res.error });
          return;
        }
        try {
          localStorage.removeItem("monime_session_id");
        } catch {
          /* ignore */
        }
        if (res.paymentId) setReceiptId(res.paymentId);
        setState("success");
        trackEvent(GA_EVENTS.PAYMENT_SUCCESS, {
          transaction_id: res.paymentId,
          currency: "SLE",
          items: [{ item_name: "Exam Access" }],
        });
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Unexpected error.";
        setErrorMsg(msg);
        setState("error");
        trackEvent("payment_verification_error", { error: msg });
      });
  }, []);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-stroke bg-white p-6 text-center shadow-sm">
        {state === "verifying" && (
          <>
            <h2 className="text-lg font-semibold text-foreground">
              Verifying your payment…
            </h2>
            <p className="mt-2 text-sm text-body">
              Please wait, do not close this page.
            </p>
          </>
        )}
        {state === "success" && (
          <>
            <h2 className="text-xl font-semibold text-meta-3">
              Payment successful
            </h2>
            <p className="mt-2 text-sm text-body">
              Your system access is now active.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {receiptId && (
                <button
                  type="button"
                  onClick={() =>
                    router.push(`/student/access/receipt/${receiptId}`)
                  }
                  className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-dark"
                >
                  View receipt
                </button>
              )}
              <button
                type="button"
                onClick={() => router.replace("/student")}
                className="inline-flex items-center rounded-lg border border-stroke px-4 py-2 text-sm font-medium text-body hover:border-primary hover:text-primary"
              >
                Go to dashboard
              </button>
            </div>
          </>
        )}
        {state === "error" && (
          <>
            <h2 className="text-xl font-semibold text-meta-1">
              Verification failed
            </h2>
            <p className="mt-2 text-sm text-body">{errorMsg}</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => router.replace("/student/access")}
                className="inline-flex items-center rounded-lg border border-stroke px-4 py-2 text-sm font-medium text-body hover:border-primary hover:text-primary"
              >
                Back to payment
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
