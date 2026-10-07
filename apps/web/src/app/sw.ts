import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig } from "serwist";
import { CacheFirst, ExpirationPlugin, NetworkOnly, Serwist, StaleWhileRevalidate } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// Only immutable assets are cached at runtime. Pages, RSC payloads, API and
// everything else always go to the network. The old `defaultCache` kept HTML/RSC
// (NetworkFirst, 24h fallback) and `_next/static/*.js` (CacheFirst), so after a
// deploy a customer could be served an old page whose server-action IDs no longer
// exist on the server — `getActiveBarbers()` then failed and the booking screen
// said "no barbers available" (2026-10-06 incident).
const runtimeCaching: RuntimeCaching[] = [
  {
    // Content-hashed filenames: a new deploy means new URLs, so caching is safe.
    matcher: ({ sameOrigin, url: { pathname } }) => sameOrigin && pathname.startsWith("/_next/static/"),
    handler: new CacheFirst({
      cacheName: "next-static",
      plugins: [new ExpirationPlugin({ maxEntries: 128, maxAgeSeconds: 7 * 24 * 60 * 60 })],
    }),
  },
  {
    matcher: ({ sameOrigin, url: { pathname } }) =>
      sameOrigin && /\.(?:jpg|jpeg|gif|png|svg|ico|webp|woff2?)$/i.test(pathname),
    handler: new StaleWhileRevalidate({
      cacheName: "static-media",
      plugins: [new ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 7 * 24 * 60 * 60 })],
    }),
  },
  { matcher: () => true, handler: new NetworkOnly() },
];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching,
});

serwist.addEventListeners();

// Drop the stale page/RSC/API caches left behind by the previous defaultCache setup.
const LEGACY_RUNTIME_CACHES = [
  "pages", "pages-rsc", "pages-rsc-prefetch", "others", "apis", "next-data",
  "static-data-assets", "cross-origin", "next-static-js-assets", "static-js-assets",
  "static-style-assets", "static-image-assets", "static-font-assets", "next-image",
];
self.addEventListener("activate", (event: ExtendableEvent) => {
  event.waitUntil(Promise.all(LEGACY_RUNTIME_CACHES.map((name) => self.caches.delete(name))));
});

// Real device notifications (apps/web/src/lib/push.ts sends these server-side
// via web-push) — fires even when the app/tab is closed, as long as the
// browser process is running and the admin subscribed on this device.
self.addEventListener("push", (event: PushEvent) => {
  const data = event.data?.json() as { title?: string; body?: string; url?: string } | undefined;
  const title = data?.title ?? "BarberBook";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data?.body,
      icon: "/web-app-manifest-192x192.png",
      badge: "/web-app-manifest-192x192.png",
      dir: "rtl",
      lang: "he",
      data: { url: data?.url ?? "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string } | undefined)?.url ?? "/";
  event.waitUntil(self.clients.openWindow(url));
});
