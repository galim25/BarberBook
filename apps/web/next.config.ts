import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

// Host(s)/IP for `next dev` to accept requests from besides localhost (e.g. a
// VPS IP or ngrok tunnel while testing over the network before a real domain
// exists) — kept out of source so the server's address isn't committed to
// git history. Set DEV_ALLOWED_ORIGIN in .env, comma-separated for multiple.
const devAllowedOrigins = process.env.DEV_ALLOWED_ORIGIN?.split(",").map((o) => o.trim());

const nextConfig: NextConfig = {
  ...(devAllowedOrigins ? { allowedDevOrigins: devAllowedOrigins } : {}),
  async headers() {
    // The browser must always be able to see a new service worker right after a deploy.
    return [{ source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] }];
  },
};

// Generates public/sw.js from src/app/sw.ts at build time and injects the
// client-side registration script. Disabled in dev by default (Serwist's
// own default) so `next dev` never serves a stale cached bundle — the PWA
// only becomes installable/offline-capable after `pnpm build && pnpm start`.
const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
});

export default withSerwist(nextConfig);
