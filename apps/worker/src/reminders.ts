import { prisma, sendPushToUser } from "@barberbook/db";
import {
  APPOINTMENT_REMINDER_LEAD_MINUTES,
  PAYMENT_REMINDER_DELAY_MINUTES,
  formatIsraelDate,
  formatIsraelTime,
  getSmsProvider,
} from "@barberbook/shared";

/**
 * Sends a reminder for every scheduled appointment starting within the lead
 * window that doesn't already have one. Idempotent across polls: the schema
 * has no separate "reminder_sent" flag, so "no existing appointment_reminder
 * Notification for this appointment" is the only guard against duplicates.
 * Appointments with no linked account (booked_by_user_id null) have no
 * phone number to reach and are skipped. Delivery: the Notification row, a
 * device push if the customer turned notifications on (needs the VAPID_* env
 * vars in apps/worker/.env — same values as apps/web/.env), and SMS (a no-op
 * until a real provider is configured).
 */
export async function sendDueReminders(): Promise<void> {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + APPOINTMENT_REMINDER_LEAD_MINUTES * 60_000);

  const appointments = await prisma.appointment.findMany({
    where: {
      status: "scheduled",
      starts_at: { gte: now, lte: windowEnd },
      booked_by_user_id: { not: null },
      notifications: { none: { type: "appointment_reminder" } },
    },
    include: { service: true, booked_by: true },
  });

  for (const appointment of appointments) {
    if (!appointment.booked_by) continue;

    // One failing reminder (e.g. the SMS provider throwing) must not stop the rest of the batch.
    // No Notification row is written on failure, so the next poll retries this appointment.
    try {
      const message = `תזכורת: יש לך תור ל${appointment.service.name} בתאריך ${formatIsraelDate(appointment.starts_at)} בשעה ${formatIsraelTime(appointment.starts_at)}.`;

      await getSmsProvider().send(appointment.booked_by.phone_number, message);
      await prisma.notification.create({
        data: {
          user_id: appointment.booked_by.id,
          appointment_id: appointment.id,
          type: "appointment_reminder",
          content: message,
          status: "sent",
          sent_at: new Date(),
        },
      });
      // Creating the Notification row above is what marks this reminder as sent (idempotency), so the
      // push is best-effort: sendPushToUser never throws and a customer with no subscribed device just gets no push.
      await sendPushToUser(appointment.booked_by.id, {
        title: "תזכורת לתור",
        body: message,
        url: "/account/appointments",
      });
    } catch (err) {
      console.error(`[worker] reminder for appointment ${appointment.id} failed:`, err);
    }
  }
}

/** Appointments that started longer ago than this are never reminded (e.g. after worker downtime or the first deploy). */
const PAYMENT_REMINDER_MAX_AGE_MINUTES = 6 * 60;

/**
 * Half an hour after an appointment starts, reminds the customer to pay the barber (in-app notification + push only, deliberately no SMS). Same
 * idempotency scheme as sendDueReminders: a payment_reminder Notification row marks it sent.
 * Appointments still awaiting the barber's approval are skipped (they may never happen).
 */
export async function sendDuePaymentReminders(): Promise<void> {
  const now = new Date();
  const dueBefore = new Date(now.getTime() - PAYMENT_REMINDER_DELAY_MINUTES * 60_000);
  const notBefore = new Date(now.getTime() - PAYMENT_REMINDER_MAX_AGE_MINUTES * 60_000);

  const appointments = await prisma.appointment.findMany({
    where: {
      status: "scheduled",
      starts_at: { gte: notBefore, lte: dueBefore },
      booked_by_user_id: { not: null },
      booking_request: { isNot: { status: "pending" } },
      notifications: { none: { type: "payment_reminder" } },
    },
    include: { booked_by: true },
  });

  for (const appointment of appointments) {
    if (!appointment.booked_by) continue;
    try {
      const message = "זוהי תזכורת מהספר לגבי תשלום על התספורת. אם שילמת, ראה הודעה זו כמבוטלת.";
      await prisma.notification.create({
        data: {
          user_id: appointment.booked_by.id,
          appointment_id: appointment.id,
          type: "payment_reminder",
          content: message,
          status: "sent",
          sent_at: new Date(),
        },
      });
      await sendPushToUser(appointment.booked_by.id, {
        title: "תזכורת תשלום",
        body: message,
        url: "/account",
      });
    } catch (err) {
      console.error(`[worker] payment reminder for appointment ${appointment.id} failed:`, err);
    }
  }
}
