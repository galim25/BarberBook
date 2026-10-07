"use client";

import { useEffect, useState } from "react";
import { subscribeToPushAction, unsubscribeFromPushAction } from "@/lib/actions/push";
import { isIos, isIosStandalone } from "@/lib/ios";
import { subscriptionUsesKey, urlBase64ToUint8Array } from "@/lib/pushKey";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function isStandaloneIos() {
  return isIos() && !isIosStandalone();
}

async function saveSubscription(subscription: PushSubscription) {
  const json = subscription.toJSON();
  return subscribeToPushAction({
    endpoint: json.endpoint!,
    keys: { p256dh: json.keys!.p256dh, auth: json.keys!.auth },
  });
}

/**
 * The browser's own subscription is what decides "on", but the server row and the VAPID key can
 * drift from it (row deleted after a 404/410, key changed by a deploy) — the toggle then says "on"
 * while nothing arrives and the barber has to switch it off and on by hand (2026-10-07). So on every
 * visit, once per tab session: re-subscribe if the key is stale, otherwise re-send the subscription
 * (an idempotent upsert). Returns whether the device is still subscribed afterwards.
 */
async function healSubscription(registration: ServiceWorkerRegistration, existing: PushSubscription): Promise<boolean> {
  const key = urlBase64ToUint8Array(VAPID_PUBLIC_KEY!);
  if (subscriptionUsesKey(existing.options.applicationServerKey, key)) {
    await saveSubscription(existing);
    return true;
  }
  await unsubscribeFromPushAction(existing.endpoint);
  await existing.unsubscribe();
  const fresh = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: key as BufferSource,
  });
  return !(await saveSubscription(fresh)).error;
}

const HEALED_FLAG = "push-subscription-healed";
async function alreadyHealedThisSession() {
  try {
    return sessionStorage.getItem(HEALED_FLAG) === "1";
  } catch {
    return false;
  }
}
function markHealedThisSession() {
  try {
    sessionStorage.setItem(HEALED_FLAG, "1");
  } catch {}
}

type Status = "checking" | "unsupported" | "ios-not-installed" | "off" | "on" | "denied";

export function PushNotificationToggle({ audience }: { audience: "admin" | "customer" }) {
  const [status, setStatus] = useState<Status>("checking");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    async function check() {
      if (!VAPID_PUBLIC_KEY) {
        // Server-side misconfiguration, not a browser limitation: the key is
        // inlined at build time, so a Docker image built without the
        // NEXT_PUBLIC_VAPID_PUBLIC_KEY build arg lands here and the whole
        // toggle disappears — which looks exactly like "the device doesn't
        // support notifications". Say so out loud so it's diagnosable from
        // the browser console instead of being invisible.
        console.warn("[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY missing from this build — notifications cannot be enabled.");
        setStatus("unsupported");
        return;
      }
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setStatus("unsupported");
        return;
      }
      if (isStandaloneIos()) {
        setStatus("ios-not-installed");
        return;
      }
      if (Notification.permission === "denied") {
        setStatus("denied");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      if (existing && !(await alreadyHealedThisSession())) {
        try {
          setStatus((await healSubscription(registration, existing)) ? "on" : "off");
          markHealedThisSession();
          return;
        } catch {
          // Offline or the server action failed: fall through to what the browser says now; retry next visit.
        }
      }
      setStatus((await registration.pushManager.getSubscription()) ? "on" : "off");
    }
    check().catch(() => setStatus("unsupported"));
  }, []);

  async function turnOn() {
    if (!VAPID_PUBLIC_KEY) return;
    setPending(true);
    setError(undefined);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });
      const result = await saveSubscription(subscription);
      if (result.error) {
        setError(result.error);
        return;
      }
      setStatus("on");
    } catch {
      setError("לא ניתן היה להפעיל התראות במכשיר זה");
    } finally {
      setPending(false);
    }
  }

  async function turnOff() {
    setPending(true);
    setError(undefined);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await unsubscribeFromPushAction(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setStatus("off");
    } catch {
      setError("לא ניתן היה לכבות התראות במכשיר זה");
    } finally {
      setPending(false);
    }
  }

  if (status === "checking" || status === "unsupported") return null;

  return (
    <div className="border-barber-teal rounded-xl border bg-white p-3 text-sm">
      <p className="text-ink font-bold">התראות למכשיר זה</p>
      {status === "ios-not-installed" && (
        <p className="text-slate-muted mt-1">
          באייפון צריך קודם להתקין את האפליקציה למסך הבית (שיתוף ← הוסף למסך הבית) — רק אז אפשר להפעיל
          התראות.
        </p>
      )}
      {status === "denied" && (
        <p className="text-slate-muted mt-1">
          התראות חסומות עבור האתר הזה בדפדפן. יש לאפשר אותן בהגדרות הדפדפן/האתר ואז לרענן את הדף.
        </p>
      )}
      {status === "off" && (
        <>
          <p className="text-slate-muted mt-1">
            {audience === "admin"
              ? "הפעלה חד-פעמית במכשיר הזה — תקבלו התראה על כל תור חדש, שינוי בתור, בקשת תור ובקשת ביטול, גם כשהאפליקציה סגורה."
              : "הפעלה חד-פעמית במכשיר הזה — תקבלו התראה על שינוי או ביטול תור, תור שהתפנה, ימים חדשים והודעות מהספר, גם כשהאפליקציה סגורה."}
          </p>
          <button
            onClick={turnOn}
            disabled={pending}
            className="bg-barber-teal text-cream-text mt-2 rounded-full px-4 py-2 text-sm disabled:opacity-50"
          >
            {pending ? "מפעיל..." : "הפעלת התראות"}
          </button>
        </>
      )}
      {status === "on" && (
        <>
          <p className="mt-1 text-green-700">התראות פעילות במכשיר זה.</p>
          <button
            onClick={turnOff}
            disabled={pending}
            className="border-barber-teal text-barber-teal mt-2 rounded-full border px-4 py-2 text-sm disabled:opacity-50"
          >
            {pending ? "מכבה..." : "כיבוי התראות במכשיר זה"}
          </button>
        </>
      )}
      {error && <p className="mt-2 text-red-600">{error}</p>}
    </div>
  );
}
