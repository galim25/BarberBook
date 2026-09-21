"use server";

import { revalidatePath } from "next/cache";
import { prisma, Prisma } from "@barberbook/db";
import { formatIsraelDate, formatIsraelTime, isServiceAllowedForBarber } from "@barberbook/shared";
import { getSession } from "@/lib/auth/session";
import { isSlotAvailable, type Interval } from "@/lib/availability";
import { runSerializable } from "@/lib/serializableTransaction";
import { notifyAppointmentCancelled, sendCustomerNotification } from "@/lib/notifyCustomer";
import { notifyWaitlistOfFreedSlot } from "@/lib/actions/waitlist";
import type { BookingResult } from "@/lib/actions/booking";

export type AdminAppointmentView = {
  id: string;
  service_id: string;
  service_name: string;
  duration_minutes: number;
  customer_name: string;
  attendee_name: string;
  attendee_type: string;
  starts_at: Date;
  ends_at: Date;
  has_account: boolean;
  booked_via_ivr: boolean;
  /** Only filled for phone-booked appointments (shown next to a call button) — null otherwise. */
  phone_number: string | null;
};

async function requireAdminSession() {
  const session = await getSession();
  if (!session || session.role !== "administrator") return null;
  return session;
}

export async function getAppointmentsForWorkDay(work_day_id: string): Promise<AdminAppointmentView[]> {
  if (!(await requireAdminSession())) return [];
  const appointments = await prisma.appointment.findMany({
    where: { work_day_id, status: "scheduled" },
    include: { service: true, booked_by: { select: { phone_number: true } } },
    orderBy: { starts_at: "asc" },
  });
  return appointments.map((a) => ({
    id: a.id,
    service_id: a.service_id,
    service_name: a.service.name,
    duration_minutes: a.service.duration_minutes,
    customer_name: a.customer_name,
    attendee_name: a.attendee_name,
    attendee_type: a.attendee_type,
    starts_at: a.starts_at,
    ends_at: a.ends_at,
    has_account: a.booked_by_user_id !== null,
    booked_via_ivr: a.booked_via_ivr,
    phone_number: a.booked_via_ivr ? (a.booked_by?.phone_number ?? null) : null,
  }));
}

type AdminRescheduleInput = {
  appointment_id: string;
  work_day_id: string;
  starts_at: string;
};

/**
 * Admin can move any appointment (including walk-ins with no linked account),
 * unlike the customer-facing reschedule action there is no ownership check.
 * When the appointment does have a linked customer account, we notify them —
 * SMS via the shared mock provider (real delivery is Phase 4) plus a
 * Notification row for the in-app history.
 */
