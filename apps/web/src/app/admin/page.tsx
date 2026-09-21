import Link from "next/link";
import { ISRAEL_TIME_ZONE } from "@barberbook/shared";
import { requireAdmin } from "@/lib/auth/session";
import { logoutAction } from "@/lib/actions/auth";
import { getWorkDaysAdmin, getWorkDayDetail } from "@/lib/actions/workdays";
import { getBarbersAdmin } from "@/lib/actions/barbers";
import { getAppointmentsForWorkDay } from "@/lib/actions/adminAppointments";
import { getPendingCancellationCount } from "@/lib/actions/cancellationRequests";
import { getUnreadAdminNotificationCount } from "@/lib/actions/adminNotifications";
import { getPendingBookingRequestCount } from "@/lib/actions/bookingRequests";
import { buildDayTimeline } from "@/lib/dayTimeline";
import { OpenWorkDayForm } from "./OpenWorkDayForm";
import { DeleteAllWorkDaysButton } from "./DeleteAllWorkDaysButton";
import { QuickDayAppointments } from "./QuickDayAppointments";
import { BlockDayToggle } from "./day/[id]/BlockDayToggle";
import { PageHeader } from "@/components/PageHeader";
import { AdminBrandHero } from "@/components/AdminBrandHero";
import { AdminMenu } from "@/components/AdminMenu";

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
    <main dir="rtl" className="bg-cream mx-auto flex min-h-screen max-w-md flex-col gap-4 p-6">
      <PageHeader title={`היי ${session.full_name}`} topBanner={<AdminBrandHero />} />
      <div className="flex items-center justify-between">
        <AdminMenu
          items={[
            { href: "/admin/blocked-customers", label: "לקוחות חסומים" },
            { href: "/admin/waitlist", label: "רשימת המתנה" },
            { href: "/admin/announcements", label: "הודעות כלליות" },
            { href: "/admin/settings", label: "הגדרות" },
            { href: "/admin/barbers", label: "ניהול ספרים" },
          ]}
        />
        <DeleteAllWorkDaysButton barberId={selectedBarber.id} barberName={selectedBarber.full_name} />
      </div>

      {barbers.length > 1 && (
        <div className="flex flex-wrap justify-start gap-2">
          {barbers.map((b) => (
            <Link
              key={b.id}
              href={`/admin?barber=${b.id}`}
              className={
                b.id === selectedBarber.id
                  ? "bg-barber-teal text-cream-text rounded-full px-4 py-2 text-sm font-medium"
                  : "border-barber-teal text-barber-teal rounded-full border px-4 py-2 text-sm font-medium"
              }
            >
              {b.full_name}
              {!b.is_active && " (לא פעיל)"}
            </Link>
          ))}
        </div>
      )}

      <div className="mx-auto flex w-64 flex-col gap-2">
        {[
          { href: "/admin/booking-requests", label: "בקשות תורים", count: pendingBookingRequests },
          { href: "/admin/cancellation-requests", label: "בקשות ביטול", count: pendingCancellations },
          { href: "/admin/notifications", label: "התראות", count: unreadNotifications },
        ].map((b) => (
          <Link
            key={b.href}
            href={b.href}
            className="bg-barber-teal text-cream-text relative flex items-center justify-center rounded-full px-4 py-2 text-[15px] font-medium"
          >
            {b.label}
            {!!b.count && (
              <span className="bg-cream-text text-barber-teal absolute left-3 rounded-full px-2 py-0.5 text-xs font-bold">
                {b.count}
              </span>
            )}
          </Link>
        ))}
      </div>

      {nearestWorkDayDetail && nearestDayTimeline && (
        <div className="border-barber-teal bg-white flex flex-col gap-3 rounded-xl border p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-ink font-bold">
              התורים של {formatWorkDate(nearestWorkDayDetail.work_date)}
            </h2>
            <Link
              href={`/admin/day/${nearestWorkDayDetail.id}`}
              className="bg-barber-teal text-cream-text rounded-full px-3 py-1 text-xs font-medium"
            >
              ניהול היום
            </Link>
          </div>
          <QuickDayAppointments
            workDayId={nearestWorkDayDetail.id}
            barberId={selectedBarber.id}
            timeline={nearestDayTimeline}
          />
        </div>
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
                {formatHour(d.starts_at)}–{formatHour(d.ends_at)}
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

      <div className="border-barber-teal bg-white flex flex-col gap-2 rounded-xl border p-4">
        <h2 className="text-ink font-bold">היסטוריה וגיבוי</h2>
        <Link href="/admin/print-all" className="text-barber-teal text-sm underline">
          הדפסה / שמירת עותק כ-PDF של כל היומן
        </Link>
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
