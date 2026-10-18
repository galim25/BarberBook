"use client";

import { useEffect, useRef, useState } from "react";

const CHECK_INTERVAL_MS = 5 * 60_000;
const MIN_RELOAD_GAP_MS = 60_000;
const LAST_RELOAD_KEY = "app-updater-last-reload";

/**
 * Keeps an open app (an installed PWA can stay alive in memory for days) from running an old build against a
 * newer server. After a deploy, an old page calls Server Actions whose ids no longer exist and screens fail
 * ("no barbers available", etc.) until someone happens to reload. `buildId` is the build this page was
 * rendered by; `/api/version` is the build the server runs now.
 *
 * - Checks on load, whenever the app comes back to the foreground / regains focus or network, and every 5 min.
 * - Coming back to the foreground on an old build reloads straight away (the user just returned, nothing is
 *   mid-air); a newer build discovered while the app is in use shows a small "refresh" banner instead.
 * - A Server Action failing with "Failed to find Server Action" triggers a check, so a stale page recovers by
 *   itself rather than staying broken.
 * - At most one automatic reload per minute, so a server that keeps reporting a different id cannot loop.
 */
export function AppUpdater({ buildId }: { buildId: string }) {
  const [stale, setStale] = useState(false);
  const staleRef = useRef(false);

  useEffect(() => {
    if (buildId === "dev") return;

    /** Reloads unless we already did within the last minute; returns whether a reload was started. */
    function reloadOnce(): boolean {
      try {
        const last = Number(sessionStorage.getItem(LAST_RELOAD_KEY) ?? 0);
        if (Date.now() - last < MIN_RELOAD_GAP_MS) return false;
        sessionStorage.setItem(LAST_RELOAD_KEY, String(Date.now()));
      } catch {
        // No sessionStorage: reload anyway, once per page load is all we do from here.
      }
      window.location.reload();
      return true;
    }

    async function check(autoReload: boolean) {
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const { id } = (await res.json()) as { id?: string };
        if (id && id !== buildId) {
          staleRef.current = true;
          // Reloading right away: no banner (it would only flash before the page goes away).
          if (autoReload && reloadOnce()) return;
          setStale(true);
        }
      } catch {
        // Offline or the server is restarting: try again at the next trigger.
      }
    }

    function onVisibility() {
      if (document.visibilityState !== "visible") return;
      if (staleRef.current) reloadOnce();
      else void check(true);
    }
    const onFocus = () => void check(true);
    function onFailure(e: Event) {
      const reason = (e as PromiseRejectionEvent).reason ?? (e as ErrorEvent).error ?? (e as ErrorEvent).message;
      const text = String((reason as { message?: string })?.message ?? reason ?? "");
      if (/server action/i.test(text)) void check(true);
    }

    void check(false);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void check(false);
    }, CHECK_INTERVAL_MS);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onFocus);
    window.addEventListener("unhandledrejection", onFailure);
    window.addEventListener("error", onFailure);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onFocus);
      window.removeEventListener("unhandledrejection", onFailure);
      window.removeEventListener("error", onFailure);
    };
  }, [buildId]);

  if (!stale) return null;
  return (
    <div
      role="status"
      className="border-barber-teal bg-white text-ink fixed inset-x-4 top-12 z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl border p-3 text-sm shadow-lg"
    >
      <span>יצאה גרסה חדשה של האפליקציה.</span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="bg-barber-teal text-cream-text shrink-0 rounded-full px-4 py-1 text-sm font-medium"
      >
        רענון
      </button>
    </div>
  );
}
