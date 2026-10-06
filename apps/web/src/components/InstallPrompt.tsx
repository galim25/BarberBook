"use client";

import { useEffect, useState } from "react";
import { iosShareHint, isIos, isIosStandalone } from "@/lib/ios";

const DISMISSED_KEY = "pwa-install-dismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches || isIosStandalone()
  );
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosHint, setIosHint] = useState<string | null>(null);

  useEffect(() => {
    if (localStorage.getItem(DISMISSED_KEY) || isStandalone()) return;

    if (isIos()) {
      // Reading a browser-only global (navigator.userAgent) on mount — can't
      // move to render, this component is SSR'd where `window` doesn't exist.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIosHint(iosShareHint());
      return;
    }

    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, "1");
    setDeferredPrompt(null);
    setIosHint(null);
  }

  async function install() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setDeferredPrompt(null);
    localStorage.setItem(DISMISSED_KEY, "1");
  }

  if (!deferredPrompt && !iosHint) return null;

  return (
    <div className="fixed inset-x-4 bottom-4 z-50 flex items-center justify-between gap-3 rounded-xl border border-barber-teal bg-white p-4 shadow-lg">
      <p className="text-sm text-ink">
        {iosHint ?? "התקינו את BarberBook כדי לגשת אליה ישירות ממסך הבית"}
      </p>
      <div className="flex shrink-0 items-center gap-2">
        {!iosHint && (
          <button
            onClick={install}
            className="rounded-full bg-barber-teal px-4 py-2 text-sm font-medium text-cream-text"
          >
            התקנה
          </button>
        )}
        <button onClick={dismiss} className="text-sm text-slate-muted" aria-label="סגירה">
          ✕
        </button>
      </div>
    </div>
  );
}
