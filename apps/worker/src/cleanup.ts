import { ISRAEL_TIME_ZONE, zonedTimeToUtc } from "@barberbook/shared";
import { prisma } from "@barberbook/db";

/** Deletes SMS login codes (docs/SMS-LOGIN.md) that expired more than a day ago — they are useless the moment they expire, this just stops the table growing forever. */
export async function purgeExpiredLoginCodes(): Promise<void> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60_000);
  const { count } = await prisma.loginCode.deleteMany({ where: { expires_at: { lt: cutoff } } });
  if (count > 0) console.log(`[worker] purged ${count} expired login codes`);
}

/** Midnight (00:00) of the current Israel calendar day as a UTC instant (DST-safe via shared zonedTimeToUtc). */
function israelMidnightToday(now: Date = new Date()): Date {
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: ISRAEL_TIME_ZONE }).format(now);
  return zonedTimeToUtc(ymd, "00:00", ISRAEL_TIME_ZONE);
}

/** Notification types the barber sees on the admin notifications screen (see adminNotifications.ts). */
const ADMIN_SCREEN_NOTIFICATION_TYPES = [
  "appointment_booked",
  "booking_request_pending",
  "cancellation_request_pending",
  "reschedule_request_pending",
  "appointment_changed",
] as const;

/**
 * Nightly at 00:00 Israel time:
 *  1. Clears the barber's notifications that are no longer relevant — those about an appointment whose
 *     time has already passed, whatever its status (even an unhandled request), plus "new customer" and
 *     "joined the waitlist" notifications from before midnight. Customers' own notifications are never touched.
 *  2. Deletes past appointments the barber approved (BookingRequest approved). Appointments in any other
 *     state (never needed approval, pending, rejected, cancelled) are kept.
 * Idempotent, so a night the worker was down is caught up by the next run.
 */
export async function purgeFinishedDay(): Promise<void> {
  const now = new Date();
  const midnight = israelMidnightToday(now);
  const admins = { user: { role: "administrator" as const } };
  const [notifications, registrations, appointments] = await prisma.$transaction([
    prisma.notification.deleteMany({
      where: {
        ...admins,
        type: { in: [...ADMIN_SCREEN_NOTIFICATION_TYPES] },
        OR: [
          { appointment: { ends_at: { lt: now } } },
          { cancellation_request: { appointment: { ends_at: { lt: now } } } },
        ],
      },
    }),
    prisma.notification.deleteMany({
      where: { ...admins, type: { in: ["customer_registered", "waitlist_joined"] }, created_at: { lt: midnight } },
    }),
    prisma.appointment.deleteMany({
      where: { ends_at: { lt: now }, booking_request: { is: { status: "approved" } } },
    }),
  ]);
  console.log(
    `[worker] nightly purge: ${notifications.count} admin notifications, ${registrations.count} registration notifications, ${appointments.count} approved past appointments`,
  );
}
