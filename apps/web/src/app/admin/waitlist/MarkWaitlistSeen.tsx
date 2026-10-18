"use client";

import { useEffect } from "react";
import { markWaitlistJoinsReadAction } from "@/lib/actions/adminNotifications";

/**
 * Marks new waitlist sign-ups as seen once the barber really opens the page. Done from the browser (not while
 * the page renders) so a link prefetch cannot clear the badge on /admin without a visit.
 */
export function MarkWaitlistSeen({ unread }: { unread: number }) {
  useEffect(() => {
    if (unread > 0) void markWaitlistJoinsReadAction();
  }, [unread]);
  return null;
}
