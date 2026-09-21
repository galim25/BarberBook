"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@barberbook/db";
import { getSession } from "@/lib/auth/session";

// Everything notifyAdmin.ts writes for administrators. (Filtering on appointment_booked alone hid the
// booking/cancellation-request rows from the feed and badge.)
const ADMIN_NOTIFICATION_TYPES = [
  "appointment_booked",
  "booking_request_pending",
  "cancellation_request_pending",
  "appointment_changed",
  "customer_registered",
] as const;

async function requireAdminSession() {
  const session = await getSession();
  if (!session || session.role !== "administrator") return null;
  return session;
}

export type AdminNotificationView = {
  id: string;
  content: string;
  created_at: Date;
  read_at: Date | null;
};

export async function getAdminNotifications(): Promise<AdminNotificationView[]> {
  const session = await requireAdminSession();
  if (!session) return [];
  const notifications = await prisma.notification.findMany({
    where: { user_id: session.sub, type: { in: [...ADMIN_NOTIFICATION_TYPES] } },
    orderBy: { created_at: "desc" },
  });
  return notifications.map((n) => ({
    id: n.id,
    content: n.content,
    created_at: n.created_at,
    read_at: n.read_at,
  }));
}

export async function getUnreadAdminNotificationCount(): Promise<number> {
  const session = await requireAdminSession();
  if (!session) return 0;
  return prisma.notification.count({
    where: { user_id: session.sub, type: { in: [...ADMIN_NOTIFICATION_TYPES] }, read_at: null },
  });
}

export async function markAdminNotificationsReadAction(): Promise<void> {
  const session = await requireAdminSession();
  if (!session) return;
  await prisma.notification.updateMany({
    where: { user_id: session.sub, type: { in: [...ADMIN_NOTIFICATION_TYPES] }, read_at: null },
    data: { read_at: new Date() },
  });
  revalidatePath("/admin");
  revalidatePath("/admin/notifications");
}
