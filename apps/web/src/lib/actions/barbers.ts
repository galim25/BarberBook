"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@barberbook/db";
import { SUB_BARBER_SERVICE_NAMES } from "@barberbook/shared";
import { getSession } from "@/lib/auth/session";
import { notifyAppointmentCancelled } from "@/lib/notifyCustomer";

export type BarberOption = { id: string; full_name: string; is_primary: boolean };
export type BarberAdminView = BarberOption & { is_active: boolean };
export type BarberActionResult = { error?: string; success?: boolean };

async function requireAdminSession() {
  const session = await getSession();
  if (!session || session.role !== "administrator") return null;
  return session;
}

export async function getBarbersAdmin(): Promise<BarberAdminView[]> {
  if (!(await requireAdminSession())) return [];
  return prisma.barber.findMany({
    orderBy: [{ is_primary: "desc" }, { created_at: "asc" }],
    select: { id: true, full_name: true, is_primary: true, is_active: true },
  });
}

/** Customer-facing barber picker (new booking) — active barbers only. */
export async function getActiveBarbers(): Promise<BarberOption[]> {
  return prisma.barber.findMany({
    where: { is_active: true },
    orderBy: [{ is_primary: "desc" }, { full_name: "asc" }],
    select: { id: true, full_name: true, is_primary: true },
  });
}

/**
 * Customer-facing barber picker for reschedule — same as getActiveBarbers,
 * but a service outside SUB_BARBER_SERVICE_NAMES can only ever be offered
 * by the primary barber, so non-primary barbers are excluded for those.
 */
export async function getActiveBarbersForService(service_id: string): Promise<BarberOption[]> {
  const service = await prisma.service.findUniqueOrThrow({ where: { id: service_id } });
  const restrictedToPrimary = !(SUB_BARBER_SERVICE_NAMES as readonly string[]).includes(service.name);
  return prisma.barber.findMany({
    where: { is_active: true, ...(restrictedToPrimary ? { is_primary: true } : {}) },
    orderBy: [{ is_primary: "desc" }, { full_name: "asc" }],
    select: { id: true, full_name: true, is_primary: true },
  });
}

export async function addBarberAction(full_name: string): Promise<BarberActionResult> {
  if (!(await requireAdminSession())) return { error: "אין הרשאה" };

  const name = full_name.trim();
  if (!name) return { error: "יש להזין שם" };

  await prisma.barber.create({ data: { full_name: name, is_primary: false, is_active: true } });

  revalidatePath("/admin/barbers");
  revalidatePath("/admin");
  return { success: true };
}

/**
 * The primary barber can never be deactivated — the shop must always have
 * at least one bookable barber (see CLAUDE.md, "ספרי משנה").
 */
export async function setBarberActiveAction(
  barber_id: string,
  is_active: boolean,
): Promise<BarberActionResult> {
  if (!(await requireAdminSession())) return { error: "אין הרשאה" };

  const barber = await prisma.barber.findUnique({ where: { id: barber_id } });
  if (!barber) return { error: "הספר לא נמצא" };
  if (barber.is_primary && !is_active) {
    return { error: "לא ניתן להשבית את הספר הראשי" };
  }

  await prisma.barber.update({ where: { id: barber_id }, data: { is_active } });

  revalidatePath("/admin/barbers");
  revalidatePath("/admin");
  return { success: true };
}

/**
 * Hard delete (distinct from setBarberActiveAction's deactivate) — the
 * primary barber can never be deleted, same rule as deactivation. WorkDay.barber_id
 * is onDelete: Restrict, so the barber's work days must be cleared first;
 * wrapped in a transaction with the barber delete so the two can't succeed
 * only one at a time. Reuses the same "notify customers with a future
 * appointment" behavior as deleteWorkDayAction (workdays.ts) since this
 * wipes the same data, just scoped to one barber and finished by removing
 * the Barber row itself.
 */
export async function deleteBarberAction(
  barber_id: string,
  notifyCustomers: boolean,
): Promise<BarberActionResult> {
  if (!(await requireAdminSession())) return { error: "אין הרשאה" };

  const barber = await prisma.barber.findUnique({ where: { id: barber_id } });
  if (!barber) return { error: "הספר לא נמצא" };
  if (barber.is_primary) return { error: "לא ניתן למחוק את הספר הראשי" };

  if (notifyCustomers) {
    const appointments = await prisma.appointment.findMany({
      where: { status: "scheduled", starts_at: { gte: new Date() }, work_day: { barber_id } },
      include: { service: true, booked_by: true },
    });
    for (const a of appointments) {
      if (a.booked_by) {
        await notifyAppointmentCancelled({
          user_id: a.booked_by.id,
          phone_number: a.booked_by.phone_number,
          service_name: a.service.name,
          starts_at: a.starts_at,
        });
      }
    }
  }

  await prisma.$transaction([
    prisma.workDay.deleteMany({ where: { barber_id } }),
    prisma.barber.delete({ where: { id: barber_id } }),
  ]);

  revalidatePath("/admin/barbers");
  revalidatePath("/admin");
  return { success: true };
}
