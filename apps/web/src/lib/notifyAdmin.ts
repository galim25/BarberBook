import { prisma, sendPushToAdmins, type NotificationType } from "@barberbook/db";
import { formatIsraelDate, formatIsraelTime } from "@barberbook/shared";

type AdminNotificationInput = {
  type: NotificationType;
  message: string;
  push: { title: string; url: string };
  appointment_id?: string;
  cancellation_request_id?: string;
};

/** In-app Notification row for every administrator + a real device push. */
async function notifyAdmins(input: AdminNotificationInput): Promise<void> {
  const admins = await prisma.user.findMany({
    where: { role: "administrator" },
    select: { id: true },
  });
  if (admins.length === 0) return;

  await prisma.notification.createMany({
    data: admins.map((admin) => ({
      user_id: admin.id,
      appointment_id: input.appointment_id ?? null,
      cancellation_request_id: input.cancellation_request_id ?? null,
      type: input.type,
      content: input.message,
      status: "sent" as const,
      sent_at: new Date(),
    })),
  });

  await sendPushToAdmins({ ...input.push, body: input.message });
}

type NewBookingInfo = {
  appointment_id: string;
  service_name: string;
  customer_name: string;
  starts_at: Date;
};

/** In-app + push — every administrator gets a Notification when a customer books an appointment themselves. Manual bookings created by the admin do not trigger this. */
export async function notifyAdminsOfNewBooking(info: NewBookingInfo): Promise<void> {
  await notifyAdmins({
    type: "appointment_booked",
    message: `נקבע תור חדש: ${info.service_name} ל${info.customer_name} בתאריך ${formatIsraelDate(info.starts_at)} בשעה ${formatIsraelTime(info.starts_at)}.`,
    push: { title: "תור חדש", url: "/admin" },
    appointment_id: info.appointment_id,
  });
}

/**
 * In-app + push — fires only on the "requires approval" path (bookAppointmentAction/
 * bookViaPhone when getRequiresApproval() is true), where notifyAdminsOfNewBooking is
 * skipped in favor of this: the appointment already holds the slot, but the admin still
 * needs to actively approve/reject it in /admin/booking-requests.
 */
export async function notifyAdminsOfBookingRequest(info: NewBookingInfo): Promise<void> {
  await notifyAdmins({
    type: "booking_request_pending",
    message: `בקשת תור ממתינה לאישור: ${info.service_name} ל${info.customer_name} בתאריך ${formatIsraelDate(info.starts_at)} בשעה ${formatIsraelTime(info.starts_at)}.`,
    push: { title: "בקשת תור חדשה", url: "/admin/booking-requests" },
    appointment_id: info.appointment_id,
  });
}

type CancellationRequestInfo = {
  cancellation_request_id: string;
  service_name: string;
  customer_name: string;
  starts_at: Date;
};

/**
 * In-app + push — fires when a customer's cancellation only creates a pending
 * CancellationRequest (getRequiresApproval() is true); the immediate-cancellation
 * path (approval off) doesn't create a request at all — that one is
 * notifyAdminsOfCustomerCancellation.
 */
export async function notifyAdminsOfCancellationRequest(info: CancellationRequestInfo): Promise<void> {
  await notifyAdmins({
    type: "cancellation_request_pending",
    message: `בקשת ביטול ממתינה לאישור: ${info.service_name} של ${info.customer_name} בתאריך ${formatIsraelDate(info.starts_at)} בשעה ${formatIsraelTime(info.starts_at)}.`,
    push: { title: "בקשת ביטול חדשה", url: "/admin/cancellation-requests" },
    cancellation_request_id: info.cancellation_request_id,
  });
}

type CustomerCancellationInfo = {
  appointment_id: string;
  service_name: string;
  customer_name: string;
  starts_at: Date;
};

/** In-app + push — a customer cancelled their own appointment immediately (approval policy off), so there is no request for the barber to act on, only a change he should know about. */
export async function notifyAdminsOfCustomerCancellation(info: CustomerCancellationInfo): Promise<void> {
  await notifyAdmins({
    type: "appointment_changed",
    message: `תור בוטל ע"י הלקוח: ${info.service_name} של ${info.customer_name} בתאריך ${formatIsraelDate(info.starts_at)} בשעה ${formatIsraelTime(info.starts_at)}.`,
    push: { title: "תור בוטל", url: "/admin" },
    appointment_id: info.appointment_id,
  });
}

type CustomerRescheduleInfo = {
  appointment_id: string;
  service_name: string;
  customer_name: string;
  old_starts_at: Date;
  new_starts_at: Date;
};

/** In-app + push — a customer moved their own appointment to another time. */
export async function notifyAdminsOfCustomerReschedule(info: CustomerRescheduleInfo): Promise<void> {
  await notifyAdmins({
    type: "appointment_changed",
    message: `תור הועבר ע"י הלקוח: ${info.service_name} של ${info.customer_name} מ-${formatIsraelDate(info.old_starts_at)} ${formatIsraelTime(info.old_starts_at)} ל-${formatIsraelDate(info.new_starts_at)} ${formatIsraelTime(info.new_starts_at)}.`,
    push: { title: "תור הועבר", url: "/admin" },
    appointment_id: info.appointment_id,
  });
}

/** In-app + push — a new customer account was created (through the app's sign-up form or the phone line's new-caller registration). */
export async function notifyAdminsOfNewCustomer(info: { customer_name: string }): Promise<void> {
  await notifyAdmins({
    type: "customer_registered",
    message: `לקוח חדש נרשם: ${info.customer_name}.`,
    push: { title: "לקוח חדש", url: "/admin" },
  });
}
