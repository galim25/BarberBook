"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@barberbook/db";
import { getSession } from "@/lib/auth/session";
import type { BookingResult } from "@/lib/actions/booking";
import {
  DEFAULT_WAITLIST_PERIODS,
  parseWaitlistPeriods,
  validateWaitlistPeriods,
  type WaitlistPeriodConfig,
} from "@/lib/waitlistPeriods";

const SETTINGS_ID = "singleton";

/** What the per-date waitlist offers customers (all three periods, with `enabled`). Public read, like getRequiresApproval. */
export async function getWaitlistPeriods(): Promise<WaitlistPeriodConfig[]> {
  const settings = await prisma.appSettings.findUnique({
    where: { id: SETTINGS_ID },
    select: { waitlist_periods: true },
  });
  return parseWaitlistPeriods(settings?.waitlist_periods);
}

export async function setWaitlistPeriodsAction(input: WaitlistPeriodConfig[]): Promise<BookingResult> {
  const session = await getSession();
  if (!session || session.role !== "administrator") return { error: "אין הרשאה" };

  // Rebuilt from the fixed keys so nothing but {enabled, from, to} per known period is ever stored.
  const periods = DEFAULT_WAITLIST_PERIODS.map((def) => {
    const given = input.find((p) => p?.key === def.key);
    return { ...def, enabled: given?.enabled === true, from: String(given?.from ?? ""), to: String(given?.to ?? "") };
  });
  const error = validateWaitlistPeriods(periods);
  if (error) return { error };

  const value = periods.map(({ key, enabled, from, to }) => ({ key, enabled, from, to }));
  await prisma.appSettings.upsert({
    where: { id: SETTINGS_ID },
    update: { waitlist_periods: value },
    create: { id: SETTINGS_ID, waitlist_periods: value },
  });

  revalidatePath("/admin/waitlist-settings");
  revalidatePath("/account/book");
  return { success: true };
}
