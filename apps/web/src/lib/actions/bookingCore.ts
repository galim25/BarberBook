import { isServiceAllowedForBarber } from "@barberbook/shared";
import { isSlotAvailable, type Interval } from "@/lib/availability";
import { runSerializable } from "@/lib/serializableTransaction";

export type BookingActor = { user_id: string; customer_name: string };

export type CreateAppointmentInput = {
  work_day_id: string;
  service_id: string;
  starts_at: string;
  /** Required when the chosen service is a child service; ignored otherwise. */
  attendee_name?: string;
};

export type BookedAppointment = {
  appointment_id: string;
  service_name: string;
  customer_name: string;
  starts_at: Date;
};

/**
 * Transactional core shared by the customer app (booking.ts's
 * bookAppointmentAction) and the phone IVR (ivr/bookViaPhone.ts) — the only
 * place that actually creates an Appointment (+ BookingRequest when
 * requires_approval is on). Deliberately not a "use server" file: it takes
 * an explicit `actor` instead of reading getSession(), so a Twilio call
 * (which has no browser session) can supply its own already-identified
 * user without this being reachable as a client-callable RPC. Throws plain
 * Error("SLOT_TAKEN" | "PAST_SLOT" | "ATTENDEE_NAME_REQUIRED" |
 * "DAY_BLOCKED" | "SERVICE_NOT_OFFERED") — each caller maps these to its
 * own UI/voice text.
 */
export async function bookAppointmentCore(
  input: CreateAppointmentInput,
  actor: BookingActor,
  requiresApproval: boolean,
  /** True only for the phone IVR — recorded on the appointment so the barber can see how it was booked. */
  viaIvr = false,
): Promise<BookedAppointment> {
  return runSerializable(async (tx) => {
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
    if (workDay.is_blocked) {
      throw new Error("DAY_BLOCKED");
    }
    if (!isServiceAllowedForBarber(workDay.barber.is_primary, service.name)) {
      throw new Error("SERVICE_NOT_OFFERED");
    }
    const busy: Interval[] = [
      ...workDay.breaks.map((b) => ({ starts_at: b.starts_at, ends_at: b.ends_at })),
      ...workDay.blocked_times.map((b) => ({ starts_at: b.starts_at, ends_at: b.ends_at })),
      ...workDay.appointments.map((a) => ({ starts_at: a.starts_at, ends_at: a.ends_at })),
    ];

    const starts_at = new Date(input.starts_at);
    if (starts_at < new Date()) {
      throw new Error("PAST_SLOT");
    }
    const ok = isSlotAvailable(
      starts_at,
      service.duration_minutes,
      { starts_at: workDay.starts_at, ends_at: workDay.ends_at },
      busy,
    );
    if (!ok) {
      throw new Error("SLOT_TAKEN");
    }

    const attendee_name = input.attendee_name?.trim();
    if (service.is_child_service && !attendee_name) {
      throw new Error("ATTENDEE_NAME_REQUIRED");
    }

    const appointment = await tx.appointment.create({
      data: {
        work_day_id: input.work_day_id,
        service_id: input.service_id,
        booked_by_user_id: actor.user_id,
        customer_name: actor.customer_name,
        attendee_name: service.is_child_service ? attendee_name! : actor.customer_name,
        attendee_type: service.is_child_service ? "child" : "self",
        starts_at,
        ends_at: new Date(starts_at.getTime() + service.duration_minutes * 60_000),
        status: "scheduled",
        booked_via_ivr: viaIvr,
      },
    });

    if (requiresApproval) {
      await tx.bookingRequest.create({ data: { appointment_id: appointment.id } });
    }

    return {
      appointment_id: appointment.id,
      service_name: service.name,
      customer_name: actor.customer_name,
      starts_at,
    };
  });
}
