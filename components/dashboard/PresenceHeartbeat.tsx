"use client";

import { useEffect } from "react";

const INTERVAL_MS = 60_000;

export function PresenceHeartbeat() {
  useEffect(() => {
    let cancelled = false;
    const ping = () => {
      if (cancelled) return;
      fetch("/api/presence/heartbeat", {
        method: "POST",
        cache: "no-store",
        keepalive: true,
      }).catch(() => {});
    };
    ping();
    const id = setInterval(ping, INTERVAL_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") ping();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
  return null;
}
