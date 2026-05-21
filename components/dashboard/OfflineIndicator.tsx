"use client";

import { useEffect, useState } from "react";

export function OfflineIndicator() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    setOnline(navigator.onLine);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-30 flex items-center justify-center gap-2 bg-meta-1 px-4 py-1.5 text-xs font-semibold text-white shadow-sm print:hidden"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="h-3.5 w-3.5"
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 3l18 18M5.5 12.5a10 10 0 0 1 6-3.4M2 8.8A14 14 0 0 1 8 6m6.4.4A14 14 0 0 1 22 8.8m-3.5 3.7a10 10 0 0 0-2.7-1.7M12 19l.01 0"
        />
      </svg>
      You&rsquo;re offline. Some features may be unavailable.
    </div>
  );
}
