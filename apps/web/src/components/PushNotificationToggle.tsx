"use client";

import { useEffect, useState } from "react";
import { subscribeToPushAction, unsubscribeFromPushAction } from "@/lib/actions/push";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function isStandaloneIos() {
  return (
    /iphone|ipad|ipod/i.test(window.navigator.userAgent) &&
    (window.navigator as Navigator & { standalone?: boolean }).standalone !== true
  );
}

// PushManager.subscribe needs the VAPID key as raw bytes, not the base64url string it's stored as.
function urlBase64ToUint8Array(base64Url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

type Status = "checking" | "unsupported" | "ios-not-installed" | "off" | "on" | "denied";

export function PushNotificationToggle({ audience }: { audience: "admin" | "customer" }) {
  const [status, setStatus] = useState<Status>("checking");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    async function check() {
      if (!VAPID_PUBLIC_KEY || !("serviceWorker" in navigator) || !("PushManager" in window)) {
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
      setStatus(existing ? "on" : "off");
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
      const json = subscription.toJSON();
      const result = await subscribeToPushAction({
        endpoint: json.endpoint!,
        keys: { p256dh: json.keys!.p256dh, auth: json.keys!.auth },
      });
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
