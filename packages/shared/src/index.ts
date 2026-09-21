// Fixed service catalog from docs/# PRD BarberBook.txt (US-005).
// Single source of truth — do not invent other services or durations elsewhere.
export const SERVICE_DEFINITIONS = [
  { name: "תספורת מבוגר", duration_minutes: 10, is_child_service: false },
  { name: "תספורת + זקן", duration_minutes: 15, is_child_service: false },
  { name: "תספורת ילד", duration_minutes: 10, is_child_service: true },
  { name: "הסרת שיער בלייזר", duration_minutes: 10, is_child_service: false },
  { name: "חלאקה", duration_minutes: 15, is_child_service: false },
  { name: "תספורת מבוגר + טיפול לייזר", duration_minutes: 20, is_child_service: false },
] as const;

// The fixed set of services a sub-barber (Barber.is_primary: false) may
// offer — see CLAUDE.md, "ספרי משנה". Not admin-configurable per barber;
// the primary barber always offers the full SERVICE_DEFINITIONS list.
export const SUB_BARBER_SERVICE_NAMES = ["תספורת מבוגר", "תספורת + זקן", "תספורת ילד"] as const;

export function isServiceAllowedForBarber(barberIsPrimary: boolean, serviceName: string): boolean {
  return barberIsPrimary || (SUB_BARBER_SERVICE_NAMES as readonly string[]).includes(serviceName);
}

export const PHONE_NUMBER_REGEX = /^0\d{8,9}$/;

/**
 * The salon operates on Israel time regardless of where the server process
 * or the customer's device happen to be set — a Server Component renders
 * on the server's OS clock and a Client Component renders on the browser's,
 * so every appointment-time display must pin this zone explicitly instead
 * of relying on either ambient timezone.
 */
export const ISRAEL_TIME_ZONE = "Asia/Jerusalem";

export const PASSWORD_RESET_CODE_TTL_MINUTES = 10;

/** SMS login (docs/SMS-LOGIN.md): how long a one-time login code lives and how many wrong guesses burn it. */
export const LOGIN_CODE_TTL_MINUTES = 10;
export const LOGIN_CODE_MAX_ATTEMPTS = 5;
export const APPOINTMENT_REMINDER_LEAD_MINUTES = 120;

export * from "./sms";
export * from "./sms019";

/**
 * Prisma's `@db.Date` columns store a bare calendar date with no time zone.
 * Feeding it a JS Date built with local setHours(0,0,0,0) silently rolls
 * back one day whenever the server's local time zone is ahead of UTC
 * (true for Europe/Berlin in dev and Asia/Jerusalem in production) — the
 * date's UTC instant lands on the previous UTC calendar day. Always build
 * `work_date` values through this helper (or from a "YYYY-MM-DD" string
 * via `new Date(\`${dateStr}T00:00:00Z\`)`) instead of local midnight.
 */
export function localDateToUtcMidnight(date: Date = new Date()): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

/**
 * Converts a wall-clock date + time in `timeZone` (e.g. "09:00" in
 * Asia/Jerusalem) to the correct UTC instant, accounting for DST — Israel's
 * offset is +2 in winter and +3 in summer, and the transition dates don't
 * follow a fixed rule, so this can't be a hardcoded offset. No timezone
 * library is installed, so this uses the standard Intl "longOffset" trick:
 * read the real UTC offset for a close guess, then apply it.
 */
export function formatIsraelTime(d: Date): string {
  return d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", timeZone: ISRAEL_TIME_ZONE });
}
export function formatIsraelDate(d: Date): string {
  return d.toLocaleDateString("he-IL", { day: "numeric", month: "numeric", timeZone: ISRAEL_TIME_ZONE });
}

export function zonedTimeToUtc(dateStr: string, timeStr: string, timeZone: string): Date {
  const naiveUtc = new Date(`${dateStr}T${timeStr}:00Z`);
  const offsetPart = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
    .formatToParts(naiveUtc)
    .find((p) => p.type === "timeZoneName")?.value;
  const match = offsetPart?.match(/GMT([+-])(\d{2}):(\d{2})/);
  const offsetMinutes = match
    ? (match[1] === "-" ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3]))
    : 0;
  return new Date(naiveUtc.getTime() - offsetMinutes * 60_000);
}
