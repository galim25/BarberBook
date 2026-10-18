import Link from "next/link";
import { ISRAEL_TIME_ZONE } from "@barberbook/shared";
import { requireAdmin } from "@/lib/auth/session";
import { logoutAction } from "@/lib/actions/auth";
import { getWorkDaysAdmin, getWorkDayDetail } from "@/lib/actions/workdays";
import { getBarbersAdmin } from "@/lib/actions/barbers";
import { getAppointmentsForWorkDay } from "@/lib/actions/adminAppointments";
import { getPendingCancellationCount } from "@/lib/actions/cancellationRequests";
import { getUnreadAdminNotificationCount, getUnreadWaitlistJoinCount } from "@/lib/actions/adminNotifications";
import { getPendingRescheduleCount } from "@/lib/actions/rescheduleRequests";
import { getPendingBookingRequestCount } from "@/lib/actions/bookingRequests";
import { buildDayTimeline } from "@/lib/dayTimeline";
import { OpenWorkDayForm } from "./OpenWorkDayForm";
import { QuickDayAppointments } from "./QuickDayAppointments";
import { BlockDayToggle } from "./day/[id]/BlockDayToggle";
import { BsdBar } from "@/components/BsdBar";
import { AdminBrandHero } from "@/components/AdminBrandHero";
import { BellIcon, CalendarPlusIcon, HourglassIcon, SwapIcon, XCircleIcon } from "@/components/AdminIcons";
import { AdminMenu } from "@/components/AdminMenu";
import { DeleteHistoryMenuItem } from "./DeleteHistoryMenuItem";

