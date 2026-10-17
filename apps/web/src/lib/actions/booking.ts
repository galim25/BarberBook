"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@barberbook/db";
import {
  localDateToUtcMidnight,
  SUB_BARBER_SERVICE_NAMES,
} from "@barberbook/shared";
import { getSession } from "@/lib/auth/session";
import { findAvailableSlots, type Interval } from "@/lib/availability";
import { runSerializable } from "@/lib/serializableTransaction";
import {
  notifyAdminsOfNewBooking,
  notifyAdminsOfBookingRequest,
  notifyAdminsOfCustomerReschedule,
  notifyAdminsOfRescheduleRequest,
} from "@/lib/notifyAdmin";
import { getRequiresApproval } from "@/lib/actions/settings";
import { notifyWaitlistOfFreedSlot } from "@/lib/actions/waitlist";
import { bookAppointmentCore } from "@/lib/actions/bookingCore";
import { checkAndMaybeMove } from "@/lib/rescheduleCore";

export type ServiceOption = {
  id: string;
  name: string;
  duration_minutes: number;
  is_child_service: boolean;
};
export type OpenDate = { work_day_id: string; work_date: string; starts_at: string; ends_at: string };
export type BookingResult = { error?: string; success?: boolean; pendingApproval?: boolean };

export async function getServices(barber_id: string): Promise<ServiceOption[]> {
  const barber = await prisma.barber.findUniqueOrThrow({
    where: { id: barber_id },
    select: { is_primary: true },
  });
  return prisma.service.findMany({
    where: barber.is_primary
      ? { is_manual_only: false }
      : { is_manual_only: false, name: { in: [...SUB_BARBER_SERVICE_NAMES] } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, duration_minutes: true, is_child_service: true },
  });
}

export async function getOpenDates(barber_id: string): Promise<OpenDate[]> {
  const today = localDateToUtcMidnight();
  const days = await prisma.workDay.findMany({
    where: { barber_id, work_date: { gte: today }, is_blocked: false },
    orderBy: { work_date: "asc" },
    select: { id: true, work_date: true, starts_at: true, ends_at: true },
  });
  return days.map((d) => ({
    work_day_id: d.id,
    work_date: d.work_date.toISOString().slice(0, 10),
    starts_at: d.starts_at.toISOString(),
    ends_at: d.ends_at.toISOString(),
  }));
}

async function loadBusyIntervals(
  work_day_id: string,
  excludeAppointmentId?: string,
): Promise<{ work_day: Interval; busy: Interval[] }> {
  const workDay = await prisma.workDay.findUniqueOrThrow({
    where: { id: work_day_id },
    include: {
      breaks: true,
      blocked_times: true,
      appointments: { where: { status: "scheduled" } },
    },
  });

  const busy: Interval[] = [
    ...workDay.breaks.map((b) => ({ starts_at: b.starts_at, ends_at: b.ends_at })),
    ...workDay.blocked_times.map((b) => ({ starts_at: b.starts_at, ends_at: b.ends_at })),
    ...workDay.appointments
      .filter((a) => a.id !== excludeAppointmentId)
      .map((a) => ({ starts_at: a.starts_at, ends_at: a.ends_at })),
  ];

  return { work_day: { starts_at: workDay.starts_at, ends_at: workDay.ends_at }, busy };
}

export async function getSlotsForDate(
  work_day_id: string,
  service_id: string,
  excludeAppointmentId?: string,
): Promise<string[]> {
  const service = await prisma.service.findUniqueOrThrow({ where: { id: service_id } });
  return getSlotsForDuration(work_day_id, service.duration_minutes, excludeAppointmentId);
}

/** Same as getSlotsForDate, for a raw duration — the barber's manual-appointment form picks a duration, not a service. */
export async function getSlotsForDuration(
  work_day_id: string,
  duration_minutes: number,
  excludeAppointmentId?: string,
): Promise<string[]> {
  const { work_day, busy } = await loadBusyIntervals(work_day_id, excludeAppointmentId);
  const now = new Date();
  return findAvailableSlots({
    work_day,
    busy,
    duration_minutes,
  })
    .filter((d) => d >= now)
    .map((d) => d.toISOString());
}

