"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@barberbook/db";
import { formatIsraelDate, formatIsraelTime } from "@barberbook/shared";
import { getSession } from "@/lib/auth/session";
import { getContactNameMap } from "@/lib/contactNames";
import { sendCustomerNotification } from "@/lib/notifyCustomer";
import { notifyWaitlistOfFreedSlot } from "@/lib/actions/waitlist";
import { runSerializable } from "@/lib/serializableTransaction";
import { checkAndMaybeMove } from "@/lib/rescheduleCore";
import type { BookingResult } from "@/lib/actions/booking";

async function requireAdminSession() {
  const session = await getSession();
  if (!session || session.role !== "administrator") return null;
  return session;
}

export type PendingRescheduleRequest = {
  id: string;
  customer_name: string;
  phone_number: string;
  contact_name: string | null;
  service_name: string;
  old_barber_name: string;
  new_barber_name: string;
  old_starts_at: Date;
  new_starts_at: Date;
  requested_at: Date;
};

export async function getPendingRescheduleRequests(): Promise<PendingRescheduleRequest[]> {
  if (!(await requireAdminSession())) return [];
  const requests = await prisma.rescheduleRequest.findMany({
    where: { status: "pending", appointment: { status: "scheduled" } },
    include: {
      appointment: { include: { service: true, work_day: { include: { barber: true } } } },
      requested_by: { select: { phone_number: true } },
    },
    orderBy: { requested_at: "asc" },
  });
  const newDays = await prisma.workDay.findMany({
    where: { id: { in: requests.map((r) => r.new_work_day_id) } },
    select: { id: true, barber: { select: { full_name: true } } },
  });
  const newBarber = new Map(newDays.map((d) => [d.id, d.barber.full_name]));
  const contactNames = await getContactNameMap(requests.map((r) => r.requested_by.phone_number));
  return requests.map((r) => ({
    id: r.id,
    customer_name: r.appointment.customer_name,
    phone_number: r.requested_by.phone_number,
    contact_name: contactNames.get(r.requested_by.phone_number) ?? null,
    service_name: r.appointment.service.name,
    old_barber_name: r.appointment.work_day.barber.full_name,
    new_barber_name: newBarber.get(r.new_work_day_id) ?? r.appointment.work_day.barber.full_name,
    old_starts_at: r.appointment.starts_at,
    new_starts_at: r.new_starts_at,
    requested_at: r.requested_at,
  }));
}

export async function getPendingRescheduleCount(): Promise<number> {
  if (!(await requireAdminSession())) return 0;
  return prisma.rescheduleRequest.count({
    where: { status: "pending", appointment: { status: "scheduled" } },
  });
}

/** The customer takes back a pending change request; the appointment simply stays as it was. */
export async function withdrawRescheduleRequestAction(appointment_id: string): Promise<BookingResult> {
  const session = await getSession();
  if (!session) return { error: "יש להתחבר" };
  const { count } = await prisma.rescheduleRequest.deleteMany({
    where: { appointment_id, requested_by_user_id: session.sub, status: "pending" },
  });
  if (count === 0) return { error: "אין בקשת שינוי פעילה לתור זה" };
  revalidatePath("/account/appointments");
  revalidatePath("/admin/reschedule-requests");
  return { success: true };
}

async function decideRescheduleRequest(
  request_id: string,
  decision: "approved" | "rejected",
): Promise<BookingResult> {
  const session = await requireAdminSession();
  if (!session) return { error: "אין הרשאה" };

  let moved: { old_starts_at: Date; new_starts_at: Date; service_name: string } | undefined;
  let request;
  try {
    request = await runSerializable(async (tx) => {
      const req = await tx.rescheduleRequest.findUnique({
        where: { id: request_id },
        include: { appointment: { include: { service: true, booked_by: true } } },
      });
      if (!req) throw new Error("NOT_FOUND");
      if (req.status !== "pending") throw new Error("ALREADY_DECIDED");
      if (req.appointment.status !== "scheduled") throw new Error("NOT_ACTIVE");

      if (decision === "approved") {
        // Re-checked now: the slot isn't held while the request waits, someone else may have taken it.
        const info = await checkAndMaybeMove(
          tx,
          req.appointment_id,
          { work_day_id: req.new_work_day_id, starts_at: req.new_starts_at },
          true,
        );
        moved = info;
      }
      await tx.rescheduleRequest.update({
        where: { id: request_id },
        data: { status: decision, reviewed_by_user_id: session.sub, reviewed_at: new Date() },
      });
      return req;
    });
  } catch (err) {
    const m = err instanceof Error ? err.message : "";
    if (m === "NOT_FOUND") return { error: "הבקשה לא נמצאה" };
    if (m === "ALREADY_DECIDED") return { error: "הבקשה כבר טופלה" };
    if (m === "NOT_ACTIVE") return { error: "התור כבר אינו פעיל" };
    if (m === "SLOT_TAKEN") return { error: "השעה המבוקשת כבר נתפסה — אפשר לדחות את הבקשה" };
    if (m === "PAST_SLOT") return { error: "השעה המבוקשת כבר עברה — אפשר לדחות את הבקשה" };
    if (m === "DAY_BLOCKED") return { error: "היום המבוקש נחסם — אפשר לדחות את הבקשה" };
    if (m === "SERVICE_NOT_OFFERED") return { error: "השירות לא זמין אצל הספר המבוקש — אפשר לדחות את הבקשה" };
    console.error("[reschedule] decision failed:", err);
    return { error: "לא ניתן היה לטפל בבקשה, נסה/י שוב" };
  }

  if (moved && moved.old_starts_at >= new Date() && moved.old_starts_at.getTime() !== moved.new_starts_at.getTime()) {
    await notifyWaitlistOfFreedSlot(
      moved.old_starts_at,
      request.appointment.ends_at,
      request.appointment.booked_by_user_id,
    ).catch((err) => console.error("[notify] failed to notify waitlist of freed slot:", err));
  }

  const { booked_by, service, starts_at: oldStart } = request.appointment;
  if (booked_by) {
    const message =
      decision === "approved"
        ? `בקשת שינוי התור שלך אושרה — ${service.name} עבר ל-${formatIsraelDate(request.new_starts_at)} בשעה ${formatIsraelTime(request.new_starts_at)}.`
        : `בקשת שינוי התור שלך נדחתה — התור נשאר ב-${formatIsraelDate(oldStart)} בשעה ${formatIsraelTime(oldStart)}.`;
    await sendCustomerNotification({
      user_id: booked_by.id,
      phone_number: booked_by.phone_number,
      message,
      type: "reschedule_decision",
      appointment_id: request.appointment_id,
    }).catch((err) => console.error("[notify] failed to notify customer of reschedule decision:", err));
  }

  revalidatePath("/admin/reschedule-requests");
  revalidatePath("/admin");
  revalidatePath("/account/appointments");
  return { success: true };
}

export async function approveRescheduleRequestAction(request_id: string): Promise<BookingResult> {
  return decideRescheduleRequest(request_id, "approved");
}

export async function rejectRescheduleRequestAction(request_id: string): Promise<BookingResult> {
  return decideRescheduleRequest(request_id, "rejected");
}
