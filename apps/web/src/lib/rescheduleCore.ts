import type { Prisma } from "@barberbook/db";
import { isServiceAllowedForBarber } from "@barberbook/shared";
import { isSlotAvailable, type Interval } from "@/lib/availability";

type Tx = Prisma.TransactionClient;

export type RescheduleTarget = { work_day_id: string; starts_at: Date };

export type CheckedReschedule = {
  appointment_id: string;
  service_name: string;
  customer_name: string;
  booked_by_user_id: string | null;
  old_starts_at: Date;
  old_ends_at: Date;
  new_starts_at: Date;
  duration_minutes: number;
  pending_booking_request: boolean;
};

/**
 * Validates that an appointment may move to `target` (blocked day, service offered by that barber,
 * past slot, slot free) and — only when `apply` is true — performs the move. Shared by the customer's
 * immediate reschedule (approval off), the request creation (validate only) and the barber's approval
 * of a request (apply). Deliberately not a "use server" file; callers do their own auth.
 * Throws plain Error("DAY_BLOCKED" | "SERVICE_NOT_OFFERED" | "PAST_SLOT" | "SLOT_TAKEN").
 */
export async function checkAndMaybeMove(
  tx: Tx,
  appointment_id: string,
  target: RescheduleTarget,
  apply: boolean,
): Promise<CheckedReschedule> {
  const appointment = await tx.appointment.findUniqueOrThrow({
    where: { id: appointment_id },
    include: { service: true, booking_request: true },
  });
  const workDay = await tx.workDay.findUniqueOrThrow({
    where: { id: target.work_day_id },
    include: {
      barber: { select: { is_primary: true } },
      breaks: true,
      blocked_times: true,
      appointments: { where: { status: "scheduled" } },
    },
  });
  if (workDay.is_blocked) throw new Error("DAY_BLOCKED");
  if (!isServiceAllowedForBarber(workDay.barber.is_primary, appointment.service.name)) {
    throw new Error("SERVICE_NOT_OFFERED");
  }
  const busy: Interval[] = [
    ...workDay.breaks.map((b) => ({ starts_at: b.starts_at, ends_at: b.ends_at })),
    ...workDay.blocked_times.map((b) => ({ starts_at: b.starts_at, ends_at: b.ends_at })),
    ...workDay.appointments
      .filter((a) => a.id !== appointment.id)
      .map((a) => ({ starts_at: a.starts_at, ends_at: a.ends_at })),
  ];
  if (target.starts_at < new Date()) throw new Error("PAST_SLOT");
  const ok = isSlotAvailable(
    target.starts_at,
    appointment.service.duration_minutes,
    { starts_at: workDay.starts_at, ends_at: workDay.ends_at },
    busy,
  );
  if (!ok) throw new Error("SLOT_TAKEN");

  if (apply) {
    await tx.appointment.update({
      where: { id: appointment.id },
      data: {
        work_day_id: target.work_day_id,
        starts_at: target.starts_at,
        ends_at: new Date(target.starts_at.getTime() + appointment.service.duration_minutes * 60_000),
      },
    });
  }

  return {
    appointment_id: appointment.id,
    service_name: appointment.service.name,
    customer_name: appointment.customer_name,
    booked_by_user_id: appointment.booked_by_user_id,
    old_starts_at: appointment.starts_at,
    old_ends_at: appointment.ends_at,
    new_starts_at: target.starts_at,
    duration_minutes: appointment.service.duration_minutes,
    pending_booking_request: appointment.booking_request?.status === "pending",
  };
}
