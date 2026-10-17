import { ISRAEL_TIME_ZONE } from "@barberbook/shared";

export type WaitlistPeriodKey = "morning" | "afternoon" | "evening";

/** One time-of-day option on the per-date waitlist, as the barber configured it. `from`/`to` are Israel wall-clock "HH:MM", `to` exclusive. */
export type WaitlistPeriodConfig = {
  key: WaitlistPeriodKey;
  label: string;
  enabled: boolean;
  from: string;
  to: string;
};

export const DEFAULT_WAITLIST_PERIODS: WaitlistPeriodConfig[] = [
  { key: "morning", label: "בוקר", enabled: true, from: "09:00", to: "13:00" },
  { key: "afternoon", label: "צהריים", enabled: true, from: "13:00", to: "17:00" },
  { key: "evening", label: "ערב", enabled: true, from: "17:00", to: "20:00" },
];

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isWaitlistPeriodKey(value: string): value is WaitlistPeriodKey {
  return DEFAULT_WAITLIST_PERIODS.some((p) => p.key === value);
}

const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/** Reads the stored JSON, falling back to the default for anything missing or malformed. */
export function parseWaitlistPeriods(raw: unknown): WaitlistPeriodConfig[] {
  const stored = Array.isArray(raw) ? (raw as Partial<WaitlistPeriodConfig>[]) : [];
  return DEFAULT_WAITLIST_PERIODS.map((def) => {
    const s = stored.find((x) => x?.key === def.key);
    if (!s || typeof s.from !== "string" || typeof s.to !== "string" || !TIME_REGEX.test(s.from) || !TIME_REGEX.test(s.to)) {
      return def;
    }
    return { ...def, enabled: s.enabled !== false, from: s.from, to: s.to };
  });
}

/** Hebrew error message, or null when the configuration is acceptable. */
export function validateWaitlistPeriods(periods: WaitlistPeriodConfig[]): string | null {
  for (const p of periods) {
    if (!TIME_REGEX.test(p.from) || !TIME_REGEX.test(p.to)) return `שעות ${p.label} חייבות להיות בפורמט 09:00`;
    if (toMinutes(p.from) >= toMinutes(p.to)) return `ב${p.label}, שעת הסיום חייבת להיות אחרי שעת ההתחלה`;
  }
  const enabled = periods.filter((p) => p.enabled).sort((a, b) => toMinutes(a.from) - toMinutes(b.from));
  if (enabled.length === 0) return "יש לבחור לפחות טווח אחד להצגה ללקוחות";
  for (let i = 1; i < enabled.length; i++) {
    if (toMinutes(enabled[i].from) < toMinutes(enabled[i - 1].to)) {
      return `הטווחים ${enabled[i - 1].label} ו${enabled[i].label} חופפים`;
    }
  }
  return null;
}

/** "09:00-13:00" */
export function waitlistPeriodRange(p: { from: string; to: string }): string {
  return `${p.from}-${p.to}`;
}

export function waitlistPeriodLabel(periods: WaitlistPeriodConfig[], key: string): string {
  const p = periods.find((x) => x.key === key);
  return p ? `${p.label} (${waitlistPeriodRange(p)})` : key;
}

/** The enabled period a slot start falls in (Israel wall-clock time), or null when none of them covers it. */
export function waitlistPeriodOf(starts_at: Date, periods: WaitlistPeriodConfig[]): WaitlistPeriodKey | null {
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: ISRAEL_TIME_ZONE,
  }).formatToParts(starts_at);
  const minutes =
    Number(parts.find((x) => x.type === "hour")?.value) * 60 + Number(parts.find((x) => x.type === "minute")?.value);
  const hit = periods.find((p) => p.enabled && minutes >= toMinutes(p.from) && minutes < toMinutes(p.to));
  return hit?.key ?? null;
}
