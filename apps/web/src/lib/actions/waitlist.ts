"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@barberbook/db";
import { formatIsraelDate, formatIsraelTime } from "@barberbook/shared";
import { getSession } from "@/lib/auth/session";
import { getContactNameMap } from "@/lib/contactNames";
import { sendCustomerNotification } from "@/lib/notifyCustomer";
import { notifyAdminsOfWaitlistJoin } from "@/lib/notifyAdmin";
import type { BookingResult } from "@/lib/actions/booking";
import { isWaitlistPeriodKey, waitlistPeriodLabel, waitlistPeriodOf } from "@/lib/waitlistPeriods";
import { getWaitlistPeriods } from "@/lib/actions/waitlistSettings";

async function requireAdminSession() {
  const session = await getSession();
  if (!session || session.role !== "administrator") return null;
  return session;
}

/**
 * General waitlist (US extension) — not tied to a specific service or date.
 * user_id is @unique on WaitlistEntry, so joining again while already on the
 * list is a no-op rather than a duplicate/error.
 */
export async function joinWaitlistAction(): Promise<BookingResult> {
  const session = await getSession();
  if (!session) return { error: "יש להתחבר" };

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.sub },
    select: { phone_number: true },
  });

  const already = await prisma.waitlistEntry.findUnique({ where: { user_id: session.sub }, select: { id: true } });
  await prisma.waitlistEntry.upsert({
    where: { user_id: session.sub },
    update: {},
    create: {
      user_id: session.sub,
      customer_name: session.full_name,
      phone_number: user.phone_number,
    },
  });
  if (!already) {
    await notifyAdminsOfWaitlistJoin({ customer_name: session.full_name }).catch((err) =>
      console.error("[notify] failed to notify admins of waitlist join:", err),
    );
  }

  revalidatePath("/account");
  revalidatePath("/account/book");
  return { success: true };
}

/**
 * Per-date waitlist: "tell me when a slot frees up on this work day, in this time of day".
 * Idempotent (unique user + day + period). Independent of the general WaitlistEntry.
 */
export async function joinDateWaitlistAction(work_day_id: string, period: string): Promise<BookingResult> {
  const session = await getSession();
  if (!session) return { error: "יש להתחבר" };
  const periods = await getWaitlistPeriods();
  if (!isWaitlistPeriodKey(period) || !periods.some((p) => p.key === period && p.enabled)) {
    return { error: "טווח השעות הזה לא זמין" };
  }

  const day = await prisma.workDay.findUnique({
    where: { id: work_day_id },
    select: { ends_at: true, is_blocked: true, work_date: true },
  });
  if (!day || day.is_blocked || day.ends_at <= new Date()) return { error: "התאריך הזה כבר לא זמין" };

  const key = { user_id: session.sub, work_day_id, period };
  const already = await prisma.waitlistDateEntry.findUnique({
    where: { user_id_work_day_id_period: key },
    select: { id: true },
  });
  await prisma.waitlistDateEntry.upsert({
    where: { user_id_work_day_id_period: key },
    update: {},
    create: key,
  });
  if (!already) {
    await notifyAdminsOfWaitlistJoin({
      customer_name: session.full_name,
      work_date: day.work_date,
      period_label: waitlistPeriodLabel(periods, period),
    }).catch((err) => console.error("[notify] failed to notify admins of waitlist join:", err));
  }

  revalidatePath("/account");
  return { success: true };
}

export type DateWaitlistView = { id: string; work_date: string; period: string; period_label: string };

/** The customer's upcoming per-date waitlist entries, soonest first. */
export async function getMyDateWaitlistEntries(): Promise<DateWaitlistView[]> {
  const session = await getSession();
  if (!session) return [];
  const rows = await prisma.waitlistDateEntry.findMany({
    where: { user_id: session.sub, work_day: { ends_at: { gt: new Date() } } },
    include: { work_day: { select: { work_date: true } } },
    orderBy: [{ work_day: { work_date: "asc" } }, { created_at: "asc" }],
  });
  const periods = await getWaitlistPeriods();
  return rows.map((r) => ({
    id: r.id,
    work_date: r.work_day.work_date.toISOString().slice(0, 10),
    period: r.period,
    period_label: waitlistPeriodLabel(periods, r.period),
  }));
}