export async function getWorkDayInterval(work_day_id: string): Promise<Interval> {
  const workDay = await prisma.workDay.findUniqueOrThrow({
    where: { id: work_day_id },
    select: { starts_at: true, ends_at: true },
  });
  return { starts_at: workDay.starts_at, ends_at: workDay.ends_at };
}

export type EarliestAvailability = { work_day_id: string; starts_at: string };

/**
 * The IVR's "here's the soonest open time, press 1 to confirm" step (see
 * docs/# IVR BarberBook.txt §2 decision 6) — walks getOpenDates in order
 * and returns the first slot of the first day that has one. No new slot
 * math: reuses getOpenDates/getSlotsForDate as-is.
 */
export async function getEarliestAvailability(
  barber_id: string,
  service_id: string,
): Promise<EarliestAvailability | null> {
  const service = await prisma.service.findUniqueOrThrow({ where: { id: service_id } });
  const today = localDateToUtcMidnight();
  // One query for all open days (same filter/order as getOpenDates) instead of one per day.
  const days = await prisma.workDay.findMany({
    where: { barber_id, work_date: { gte: today }, is_blocked: false },
    orderBy: { work_date: "asc" },
    include: {
      breaks: true,
      blocked_times: true,
      appointments: { where: { status: "scheduled" } },
    },
  });
  const now = new Date();
  for (const day of days) {
    const busy: Interval[] = [
      ...day.breaks.map((b) => ({ starts_at: b.starts_at, ends_at: b.ends_at })),
      ...day.blocked_times.map((b) => ({ starts_at: b.starts_at, ends_at: b.ends_at })),
      ...day.appointments.map((a) => ({ starts_at: a.starts_at, ends_at: a.ends_at })),
    ];
    const slots = findAvailableSlots({
      work_day: { starts_at: day.starts_at, ends_at: day.ends_at },
      busy,
      duration_minutes: service.duration_minutes,
    }).filter((d) => d >= now);
    if (slots.length > 0) {
      return { work_day_id: day.id, starts_at: slots[0].toISOString() };
    }
  }
  return null;
}

type CreateAppointmentInput = {
  work_day_id: string;
  service_id: string;
  starts_at: string;
  /** Required when the chosen service is a child service; ignored otherwise. */
  attendee_name?: string;
};

async function isCustomerBlocked(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { phone_number: true } });
  if (!user) return false;
  const blocked = await prisma.blockedPhoneNumber.findUnique({ where: { phone_number: user.phone_number } });
  return !!blocked;
}

export async function bookAppointmentAction(input: CreateAppointmentInput): Promise<BookingResult> {
  const session = await getSession();
  if (!session) return { error: "יש להתחבר כדי לקבוע תור" };
  if (await isCustomerBlocked(session.sub)) {
    return { error: "לא ניתן לקבוע תורים בחשבון זה. יש ליצור קשר עם הספר" };
  }

  const requiresApproval = await getRequiresApproval();

  try {
    const booked = await bookAppointmentCore(
      input,
      { user_id: session.sub, customer_name: session.full_name },
      requiresApproval,
    );

    if (requiresApproval) {
      await notifyAdminsOfBookingRequest(booked);
      return { success: true, pendingApproval: true };
    }
    await notifyAdminsOfNewBooking(booked);
    return { success: true };
  } catch (err) {
    if (err instanceof Error && err.message === "SLOT_TAKEN") {
      return { error: "השעה כבר תפוסה — יש לבחור שעה אחרת" };
    }
    if (err instanceof Error && err.message === "PAST_SLOT") {
      return { error: "לא ניתן לקבוע תור לשעה שכבר עברה" };
    }
    if (err instanceof Error && err.message === "ATTENDEE_NAME_REQUIRED") {
      return { error: "יש להזין את שם הילד/ה" };
    }
    if (err instanceof Error && err.message === "DAY_BLOCKED") {
      return { error: "היום הזה חסום כרגע לקביעת תורים חדשים" };
    }
    if (err instanceof Error && err.message === "SERVICE_NOT_OFFERED") {
      return { error: "השירות הזה לא זמין אצל הספר הזה" };
    }
    // Serializable transactions can fail under concurrent writes to the same day; treat as a retry-worthy conflict.
    return { error: "לא ניתן היה לשמור את התור, נסה/י שוב" };
  }
}

type RescheduleInput = {
  appointment_id: string;
  work_day_id: string;
  starts_at: string;
};

