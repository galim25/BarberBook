import Link from "next/link";
import { ISRAEL_TIME_ZONE } from "@barberbook/shared";
import { requireAdmin } from "@/lib/auth/session";
import { getAdminNotifications } from "@/lib/actions/adminNotifications";
import { MarkReadButton } from "./MarkReadButton";
import { PageHeader } from "@/components/PageHeader";
import { AdminBrandHero } from "@/components/AdminBrandHero";
import { PushNotificationToggle } from "@/components/PushNotificationToggle";

function formatDateTime(d: Date) {
  return d.toLocaleString("he-IL", {
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: ISRAEL_TIME_ZONE,
  });
}

export default async function AdminNotificationsPage() {
  await requireAdmin();
  const notifications = await getAdminNotifications();
  const hasUnread = notifications.some((n) => !n.read_at);

  return (
    <main dir="rtl" className="bg-cream mx-auto flex min-h-screen max-w-md flex-col gap-4 p-6">
      <PageHeader title="התראות" topBanner={<AdminBrandHero />} />
      <div className="flex items-center justify-between">
        <Link href="/admin" className="text-barber-teal text-sm underline">
          חזרה לניהול
        </Link>
        <MarkReadButton hasUnread={hasUnread} />
      </div>

      <PushNotificationToggle audience="admin" />

      <div className="flex flex-col gap-2">
        {notifications.length === 0 && <p className="text-slate-muted">אין התראות.</p>}
        <ul className="flex flex-col gap-2">
          {notifications.map((n) => (
            <li
              key={n.id}
              className={`bg-white rounded-xl p-3 text-sm ${
                n.read_at ? "border-barber-teal/30 border" : "border-barber-teal border-2"
              }`}
            >
              <p className="text-ink">{n.content}</p>
              <p className="text-slate-muted">{formatDateTime(n.created_at)}</p>
            </li>
          ))}
        </ul>
      </div>

    </main>
  );
}
