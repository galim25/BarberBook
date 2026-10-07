// PushManager.subscribe needs the VAPID key as raw bytes, not the base64url string it's stored as.
export function urlBase64ToUint8Array(base64Url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/**
 * Whether a browser push subscription was created with this VAPID public key. A subscription is
 * bound to the key it was made with: after the server's key changes, the old subscription still
 * shows as "on" in the browser but the push service rejects every send (2026-10-07 incident).
 * A null key (the browser didn't expose it) counts as "can't tell", not as a mismatch.
 */
export function subscriptionUsesKey(subscriptionKey: ArrayBuffer | null | undefined, expected: Uint8Array): boolean {
  if (!subscriptionKey) return true;
  const actual = new Uint8Array(subscriptionKey);
  return actual.length === expected.length && actual.every((byte, i) => byte === expected[i]);
}
