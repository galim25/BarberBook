"use server";

import { revalidatePath } from "next/cache";
import { prisma, Prisma } from "@barberbook/db";
import { ISRAEL_TIME_ZONE, zonedTimeToUtc } from "@barberbook/shared";
import { getSession } from "@/lib/auth/session";
import { notifyAppointmentCancelled } from "@/lib/notifyCustomer";
import { notifyWaitlistOfExtendedHours, notifyWaitlistOfNewWorkDay } from "@/lib/actions/waitlist";

export type WorkDayBreak = { id: string; starts_at: Date; ends_at: Date };
export type WorkDayWithBreaks = {
  id: string;
  barber_id: string;
  work_date: Date;
  starts_at: Date;
  ends_at: Date;
  is_blocked: boolean;
  breaks: WorkDayBreak[];
};

type BreakInput = { starts_at: string; ends_at: string }; // "HH:mm"
type CreateWorkDayInput = {
  barber_id: string;
  work_date: string; // "YYYY-MM-DD"
  starts_at: string; // "HH:mm"
  ends_at: string; // "HH:mm"
  breaks: BreakInput[];
};
export type CreateWorkDayResult = { error?: string; success?: boolean };

async function requireAdminSession() {
  const session = await getSession();
  if (!session || session.role !== "administrator") return null;
  return session;
}

export async function getWorkDaysAdmin(barber_id: string): Promise<WorkDayWithBreaks[]> {
  if (!(await requireAdminSession())) return [];
  return prisma.workDay.findMany({
    // Filters by ends_at (not just the date) so a day whose hours already
    // ended today drops off the list, not just once its date is in the past.
    where: { barber_id, ends_at: { gte: new Date() } },
    orderBy: { work_date: "asc" },
    include: { breaks: true },
  });
}

export type WorkDayDetail = WorkDayWithBreaks & {
  blocked_times: { id: string; starts_at: Date; ends_at: Date }[];
  barber: { full_name: string; is_primary: boolean };
};

export async function getWorkDayDetail(work_day_id: string): Promise<WorkDayDetail | null> {
  if (!(await requireAdminSession())) return null;
  return prisma.workDay.findUnique({
    where: { id: work_day_id },
    include: {
      breaks: true,
      blocked_times: true,
      barber: { select: { full_name: true, is_primary: true } },
    },
  });
}

type UpdateWorkDayHoursInput = {
  work_day_id: string;
  starts_at: string; // "HH:mm"
  ends_at: string; // "HH:mm"
};

