"use server";

import { revalidatePath } from "next/cache";
import { prisma, sendPushToCustomers } from "@barberbook/db";
import { formatIsraelDate, formatIsraelTime } from "@barberbook/shared";
import { getSession } from "@/lib/auth/session";
import { sendCustomerNotification } from "@/lib/notifyCustomer";
import type { BookingResult } from "@/lib/actions/booking";

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

  await prisma.waitlistEntry.upsert({
    where: { user_id: session.sub },
    update: {},
    create: {
      user_id: session.sub,
      customer_name: session.full_name,
      phone_number: user.phone_number,
    },
  });

  revalidatePath("/account");
  revalidatePath("/account/book");
  return { success: true };
}

export async function leaveWaitlistAction(): Promise<BookingResult> {
  const session = await getSession();
  if (!session) return { error: "יש להתחבר" };

  await prisma.waitlistEntry.deleteMany({ where: { user_id: session.sub } });

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

export type WaitlistEntryView = {
  id: string;
  customer_name: string;
  phone_number: string;
  created_at: Date;
};

export async function getWaitlistEntries(): Promise<WaitlistEntryView[]> {
  if (!(await requireAdminSession())) return [];
  const entries = await prisma.waitlistEntry.findMany({ orderBy: { created_at: "asc" } });
  return entries.map((e) => ({
    id: e.id,
    customer_name: e.customer_name,
    phone_number: e.phone_number,
    created_at: e.created_at,
  }));
}

export async function removeWaitlistEntryAction(id: string): Promise<BookingResult> {
  if (!(await requireAdminSession())) return { error: "אין הרשאה" };
  await prisma.waitlistEntry.delete({ where: { id } });
  revalidatePath("/admin/waitlist");
  return { success: true };
}

async function notifyAllWaitlistEntries(message: string, exclude_user_id?: string | null): Promise<string[]> {
  const entries = (await prisma.waitlistEntry.findMany()).filter((e) => e.user_id !== exclude_user_id);
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
  return entries.map((e) => e.user_id);
}

/**
 * Called whenever a scheduled appointment frees up (admin cancels it, a
 * customer cancels, a cancellation request is approved, a booking request is
 * rejected). Waitlist members get their own notification (with a Notification
 * row); on top of that EVERY other customer who turned push on gets the same
 * message, since anyone might want the slot. `owner_user_id` is the customer
 * whose appointment it was — they already know (they cancelled it, or were
 * told the barber did), so they're skipped in both groups. Entries stay on
 * the waitlist afterward (no auto-removal); the admin or the customer removes
 * them explicitly.
 */
export async function notifyWaitlistOfFreedSlot(
  starts_at: Date,
  service_name: string,
  owner_user_id?: string | null,
): Promise<void> {
  const message = `התפנה תור ל${service_name} בתאריך ${formatIsraelDate(starts_at)} בשעה ${formatIsraelTime(starts_at)} — מיהרו לקבוע!`;
  const notifiedUserIds = await notifyAllWaitlistEntries(message, owner_user_id);
  await sendPushToCustomers(
    { title: "יש תור פנוי", body: message, url: "/account/book" },
    { excludeUserIds: [...notifiedUserIds, ...(owner_user_id ? [owner_user_id] : [])] },
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
