import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";

let cached: string | undefined;

/**
 * Identifier of the running build (`.next/BUILD_ID`, written by `next build`). The root layout hands it to
 * the browser and `/api/version` reports it again later — if the two differ, the page the user has open
 * belongs to an older deploy (see components/AppUpdater.tsx). "dev" when there is no production build.
 */
export function getBuildId(): string {
  if (cached) return cached;
  try {
    cached = readFileSync(join(process.cwd(), ".next", "BUILD_ID"), "utf8").trim() || "dev";
  } catch {
    cached = "dev";
  }
  return cached;
}
