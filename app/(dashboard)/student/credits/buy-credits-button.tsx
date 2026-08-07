"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { buyCreditPackageAction } from "@/lib/actions/ai-credits";

export function BuyCreditsButton({
  packageId,
  label,
}: {
  packageId: string;
  label: string;
}) {
  const [pending, start] = useTransition();

  function buy() {
    start(async () => {
      const res = await buyCreditPackageAction(packageId);
      if (!res.ok || !res.checkoutUrl || !res.sessionId) {
        toast.error(res.error ?? "Could not start checkout.");
        return;
      }
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
        localStorage.setItem("monime_credits_session_id", res.sessionId);
      } catch {
        /* ignore */
      }
      window.location.href = res.checkoutUrl;
    });
  }

  return (
    <button
      type="button"
      onClick={buy}
      disabled={pending}
      className="mt-4 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Redirecting…" : label}
    </button>
  );
}
