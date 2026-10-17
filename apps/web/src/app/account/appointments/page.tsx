import Link from "next/link";
import { prisma } from "@barberbook/db";
import { ISRAEL_TIME_ZONE } from "@barberbook/shared";
import { getSession } from "@/lib/auth/session";
import { getRequiresApproval } from "@/lib/actions/settings";
import { WithdrawRescheduleButton } from "./WithdrawRescheduleButton";
import { RescheduleButton } from "./RescheduleButton";
import { RequestCancellationButton } from "./RequestCancellationButton";
import { BrandHero } from "@/components/BrandHero";
import { BsdBar } from "@/components/BsdBar";

function formatDateTime(d: Date) {
  return d.toLocaleString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: ISRAEL_TIME_ZONE,
  });
}

export default async function AppointmentsPage() {
  const session = await getSession();
  if (!session) return null;

  const requiresApproval = await getRequiresApproval();

  const appointments = await prisma.appointment.findMany({
    where: {
      booked_by_user_id: session.sub,
      starts_at: { gte: new Date() },
      // Upcoming appointments, plus ones the barber rejected so the customer sees the outcome.
      OR: [{ status: "scheduled" }, { status: "cancelled", booking_request: { status: "rejected" } }],
    },
    include: {
      service: true,
      cancellation_request: true,
      booking_request: true,
      reschedule_request: true,
      work_day: { select: { barber_id: true } },
    },
    orderBy: { starts_at: "asc" },
  });

  return (
    <main dir="rtl" className="bg-cream mx-auto flex min-h-screen max-w-md flex-col p-6">
      <BsdBar />
      <BrandHero />
      <h1 className="text-barber-teal mt-6 mb-6 text-center text-3xl font-bold">התורים שלי</h1>
      <div className="mb-4 flex justify-end">
        <Link
          href="/account/book"
          className="bg-barber-teal text-cream-text rounded-full px-4 py-2 text-sm font-bold"
        >
          תור חדש
        </Link>
      </div>

      {appointments.length === 0 && <p className="text-slate-muted">אין לך תורים קרובים.</p>}

      <ul className="flex flex-col gap-3">
        {appointments.map((a) => (
          <li key={a.id} className="border-barber-teal rounded-xl border bg-white p-4">
            <p className="text-ink font-bold">{a.service.name}</p>
            {a.status === "cancelled" ? (
              <p className="mt-1 flex items-center gap-1 text-sm font-bold text-red-600">
                <span aria-hidden="true">✗</span> התור נדחה ע&quot;י הספר
              </p>
            ) : a.booking_request?.status === "pending" ? (
              <p className="mt-1 flex items-center gap-1 text-sm font-bold text-orange-500">
                <span aria-hidden="true">?</span> ממתין לאישור הספר
              </p>
            ) : (
              <p className="mt-1 flex items-center gap-1 text-sm font-bold text-green-600">
                <span aria-hidden="true">✓</span> התור אושר
              </p>
            )}
            <p className="text-slate-muted text-sm">{formatDateTime(a.starts_at)}</p>
            {a.attendee_type === "child" && (
              <p className="text-slate-muted text-sm">עבור: {a.attendee_name}</p>
            )}
            {a.status === "cancelled" ? null : a.cancellation_request?.status === "pending" ? (
              <p className="text-slate-muted mt-2 text-sm">בקשת ביטול נשלחה — ממתינה לאישור הספר</p>
            ) : a.reschedule_request?.status === "pending" ? (
              <div className="mt-2 flex flex-col gap-2">
                <p className="text-slate-muted text-sm">
                  בקשת שינוי ל-{formatDateTime(a.reschedule_request.new_starts_at)} נשלחה — ממתינה לאישור הספר
                </p>
                <WithdrawRescheduleButton appointmentId={a.id} />
              </div>
            ) : (
              <div className="mt-2 flex flex-col gap-2">
                <RescheduleButton
                  appointmentId={a.id}
                  serviceId={a.service.id}
                  barberId={a.work_day.barber_id}
                />
                {/* A not-yet-approved booking is withdrawn immediately, no barber approval needed. */}
                <RequestCancellationButton
                  appointmentId={a.id}
                  requiresApproval={requiresApproval && a.booking_request?.status !== "pending"}
                />
              </div>
            )}
          </li>
        ))}
      </ul>

      <Link href="/account" className="text-barber-teal mt-6 self-start text-sm font-medium">
        חזרה לאזור האישי
      </Link>

    </main>
  );
}
