"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

export function PostHogIdentify({
  userId,
  email,
  name,
  role,
}: {
  userId: string;
  email?: string;
  name?: string;
  role?: string;
}) {
  useEffect(() => {
    if (!userId) return;
    posthog.identify(userId, { email, name, role });
  }, [userId, email, name, role]);

  return null;
}
