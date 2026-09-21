import { prisma, sendPushToUser, type NotificationType } from "@barberbook/db";
import { getSmsProvider, formatIsraelDate, formatIsraelTime } from "@barberbook/shared";

type CustomerNotificationInput = {
  user_id: string;
  phone_number: string;
  message: string;
  type: NotificationType;
  /**
   * Only reference a row that will still exist after this call returns.
   * A hard-deleted appointment can't be referenced — both fields are
   * optional for exactly this case (e.g. purging history), and the
   * cascade would delete the notification right along with its parent
   * if we tried to point it at a row we're about to remove.
   */
  appointment_id?: string;
  cancellation_request_id?: string;
};

/** Push title + the page a tap opens, per notification type (customer-facing types only). */
function pushMetaFor(type: NotificationType): { title: string; url: string } {
  switch (type) {
    case "appointment_changed":
      return { title: "שינוי בתור שלך", url: "/account/appointments" };
    case "cancellation_decision":
      return { title: "בקשת הביטול שלך", url: "/account/appointments" };
    case "booking_decision":
      return { title: "בקשת התור שלך", url: "/account/appointments" };
    case "appointment_reminder":
      return { title: "תזכורת לתור", url: "/account/appointments" };
    case "waitlist_slot_available":
      return { title: "יש תור פנוי", url: "/account/book" };
    default:
      return { title: "BarberBook", url: "/account" };
  }
}

/** SMS (mock provider — real delivery is Phase 4) + a persisted Notification row + a real device push. The one place that writes to Notification for customers, so every customer-facing message stays consistent. */
export async function sendCustomerNotification(input: CustomerNotificationInput): Promise<void> {
  await getSmsProvider().send(input.phone_number, input.message);
  await prisma.notification.create({
    data: {
      user_id: input.user_id,
      appointment_id: input.appointment_id ?? null,
      cancellation_request_id: input.cancellation_request_id ?? null,
      type: input.type,
      content: input.message,
      status: "sent",
      sent_at: new Date(),
    },
  });
  await sendPushToUser(input.user_id, { ...pushMetaFor(input.type), body: input.message });
}

type CancelledAppointmentInfo = {
  user_id: string;
  phone_number: string;
  service_name: string;
  starts_at: Date;
  /** Only pass when the appointment row will still exist after this call returns (see sendCustomerNotification). */
  appointment_id?: string;
};

/** Used whenever the barber directly cancels/deletes an appointment (not a customer-initiated cancellation request). */
export async function notifyAppointmentCancelled(info: CancelledAppointmentInfo): Promise<void> {
  const message = `שים/י לב: התור שלך ל${info.service_name} בתאריך ${formatIsraelDate(info.starts_at)} בשעה ${formatIsraelTime(info.starts_at)} בוטל ע"י הספר.`;
  await sendCustomerNotification({
    user_id: info.user_id,
    phone_number: info.phone_number,
    message,
    type: "appointment_changed",
    appointment_id: info.appointment_id,
  });
}