export async function leaveDateWaitlistEntryAction(id: string): Promise<BookingResult> {
  const session = await getSession();
  if (!session) return { error: "יש להתחבר" };
  await prisma.waitlistDateEntry.deleteMany({ where: { id, user_id: session.sub } });
  revalidatePath("/account");
  return { success: true };
}

export async function leaveWaitlistAction(): Promise<BookingResult> {
  const session = await getSession();
  if (!session) return { error: "יש להתחבר" };

  await prisma.waitlistEntry.deleteMany({ where: { user_id: session.sub } });
  await prisma.waitlistDateEntry.deleteMany({ where: { user_id: session.sub } });

  revalidatePath("/account");
  revalidatePath("/account/book");
  return { success: true };
}

export async function isOnWaitlist(): Promise<boolean> {
  const session = await getSession();
  if (!session) return false;
  const entry = await prisma.waitlistEntry.findUnique({ where: { user_id: session.sub } });
  return entry !== null;
}

/** null when the customer isn't on the waitlist. */
export async function getMyWaitlistEntry(): Promise<{ notify_freed_slots: boolean } | null> {
  const session = await getSession();
  if (!session) return null;
  return prisma.waitlistEntry.findUnique({
    where: { user_id: session.sub },
    select: { notify_freed_slots: true },
  });
}

export async function setNotifyFreedSlotsAction(enabled: boolean): Promise<BookingResult> {
  const session = await getSession();
  if (!session) return { error: "יש להתחבר" };

  const { count } = await prisma.waitlistEntry.updateMany({
    where: { user_id: session.sub },
    data: { notify_freed_slots: enabled },
  });
  if (count === 0) return { error: "את/ה כבר לא ברשימת ההמתנה" };

  revalidatePath("/account");
  return { success: true };
}

export type WaitlistEntryView = {
  id: string;
  customer_name: string;
  phone_number: string;
  contact_name: string | null;
  created_at: Date;
};

export async function getWaitlistEntries(): Promise<WaitlistEntryView[]> {
  if (!(await requireAdminSession())) return [];
  const entries = await prisma.waitlistEntry.findMany({ orderBy: { created_at: "asc" } });
  const contactNames = await getContactNameMap(entries.map((e) => e.phone_number));
  return entries.map((e) => ({
    id: e.id,
    customer_name: e.customer_name,
    phone_number: e.phone_number,
    contact_name: contactNames.get(e.phone_number) ?? null,
    created_at: e.created_at,
  }));
}

export type DateWaitlistAdminView = {
  id: string;
  work_date: string;
  barber_name: string;
  customer_name: string;
  phone_number: string;
  contact_name: string | null;
  period_label: string;
  created_at: Date;
};

/** Admin: upcoming per-date waitlist entries (customers who asked to be told when a slot frees on a given day), by date. */
export async function getDateWaitlistEntriesAdmin(): Promise<DateWaitlistAdminView[]> {
  if (!(await requireAdminSession())) return [];
  const rows = await prisma.waitlistDateEntry.findMany({
    where: { work_day: { ends_at: { gt: new Date() } } },
    include: {
      user: { select: { full_name: true, phone_number: true } },
      work_day: { select: { work_date: true, barber: { select: { full_name: true } } } },
    },
    orderBy: [{ work_day: { work_date: "asc" } }, { created_at: "asc" }],
  });
  const periods = await getWaitlistPeriods();
  const names = await getContactNameMap(rows.map((r) => r.user.phone_number));
  return rows.map((r) => ({
    id: r.id,
    work_date: r.work_day.work_date.toISOString().slice(0, 10),
    barber_name: r.work_day.barber.full_name,
    customer_name: r.user.full_name,
    phone_number: r.user.phone_number,
    contact_name: names.get(r.user.phone_number) ?? null,
    period_label: waitlistPeriodLabel(periods, r.period),
    created_at: r.created_at,
  }));
}

export async function removeDateWaitlistEntryAdminAction(id: string): Promise<BookingResult> {
  if (!(await requireAdminSession())) return { error: "אין הרשאה" };
  await prisma.waitlistDateEntry.deleteMany({ where: { id } });
  revalidatePath("/admin/waitlist");
  return { success: true };
}

export async function removeWaitlistEntryAction(id: string): Promise<BookingResult> {
  if (!(await requireAdminSession())) return { error: "אין הרשאה" };
  await prisma.waitlistEntry.delete({ where: { id } });
  revalidatePath("/admin/waitlist");
  return { success: true };
}

