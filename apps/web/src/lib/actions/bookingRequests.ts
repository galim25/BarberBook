"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@barberbook/db";
import { formatIsraelDate, formatIsraelTime } from "@barberbook/shared";
import { getSession } from "@/lib/auth/session";
import { sendCustomerNotification } from "@/lib/notifyCustomer";
import { notifyWaitlistOfFreedSlot } from "@/lib/actions/waitlist";
import type { BookingResult } from "@/lib/actions/booking";

async function requireAdminSession() {
  const session = await getSession();
  if (!session || session.role !== "administrator") return null;
  return session;
}

export type PendingBookingRequest = {
  id: string;
  appointment_id: string;
  customer_name: string;
  service_name: string;
  barber_name: string;
  starts_at: Date;
  requested_at: Date;
};

export async function getPendingBookingRequests(): Promise<PendingBookingRequest[]> {
  if (!(await requireAdminSession())) return [];
  const requests = await prisma.bookingRequest.findMany({
    where: { status: "pending" },
    include: {
      appointment: { include: { service: true, work_day: { include: { barber: true } } } },
    },
    orderBy: { requested_at: "asc" },
  });
  return requests.map((r) => ({
    id: r.id,
    appointment_id: r.appointment_id,
    customer_name: r.appointment.customer_name,
    service_name: r.appointment.service.name,
    barber_name: r.appointment.work_day.barber.full_name,
    starts_at: r.appointment.starts_at,
    requested_at: r.requested_at,
  }));
}

export async function getPendingBookingRequestCount(): Promise<number> {
  if (!(await requireAdminSession())) return 0;
  return prisma.bookingRequest.count({ where: { status: "pending" } });
}

async function decideBookingRequest(
  request_id: string,
  decision: "approved" | "rejected",
): Promise<BookingResult> {
  const session = await requireAdminSession();
  if (!session) return { error: "אין הרשאה" };

  const request = await prisma.bookingRequest.findUnique({
    where: { id: request_id },
    include: { appointment: { include: { service: true, booked_by: true } } },
  });
  if (!request) return { error: "הבקשה לא נמצאה" };
  if (request.status !== "pending") return { error: "הבקשה כבר טופלה" };

  await prisma.bookingRequest.update({
    where: { id: request_id },
    data: { status: decision, reviewed_by_user_id: session.sub, reviewed_at: new Date() },
  });

  const { appointment } = request;
  const { service, starts_at } = appointment;

  if (decision === "rejected") {
    await prisma.appointment.update({ where: { id: appointment.id }, data: { status: "cancelled" } });
    if (starts_at >= new Date()) {
      await notifyWaitlistOfFreedSlot(starts_at, service.name, appointment.booked_by_user_id);
    }
  }

  if (appointment.booked_by) {
    const message =
      decision === "approved"
        ? `התור שלך ל${service.name} בתאריך ${formatIsraelDate(starts_at)} בשעה ${formatIsraelTime(starts_at)} אושר ע"י הספר.`
        : `מצטערים, התור שלך ל${service.name} בתאריך ${formatIsraelDate(starts_at)} בשעה ${formatIsraelTime(starts_at)} נדחה ע"י הספר.`;
    await sendCustomerNotification({
      user_id: appointment.booked_by.id,
      phone_number: appointment.booked_by.phone_number,
      message,
      type: "booking_decision",
      appointment_id: appointment.id,
    });
  }

  revalidatePath("/admin/booking-requests");
  revalidatePath("/account/appointments");
  return { success: true };
}

export async function approveBookingRequestAction(request_id: string): Promise<BookingResult> {
  return decideBookingRequest(request_id, "approved");
}

export async function rejectBookingRequestAction(request_id: string): Promise<BookingResult> {
  return decideBookingRequest(request_id, "rejected");
}