export async function rescheduleAppointmentAction(input: RescheduleInput): Promise<BookingResult> {
  const session = await getSession();
  if (!session) return { error: "יש להתחבר" };
  if (await isCustomerBlocked(session.sub)) {
    return { error: "לא ניתן לשנות תורים בחשבון זה. יש ליצור קשר עם הספר" };
  }

  const requiresApproval = await getRequiresApproval();

  try {
    const target = { work_day_id: input.work_day_id, starts_at: new Date(input.starts_at) };
    const outcome = await runSerializable(async (tx) => {
      const owned = await tx.appointment.findUniqueOrThrow({
        where: { id: input.appointment_id },
        select: { booked_by_user_id: true, status: true },
      });
      if (owned.booked_by_user_id !== session.sub) throw new Error("FORBIDDEN");
      if (owned.status !== "scheduled") throw new Error("NOT_ACTIVE");

      // An already-approved appointment moves only after the barber approves, when the policy is on.
      // A still-pending booking request just follows the appointment to its new time (barber decides once).
      const probe = await checkAndMaybeMove(tx, input.appointment_id, target, false);
      if (requiresApproval && !probe.pending_booking_request) {
        const request = await tx.rescheduleRequest.upsert({
          where: { appointment_id: input.appointment_id },
          create: {
            appointment_id: input.appointment_id,
            requested_by_user_id: session.sub,
            new_work_day_id: target.work_day_id,
            new_starts_at: target.starts_at,
          },
          update: {
            status: "pending",
            new_work_day_id: target.work_day_id,
            new_starts_at: target.starts_at,
            requested_at: new Date(),
            reviewed_at: null,
            reviewed_by_user_id: null,
          },
        });
        return { kind: "requested" as const, info: probe, request_id: request.id };
      }
      return { kind: "moved" as const, info: await checkAndMaybeMove(tx, input.appointment_id, target, true) };
    });

    if (outcome.kind === "requested") {
      await notifyAdminsOfRescheduleRequest({
        appointment_id: outcome.info.appointment_id,
        service_name: outcome.info.service_name,
        customer_name: session.full_name,
        old_starts_at: outcome.info.old_starts_at,
        new_starts_at: outcome.info.new_starts_at,
      }).catch((err) => console.error("[notify] failed to notify admins of reschedule request:", err));
      revalidatePath("/account/appointments");
      return { success: true, pendingApproval: true };
    }

    const moved = {
      ...outcome.info,
      awaiting_approval: outcome.info.pending_booking_request,
    };

    // The move already succeeded — a failure to notify the barber must not surface as "couldn't update the appointment".
    await notifyAdminsOfCustomerReschedule({ ...moved, customer_name: session.full_name }).catch((err) =>
      console.error("[notify] failed to notify admins of reschedule:", err),
    );
    // Moving away from the old time frees that slot, same as a cancellation would.
    if (moved.old_starts_at >= new Date() && moved.old_starts_at.getTime() !== moved.new_starts_at.getTime()) {
      await notifyWaitlistOfFreedSlot(moved.old_starts_at, moved.service_name, session.sub).catch((err) =>
        console.error("[notify] failed to notify waitlist of freed slot:", err),
      );
    }
    return { success: true };
  } catch (err) {
    if (err instanceof Error && err.message === "SLOT_TAKEN") {
      return { error: "השעה כבר תפוסה — יש לבחור שעה אחרת" };
    }
    if (err instanceof Error && err.message === "PAST_SLOT") {
      return { error: "לא ניתן לשנות תור לשעה שכבר עברה" };
    }
    if (err instanceof Error && err.message === "FORBIDDEN") {
      return { error: "אין הרשאה לשנות תור זה" };
    }
    if (err instanceof Error && err.message === "DAY_BLOCKED") {
      return { error: "היום הזה חסום כרגע לקביעת תורים חדשים" };
    }
    if (err instanceof Error && err.message === "SERVICE_NOT_OFFERED") {
      return { error: "השירות הזה לא זמין אצל הספר הזה" };
    }
    if (err instanceof Error && err.message === "NOT_ACTIVE") {
      return { error: "התור כבר אינו פעיל" };
    }
    return { error: "לא ניתן היה לעדכן את התור, נסה/י שוב" };
  }
}
