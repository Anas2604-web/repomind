"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

let initialized = false;

export default function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (key && !initialized) {
      posthog.init(key, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
        capture_pageview: true,
      });
      initialized = true;
    }
  }, []);

  return <>{children}</>;
}

// Safe no-op if PostHog isn't configured yet — same dev-mode-passthrough
// pattern as the Groq key and Clerk auth: tracking turns on by adding the
// env var, no code changes needed.
export function trackEvent(name: string, properties?: Record<string, unknown>) {
  if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    posthog.capture(name, properties);
  }
}