function CountBadge({ count, inverted = false, className = "" }: { count: number; inverted?: boolean; className?: string }) {
  return (
    <span
      className={`${inverted ? "bg-cream-text text-barber-teal" : "bg-barber-teal text-cream-text"} min-w-5 rounded-full px-1.5 py-0.5 text-center text-xs leading-none font-bold ${className}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

function formatWorkDate(d: Date) {
  return d.toLocaleDateString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "numeric",
    timeZone: ISRAEL_TIME_ZONE,
  });
}

function formatHour(d: Date) {
  return d.toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: ISRAEL_TIME_ZONE,
  });
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ barber?: string }>;
}) {
  const session = await requireAdmin();
  const barbers = await getBarbersAdmin();
  const { barber: requestedBarberId } = await searchParams;
  const selectedBarber =
    barbers.find((b) => b.id === requestedBarberId) ?? barbers.find((b) => b.is_primary) ?? barbers[0];
  if (!selectedBarber) return null;

  const workDays = await getWorkDaysAdmin(selectedBarber.id);
  const pendingCancellations = await getPendingCancellationCount();
  const unreadNotifications = await getUnreadAdminNotificationCount();
  const pendingBookingRequests = await getPendingBookingRequestCount();
  const pendingReschedules = await getPendingRescheduleCount();
  const unreadWaitlistJoins = await getUnreadWaitlistJoinCount();

  const nearestWorkDay = workDays[0];
  const nearestWorkDayDetail = nearestWorkDay ? await getWorkDayDetail(nearestWorkDay.id) : null;
  const nearestDayTimeline = nearestWorkDayDetail
    ? buildDayTimeline(
        nearestWorkDayDetail.starts_at,
        nearestWorkDayDetail.ends_at,
        nearestWorkDayDetail.breaks,
        nearestWorkDayDetail.blocked_times,
        await getAppointmentsForWorkDay(nearestWorkDayDetail.id),
      )
    : null;

  return (
    <main dir="rtl" className="bg-cream mx-auto flex min-h-screen w-full max-w-md flex-col gap-4 p-6 md:max-w-2xl">
      <BsdBar />
      <div className="relative">
        <AdminBrandHero />
        <Link
          href="/admin/notifications"
          aria-label={unreadNotifications ? `התראות (${unreadNotifications} חדשות)` : "התראות"}
          className="border-barber-teal text-barber-teal absolute top-3 left-0 flex h-11 w-11 items-center justify-center rounded-full border bg-white"
        >
          <BellIcon size={22} />
          {!!unreadNotifications && <CountBadge count={unreadNotifications} className="absolute -top-1.5 -left-1.5" />}
        </Link>
      </div>
      <h1 className="text-barber-teal text-center text-3xl font-bold">היי {session.full_name}</h1>
      <div className="flex justify-start">
        <AdminMenu
          items={[
            { href: "/admin/contacts", label: "אנשי קשר" },
            { href: "/admin/blocked-customers", label: "לקוחות חסומים" },
            { href: "/admin/waitlist-settings", label: "ניהול רשימת המתנה" },
            { href: "/admin/announcements", label: "הודעות כלליות" },
            { href: "/admin/print-all", label: "היסטוריה וגיבוי" },
            { href: "/admin/settings", label: "הגדרות" },
            { href: "/admin/barbers", label: "ניהול ספרים" },
          ]}
          footer={<DeleteHistoryMenuItem />}
        />
      </div>

      {barbers.length > 1 && (
        <div className="flex flex-wrap justify-start gap-2">
          {barbers.map((b) => (
            <Link
              key={b.id}
              href={`/admin?barber=${b.id}`}
              className={
                b.id === selectedBarber.id
                  ? "bg-barber-teal text-cream-text inline-flex min-h-11 items-center rounded-full px-4 text-sm font-medium"
                  : "border-barber-teal text-barber-teal inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium"
              }
            >
              {b.full_name}
              {!b.is_active && " (לא פעיל)"}
            </Link>
          ))}
        </div>
      )}

      <section aria-labelledby="pending-requests" className="border-barber-teal bg-white flex flex-col gap-3 rounded-xl border p-3">
        <h2 id="pending-requests" className="text-ink font-bold">
          בקשות לטיפול
        </h2>
        <div className="grid grid-cols-3 gap-2">
          {[
            { href: "/admin/booking-requests", label: "בקשות תורים", count: pendingBookingRequests, Icon: CalendarPlusIcon },
            { href: "/admin/reschedule-requests", label: "בקשות שינוי תור", count: pendingReschedules, Icon: SwapIcon },
            { href: "/admin/cancellation-requests", label: "בקשות ביטול", count: pendingCancellations, Icon: XCircleIcon },
          ].map(({ href, label, count, Icon }) => (
            <Link
              key={href}
              href={href}
              aria-label={count ? `${label} (${count})` : label}
              className={`relative flex min-h-[76px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 text-center text-xs leading-tight font-medium break-words ${
                count
                  ? "bg-barber-teal text-cream-text border-barber-teal"
                  : "border-barber-teal text-barber-teal bg-white"
              }`}
            >
              <Icon size={22} />
              <span>{label}</span>
              {!!count && <CountBadge count={count} inverted className="absolute top-1 left-1" />}
            </Link>
          ))}
        </div>
        <Link
          href="/admin/waitlist"
          aria-label={unreadWaitlistJoins ? `רשימת המתנה (${unreadWaitlistJoins} חדשים)` : "רשימת המתנה"}
          className="bg-barber-teal text-cream-text relative flex min-h-12 items-center justify-center gap-2 rounded-full px-4 font-bold"
        >
          <HourglassIcon size={20} />
          רשימת המתנה
          {!!unreadWaitlistJoins && <CountBadge count={unreadWaitlistJoins} inverted className="absolute top-1/2 left-3 -translate-y-1/2" />}
        </Link>
      </section>

      {nearestWorkDayDetail && nearestDayTimeline && (
        <section className="border-barber-teal bg-white flex flex-col gap-3 rounded-xl border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-ink text-lg font-bold">
              התורים של {formatWorkDate(nearestWorkDayDetail.work_date)}
            </h2>
            <Link
              href={`/admin/day/${nearestWorkDayDetail.id}`}
              className="border-barber-teal text-barber-teal inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium"
            >
              ניהול היום
            </Link>
          </div>
          <QuickDayAppointments workDayId={nearestWorkDayDetail.id} timeline={nearestDayTimeline} withCreateButton />
        </section>
      )}

      <OpenWorkDayForm
        barberId={selectedBarber.id}
        openWorkDates={workDays.map((d) => d.work_date.toISOString().slice(0, 10))}
      />

      <div className="flex flex-col gap-2">
        <h2 className="text-ink font-bold">ימי עבודה פתוחים</h2>
        {workDays.length === 0 && <p className="text-slate-muted">אין ימי עבודה פתוחים כרגע.</p>}
        <ul className="flex flex-col gap-2">
          {workDays.map((d) => (
            <li key={d.id} className="border-barber-teal bg-white rounded-xl border p-3 text-sm">
              <div className="flex items-center justify-between">
                <p className="text-ink font-bold">
                  {formatWorkDate(d.work_date)}
                  {d.is_blocked && (
                    <span className="bg-barber-teal text-cream-text mr-2 rounded-full px-2 py-0.5 text-xs font-medium">
                      חסום
                    </span>
                  )}
                </p>
                <div className="flex flex-col items-end gap-1">
                  <Link href={`/admin/day/${d.id}`} className="text-barber-teal text-sm underline">
                    ניהול היום
                  </Link>
                  <BlockDayToggle workDayId={d.id} initialValue={d.is_blocked} compact />
                </div>
              </div>
              <p className="text-slate-muted">
                <span dir="ltr">{formatHour(d.starts_at)}–{formatHour(d.ends_at)}</span>
              </p>
              {d.breaks.length > 0 && (
                <p className="text-slate-muted">
                  הפסקות:{" "}
                  {d.breaks
                    .map((b) => `${formatHour(b.starts_at)}–${formatHour(b.ends_at)}`)
                    .join(", ")}
                </p>
              )}
            </li>
          ))}
        </ul>
      </div>

      <form action={logoutAction}>
        <button
          type="submit"
          className="border-barber-teal text-barber-teal rounded-full border px-4 py-2 font-medium"
        >
          התנתקות
        </button>
      </form>

    </main>
  );
}