export async function updateWorkDayHoursAction(
  input: UpdateWorkDayHoursInput,
): Promise<CreateWorkDayResult> {
  if (!(await requireAdminSession())) return { error: "אין הרשאה" };

  const workDay = await prisma.workDay.findUnique({
    where: { id: input.work_day_id },
    include: {
      breaks: true,
      blocked_times: true,
      appointments: { where: { status: "scheduled" } },
    },
  });
  if (!workDay) return { error: "יום העבודה לא נמצא" };

  const work_date = workDay.work_date.toISOString().slice(0, 10);
  const starts_at = zonedTimeToUtc(work_date, input.starts_at, ISRAEL_TIME_ZONE);
  const ends_at = zonedTimeToUtc(work_date, input.ends_at, ISRAEL_TIME_ZONE);
  if (starts_at >= ends_at) {
    return { error: "שעת הסיום חייבת להיות אחרי שעת ההתחלה" };
  }

  const outOfRange = [...workDay.breaks, ...workDay.blocked_times, ...workDay.appointments].some(
    (item) => item.starts_at < starts_at || item.ends_at > ends_at,
  );
  if (outOfRange) {
    return { error: "יש תורים, הפסקות או חסימות מחוץ לטווח השעות החדש — יש להזיז אותם קודם" };
  }

  const extended = starts_at < workDay.starts_at || ends_at > workDay.ends_at;

  await prisma.workDay.update({
    where: { id: input.work_day_id },
    data: { starts_at, ends_at },
  });

  if (extended) {
    await notifyWaitlistOfExtendedHours(workDay.work_date);
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/day/${input.work_day_id}`);
  return { success: true };
}

/**
 * Blocks/unblocks a day from new customer self-service bookings (see
 * `is_blocked` on the WorkDay model) — existing appointments are untouched,
 * and the admin's own manual appointment creation still works while blocked.
 */
export async function setWorkDayBlockedAction(
  work_day_id: string,
  is_blocked: boolean,
): Promise<CreateWorkDayResult> {
  if (!(await requireAdminSession())) return { error: "אין הרשאה" };

  await prisma.workDay.update({ where: { id: work_day_id }, data: { is_blocked } });

  revalidatePath("/admin");
  revalidatePath(`/admin/day/${work_day_id}`);
  return { success: true };
}

export type ExportAppointment = {
  id: string;
  service_name: string;
  customer_name: string;
  attendee_name: string;
  attendee_type: string;
  phone_number: string | null;
  starts_at: Date;
  ends_at: Date;
};
export type ExportWorkDay = {
  id: string;
  work_date: Date;
  starts_at: Date;
  ends_at: Date;
  appointments: ExportAppointment[];
};

async function loadExportWorkDays(where: Prisma.WorkDayWhereInput): Promise<ExportWorkDay[]> {
  const days = await prisma.workDay.findMany({
    where,
    orderBy: { work_date: "asc" },
    include: {
      appointments: {
        where: { status: "scheduled" },
        include: { service: true, booked_by: true },
        orderBy: { starts_at: "asc" },
      },
    },
  });
  return days.map((d) => ({
    id: d.id,
    work_date: d.work_date,
    starts_at: d.starts_at,
    ends_at: d.ends_at,
    appointments: d.appointments.map((a) => ({
      id: a.id,
      service_name: a.service.name,
      customer_name: a.customer_name,
      attendee_name: a.attendee_name,
      attendee_type: a.attendee_type,
      phone_number: a.booked_by?.phone_number ?? null,
      starts_at: a.starts_at,
      ends_at: a.ends_at,
    })),
  }));
}

export async function getWorkDayExport(work_day_id: string): Promise<ExportWorkDay | null> {
  if (!(await requireAdminSession())) return null;
  const days = await loadExportWorkDays({ id: work_day_id });
  return days[0] ?? null;
}

export async function getAllWorkDaysExport(): Promise<ExportWorkDay[]> {
  if (!(await requireAdminSession())) return [];
  return loadExportWorkDays({});
}

export async function createWorkDayAction(input: CreateWorkDayInput): Promise<CreateWorkDayResult> {
  if (!(await requireAdminSession())) return { error: "אין הרשאה" };

  const starts_at = zonedTimeToUtc(input.work_date, input.starts_at, ISRAEL_TIME_ZONE);
  const ends_at = zonedTimeToUtc(input.work_date, input.ends_at, ISRAEL_TIME_ZONE);
  if (starts_at >= ends_at) {
    return { error: "שעת הסיום חייבת להיות אחרי שעת ההתחלה" };
  }

  const breaks = input.breaks.map((b) => ({
    starts_at: zonedTimeToUtc(input.work_date, b.starts_at, ISRAEL_TIME_ZONE),
    ends_at: zonedTimeToUtc(input.work_date, b.ends_at, ISRAEL_TIME_ZONE),
  }));
  for (const b of breaks) {
    if (b.starts_at >= b.ends_at) {
      return { error: "בהפסקה שעת הסיום חייבת להיות אחרי שעת ההתחלה" };
    }
    if (b.starts_at < starts_at || b.ends_at > ends_at) {
      return { error: "כל הפסקה חייבת להיות בתוך שעות העבודה של היום" };
    }
  }
  const sortedBreaks = [...breaks].sort((a, b) => a.starts_at.getTime() - b.starts_at.getTime());
  for (let i = 1; i < sortedBreaks.length; i++) {
    if (sortedBreaks[i].starts_at < sortedBreaks[i - 1].ends_at) {
      return { error: "ההפסקות חופפות זו לזו" };
    }
  }

  try {
    await prisma.workDay.create({
      data: {
        barber_id: input.barber_id,
        work_date: new Date(`${input.work_date}T00:00:00Z`),
        starts_at,
        ends_at,
        breaks: { create: breaks },
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { error: "כבר קיים יום עבודה פתוח בתאריך הזה" };
    }
    return { error: "לא ניתן היה לפתוח את היום, נסה/י שוב" };
  }

  await notifyWaitlistOfNewWorkDay(new Date(`${input.work_date}T00:00:00Z`));

  revalidatePath("/admin");
  return { success: true };
}

/**
 * Hard delete (FR-15/US-012) — distinct from cancelAppointmentAction's soft
 * cancel. Cascades via the schema's onDelete: Cascade to remove breaks,
 * blocked times, appointments, and anything tied to those appointments.
 * When notifyCustomers is true, any customer with a still-upcoming
 * scheduled appointment on this day gets the same cancellation
 * SMS/Notification as a single cancel, sent before the delete since the
 * appointment row (and thus any FK to it) won't survive. Appointments
 * already in the past never notify regardless — the schema has no separate
 * "completed" status, so a historical day's appointments are still
 * status="scheduled" and would otherwise get a bogus "your appointment was
 * cancelled" text for a haircut that already happened.
 */
export async function deleteWorkDayAction(
  work_day_id: string,
  notifyCustomers: boolean,
): Promise<CreateWorkDayResult> {
  if (!(await requireAdminSession())) return { error: "אין הרשאה" };

  const workDay = await prisma.workDay.findUnique({
    where: { id: work_day_id },
    include: {
      appointments: {
        where: { status: "scheduled", starts_at: { gte: new Date() } },
        include: { service: true, booked_by: true },
      },
    },
  });
  if (!workDay) return { error: "יום העבודה לא נמצא" };

  if (notifyCustomers) {
    for (const a of workDay.appointments) {
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

  await prisma.workDay.delete({ where: { id: work_day_id } });

  revalidatePath("/admin");
  return { success: true };
}

/** Same as deleteWorkDayAction but wipes every work day for one barber — the "מחיקת כל היומן" bulk purge, scoped to whichever barber's calendar is currently selected on /admin. */
export async function deleteAllWorkDaysAction(
  barber_id: string,
  notifyCustomers: boolean,
): Promise<CreateWorkDayResult> {
  if (!(await requireAdminSession())) return { error: "אין הרשאה" };

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

  await prisma.workDay.deleteMany({ where: { barber_id } });

  revalidatePath("/admin");
  return { success: true };
}