async function notifyAllWaitlistEntries(
  message: string,
  { exclude_user_id, freedSlotsOnly = false }: { exclude_user_id?: string | null; freedSlotsOnly?: boolean } = {},
): Promise<void> {
  const entries = (
    await prisma.waitlistEntry.findMany({ where: freedSlotsOnly ? { notify_freed_slots: true } : undefined })
  ).filter((e) => e.user_id !== exclude_user_id);
  // In parallel: each one now also does a network push, and the barber's action is waiting on this.
  await Promise.all(
    entries.map((entry) =>
      sendCustomerNotification({
        user_id: entry.user_id,
        phone_number: entry.phone_number,
        message,
        type: "waitlist_slot_available",
      }),
    ),
  );
}

/**
 * Called whenever a scheduled appointment frees up (admin cancels it, the
 * admin or the customer moves it to another time, a customer cancels, a
 * cancellation request is approved, a booking request is rejected). Only waitlist members who left
 * `notify_freed_slots` on are told (Notification row + push) — customers off the waitlist are not
 * (decision 2026-10-06; until then every push-subscribed customer got it). `owner_user_id` is the
 * customer whose appointment it was — they already know (they cancelled it, or were
 * told the barber did), so they're skipped. Entries stay on
 * the waitlist afterward (no auto-removal). Members who picked times of day (`preferred_periods`) are only
 * told about slots in those periods; an empty list means any time; the admin or the customer removes
 * them explicitly.
 */
export async function notifyWaitlistOfFreedSlot(
  starts_at: Date,
  ends_at: Date,
  owner_user_id?: string | null,
): Promise<void> {
  const message = `התפנה תור בתאריך ${formatIsraelDate(starts_at)} בשעה \u2066${formatIsraelTime(starts_at)}–${formatIsraelTime(ends_at)}\u2069 — מהרו לקבוע תור!`;
  await notifyAllWaitlistEntries(message, { exclude_user_id: owner_user_id, freedSlotsOnly: true });

  // Per-date waitlist: only people who asked about this exact work day and time of day.
  const days = await prisma.workDay.findMany({
    where: { starts_at: { lte: starts_at }, ends_at: { gt: starts_at } },
    select: { id: true },
  });
  if (days.length === 0) return;
  const period = waitlistPeriodOf(starts_at, await getWaitlistPeriods());
  if (!period) return; // the slot is outside every range the barber offers
  const dateEntries = await prisma.waitlistDateEntry.findMany({
    where: { work_day_id: { in: days.map((d) => d.id) }, period, user_id: { not: owner_user_id ?? undefined } },
    include: { user: { select: { phone_number: true } } },
  });
  // On the general list: already told above, or opted out of freed-slot alerts — don't double-notify.
  const general = await prisma.waitlistEntry.findMany({
    where: { user_id: { in: dateEntries.map((e) => e.user_id) } },
    select: { user_id: true, notify_freed_slots: true },
  });
  const skip = new Set(general.map((g) => g.user_id));
  await Promise.all(
    dateEntries
      .filter((e) => !skip.has(e.user_id))
      .map((e) =>
        sendCustomerNotification({
          user_id: e.user_id,
          phone_number: e.user.phone_number,
          message,
          type: "waitlist_slot_available",
        }),
      ),
  );
}

/**
 * Called whenever the barber extends an already-open work day's hours
 * (earlier start and/or later end than before) — this can surface new slots
 * without any specific appointment having been freed, so it's a distinct
 * trigger from notifyWaitlistOfFreedSlot.
 */
export async function notifyWaitlistOfExtendedHours(work_date: Date): Promise<void> {
  await notifyAllWaitlistEntries(
    `נפתחו שעות נוספות בתאריך ${formatIsraelDate(work_date)} — כדאי לבדוק אם יש תור מתאים!`,
  );
}

/**
 * Called whenever the barber opens a brand-new work day (createWorkDayAction)
 * — distinct from notifyWaitlistOfExtendedHours, which only fires when an
 * already-open day's hours are widened. Without this, a customer who joins
 * the waitlist while there are zero open dates at all would never actually
 * get notified, since opening the very first day isn't an "extension" of
 * anything — this was a real gap (fixed 2026-07-25).
 */
export async function notifyWaitlistOfNewWorkDay(work_date: Date): Promise<void> {
  await notifyAllWaitlistEntries(
    `נפתח תאריך חדש לקביעת תורים — ${formatIsraelDate(work_date)}. כדאי למהר ולקבוע!`,
  );
}
