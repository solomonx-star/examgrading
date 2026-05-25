"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { useEffect } from "react";

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";
    
    if (key && typeof window !== "undefined") {
      posthog.init(key, {
        api_host: host,
        person_profiles: "identified_only", // Recommended for newer PostHog projects
        capture_pageview: false, // We'll handle this manually for better accuracy in SPAs
      });
    }
  }, []);

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
