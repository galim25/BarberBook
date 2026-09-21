"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@barberbook/db";
import { formatIsraelDate, formatIsraelTime } from "@barberbook/shared";
import { getSession } from "@/lib/auth/session";
import { sendCustomerNotification } from "@/lib/notifyCustomer";
import { notifyWaitlistOfFreedSlot } from "@/lib/actions/waitlist";
import { notifyAdminsOfCancellationRequest, notifyAdminsOfCustomerCancellation } from "@/lib/notifyAdmin";
import { getRequiresApproval } from "@/lib/actions/settings";
import type { BookingResult } from "@/lib/actions/booking";

async function requireAdminSession() {
  const session = await getSession();
  if (!session || session.role !== "administrator") return null;
  return session;
}

/**
 * US-008, when the global approval switch is on: the customer only
 * *requests* cancellation — the appointment stays scheduled until the
 * barber approves it (see approveCancellationRequestAction).
 * CancellationRequest.appointment_id is unique in the schema (at most one
 * row per appointment, ever), so a prior rejected request is flipped back
 * to pending for a retry instead of inserting a second row.
 *
 * When the switch is off, cancellation happens immediately instead — same
 * effect as the admin's own cancelAppointmentAction — with no
 * CancellationRequest involved at all.
 */
export async function requestCancellationAction(appointment_id: string): Promise<BookingResult> {
  const session = await getSession();
  if (!session) return { error: "יש להתחבר" };

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointment_id },
    include: { cancellation_request: true, service: true },
  });
  if (!appointment || appointment.booked_by_user_id !== session.sub) {
    return { error: "אין הרשאה לבקש ביטול לתור זה" };
  }
  if (appointment.status !== "scheduled") {
    return { error: "התור כבר אינו פעיל" };
  }

  if (!(await getRequiresApproval())) {
    await prisma.appointment.update({ where: { id: appointment_id }, data: { status: "cancelled" } });
    if (appointment.starts_at >= new Date()) {
      await notifyAdminsOfCustomerCancellation({
        appointment_id: appointment.id,
        service_name: appointment.service.name,
        customer_name: session.full_name,
        starts_at: appointment.starts_at,
      });
      await notifyWaitlistOfFreedSlot(appointment.starts_at, appointment.service.name, appointment.booked_by_user_id);
    }
    revalidatePath("/account/appointments");
    return { success: true };
  }

  const existing = appointment.cancellation_request;
  if (existing?.status === "pending") {
    return { error: "כבר יש בקשת ביטול פעילה לתור זה" };
  }

  const request = existing
    ? await prisma.cancellationRequest.update({
        where: { id: existing.id },
        data: { status: "pending", requested_at: new Date(), reviewed_at: null, reviewed_by_user_id: null },
      })
    : await prisma.cancellationRequest.create({
        data: { appointment_id, requested_by_user_id: session.sub, status: "pending" },
      });

  await notifyAdminsOfCancellationRequest({
    cancellation_request_id: request.id,
    service_name: appointment.service.name,
    customer_name: session.full_name,
    starts_at: appointment.starts_at,
  });

  revalidatePath("/account/appointments");
  return { success: true };
}

export type PendingCancellationRequest = {
  id: string;
  appointment_id: string;
  customer_name: string;
  service_name: string;
  barber_name: string;
  starts_at: Date;
  requested_at: Date;
};

export async function getPendingCancellationRequests(): Promise<PendingCancellationRequest[]> {
  if (!(await requireAdminSession())) return [];
  const requests = await prisma.cancellationRequest.findMany({
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

export async function getPendingCancellationCount(): Promise<number> {
  if (!(await requireAdminSession())) return 0;
  return prisma.cancellationRequest.count({ where: { status: "pending" } });
}

async function decideCancellationRequest(
  request_id: string,
  decision: "approved" | "rejected",
): Promise<BookingResult> {
  const session = await requireAdminSession();
  if (!session) return { error: "אין הרשאה" };

  const request = await prisma.cancellationRequest.findUnique({
    where: { id: request_id },
    include: { appointment: { include: { service: true, booked_by: true } } },
  });
  if (!request) return { error: "הבקשה לא נמצאה" };
  if (request.status !== "pending") return { error: "הבקשה כבר טופלה" };

  await prisma.cancellationRequest.update({
    where: { id: request_id },
    data: { status: decision, reviewed_by_user_id: session.sub, reviewed_at: new Date() },
  });

  if (decision === "approved") {
    await prisma.appointment.update({
      where: { id: request.appointment_id },
      data: { status: "cancelled" },
    });
    if (request.appointment.starts_at >= new Date()) {
      await notifyWaitlistOfFreedSlot(
        request.appointment.starts_at,
        request.appointment.service.name,
        request.appointment.booked_by_user_id,
      );
    }
  }

  if (request.appointment.booked_by) {
    const { service, starts_at } = request.appointment;
    const message =
      decision === "approved"
        ? `בקשת הביטול שלך לתור ${service.name} בתאריך ${formatIsraelDate(starts_at)} בשעה ${formatIsraelTime(starts_at)} אושרה — התור בוטל.`
        : `בקשת הביטול שלך לתור ${service.name} בתאריך ${formatIsraelDate(starts_at)} בשעה ${formatIsraelTime(starts_at)} נדחתה — התור נשאר בתוקף.`;
    await sendCustomerNotification({
      user_id: request.appointment.booked_by.id,
      phone_number: request.appointment.booked_by.phone_number,
      message,
      type: "cancellation_decision",
      appointment_id: request.appointment_id,
      cancellation_request_id: request.id,
    });
  }

  revalidatePath("/admin/cancellation-requests");
  revalidatePath("/account/appointments");
  return { success: true };
}

export async function approveCancellationRequestAction(request_id: string): Promise<BookingResult> {
  return decideCancellationRequest(request_id, "approved");
}

export async function rejectCancellationRequestAction(request_id: string): Promise<BookingResult> {
  return decideCancellationRequest(request_id, "rejected");
}