export async function adminRescheduleAppointmentAction(
  input: AdminRescheduleInput,
): Promise<BookingResult> {
  if (!(await requireAdminSession())) return { error: "אין הרשאה" };

  type NotifyPayload = { user_id: string; phone_number: string; appointment_id: string; message: string };

  try {
    const notify = await prisma.$transaction(
      async (tx): Promise<NotifyPayload | null> => {
        const appointment = await tx.appointment.findUniqueOrThrow({
          where: { id: input.appointment_id },
          include: { service: true, booked_by: true },
        });

        const workDay = await tx.workDay.findUniqueOrThrow({
          where: { id: input.work_day_id },
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
            .filter((a) => a.id !== appointment.id)
            .map((a) => ({ starts_at: a.starts_at, ends_at: a.ends_at })),
        ];

        const starts_at = new Date(input.starts_at);
        const ok = isSlotAvailable(
          starts_at,
          appointment.service.duration_minutes,
          { starts_at: workDay.starts_at, ends_at: workDay.ends_at },
          busy,
        );
        if (!ok) throw new Error("SLOT_TAKEN");

        const ends_at = new Date(starts_at.getTime() + appointment.service.duration_minutes * 60_000);

        await tx.appointment.update({
          where: { id: appointment.id },
          data: { work_day_id: input.work_day_id, starts_at, ends_at },
        });

        if (!appointment.booked_by) return null;
        return {
          user_id: appointment.booked_by.id,
          phone_number: appointment.booked_by.phone_number,
          appointment_id: appointment.id,
          message: `שים/י לב: הספר שינה את מועד התור שלך (${appointment.service.name}) ל-${formatIsraelDate(starts_at)} בשעה ${formatIsraelTime(starts_at)}.`,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (notify) {
      await sendCustomerNotification({
        user_id: notify.user_id,
        phone_number: notify.phone_number,
        message: notify.message,
        type: "appointment_changed",
        appointment_id: notify.appointment_id,
      });
    }

    revalidatePath(`/admin/day/${input.work_day_id}`);
    return { success: true };
  } catch (err) {
    if (err instanceof Error && err.message === "SLOT_TAKEN") {
      return { error: "השעה כבר תפוסה — יש לבחור שעה אחרת" };
    }
    return { error: "לא ניתן היה להעביר את התור, נסה/י שוב" };
  }
}

/**
 * FR-12: the barber's day-to-day "delete a single appointment" is a soft
 * cancel (status flip, not a row delete) — it just needs to disappear from
 * availability and the day view, both of which already filter on
 * status="scheduled". A hard purge is a separate, deliberate action (see
 * deleteWorkDayAction) reserved for clearing out historical data.
 */
export async function cancelAppointmentAction(appointment_id: string): Promise<BookingResult> {
  if (!(await requireAdminSession())) return { error: "אין הרשאה" };

  const appointment = await prisma.appointment.update({
    where: { id: appointment_id },
    data: { status: "cancelled" },
    include: { service: true, booked_by: true },
  });

  if (appointment.booked_by && appointment.starts_at >= new Date()) {
    await notifyAppointmentCancelled({
      user_id: appointment.booked_by.id,
      phone_number: appointment.booked_by.phone_number,
      service_name: appointment.service.name,
      starts_at: appointment.starts_at,
      appointment_id: appointment.id,
    });
  }

  if (appointment.starts_at >= new Date()) {
    await notifyWaitlistOfFreedSlot(appointment.starts_at, appointment.service.name, appointment.booked_by_user_id);
  }

  revalidatePath(`/admin/day/${appointment.work_day_id}`);
  return { success: true };
}

type CreateManualAppointmentInput = {
  work_day_id: string;
  service_id: string;
  starts_at: string;
  customer_name: string;
  /** Required when the chosen service is a child service; ignored otherwise. */
  attendee_name?: string;
};

/**
 * FR-13/US-011: the barber records an appointment for a customer who called
 * or walked in without using the app — no account, no phone number, just a
 * name. Same self/child semantics as the customer-facing booking flow, and
 * the same conflict checking, just with booked_by_user_id left null.
 */
export async function createManualAppointmentAction(
  input: CreateManualAppointmentInput,
): Promise<BookingResult> {
  if (!(await requireAdminSession())) return { error: "אין הרשאה" };

  const customer_name = input.customer_name.trim();
  if (!customer_name) return { error: "יש להזין שם לקוח" };

  try {
    await runSerializable(async (tx) => {
      const service = await tx.service.findUniqueOrThrow({ where: { id: input.service_id } });
      const workDay = await tx.workDay.findUniqueOrThrow({
        where: { id: input.work_day_id },
        include: {
          barber: { select: { is_primary: true } },
          breaks: true,
          blocked_times: true,
          appointments: { where: { status: "scheduled" } },
        },
      });
      if (!isServiceAllowedForBarber(workDay.barber.is_primary, service.name)) {
        throw new Error("SERVICE_NOT_OFFERED");
      }
      const busy: Interval[] = [
        ...workDay.breaks.map((b) => ({ starts_at: b.starts_at, ends_at: b.ends_at })),
        ...workDay.blocked_times.map((b) => ({ starts_at: b.starts_at, ends_at: b.ends_at })),
        ...workDay.appointments.map((a) => ({ starts_at: a.starts_at, ends_at: a.ends_at })),
      ];

      const starts_at = new Date(input.starts_at);
      const ok = isSlotAvailable(
        starts_at,
        service.duration_minutes,
        { starts_at: workDay.starts_at, ends_at: workDay.ends_at },
        busy,
      );
      if (!ok) throw new Error("SLOT_TAKEN");

      const attendee_name = input.attendee_name?.trim();
      if (service.is_child_service && !attendee_name) {
        throw new Error("ATTENDEE_NAME_REQUIRED");
      }

      await tx.appointment.create({
        data: {
          work_day_id: input.work_day_id,
          service_id: input.service_id,
          booked_by_user_id: null,
          customer_name,
          attendee_name: service.is_child_service ? attendee_name! : customer_name,
          attendee_type: service.is_child_service ? "child" : "self",
          starts_at,
          ends_at: new Date(starts_at.getTime() + service.duration_minutes * 60_000),
          status: "scheduled",
        },
      });
    });
  } catch (err) {
    if (err instanceof Error && err.message === "SLOT_TAKEN") {
      return { error: "השעה כבר תפוסה — יש לבחור שעה אחרת" };
    }
    if (err instanceof Error && err.message === "ATTENDEE_NAME_REQUIRED") {
      return { error: "יש להזין את שם הילד/ה" };
    }
    if (err instanceof Error && err.message === "SERVICE_NOT_OFFERED") {
      return { error: "השירות הזה לא זמין אצל הספר הזה" };
    }
    return { error: "לא ניתן היה לשמור את התור, נסה/י שוב" };
  }

  revalidatePath(`/admin/day/${input.work_day_id}`);
  return { success: true };
}
