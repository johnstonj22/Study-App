"use client";

import { useEffect } from "react";
import { syncTimezoneAction } from "@/app/(app)/timezone-action";

// Detects the browser's IANA timezone and asks the server to persist it on
// the profile if it differs from the stored value. Runs once per browser
// session (gated by sessionStorage) so we don't spam the action on every
// in-app navigation. Renders nothing.
const SESSION_KEY = "tz-synced";

export function TimezoneSync() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.sessionStorage.getItem(SESSION_KEY) === "1") return;

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz) return;

    syncTimezoneAction(tz)
      .then(() => window.sessionStorage.setItem(SESSION_KEY, "1"))
      .catch(() => {
        // Silent. If the network blip means the action didn't land, the next
        // session attempt will try again — no user-visible failure mode.
      });
  }, []);

  return null;
}
