"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const REFRESH_INTERVAL_MS = 45_000;

/**
 * The admin pages are server-rendered, so the unread-notifications badge only changes on navigation.
 * Re-fetches the page in place (client state is kept) while the tab is visible, and immediately when
 * the tab becomes visible again, so a booking made while the barber looked elsewhere shows up without a manual reload.
 */
export function AdminAutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = setInterval(refreshIfVisible, REFRESH_INTERVAL_MS);
    document.addEventListener("visibilitychange", refreshIfVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [router]);

  return null;
}
