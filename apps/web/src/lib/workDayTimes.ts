import { ISRAEL_TIME_ZONE, zonedTimeToUtc } from "@barberbook/shared";

/** Latest wall-clock time (as "HH:mm") a work day may run to after midnight. */
export const LATEST_AFTER_MIDNIGHT = "03:00";

function nextDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Turns an "HH:mm" typed for a work day into an instant. A time earlier than the day's start
 * (e.g. an end of "01:00" on a day starting "09:00") means after midnight, i.e. the next calendar
 * date, and is only allowed up to LATEST_AFTER_MIDNIGHT. Returns null when it is neither
 * later than the start nor an allowed after-midnight time.
 */
export function workDayTimeToUtc(workDate: string, time: string, dayStart: string): Date | null {
  if (time >= dayStart) return zonedTimeToUtc(workDate, time, ISRAEL_TIME_ZONE);
  if (time > LATEST_AFTER_MIDNIGHT) return null;
  return zonedTimeToUtc(nextDate(workDate), time, ISRAEL_TIME_ZONE);
}

export const END_BEFORE_START_ERROR = `שעת הסיום חייבת להיות אחרי שעת ההתחלה (עד ${LATEST_AFTER_MIDNIGHT} לפנות בוקר)`;
