"use client";

import posthog from "posthog-js";

/**
 * Standardized helper for sending events from client components.
 * Supports PostHog.
 */
export function trackEvent(action: string, params?: Record<string, any>) {
  // PostHog
  if (typeof window !== "undefined") {
    posthog.capture(action, params);
  }
}

/**
 * Common events used in the application.
 */
export const GA_EVENTS = {
  LOGIN: "login",
  LOGOUT: "logout",
  PAYMENT_START: "begin_checkout",
  PAYMENT_SUCCESS: "purchase",
  IMPORT_START: "import_start",
  IMPORT_COMPLETE: "import_complete",
} as const;
