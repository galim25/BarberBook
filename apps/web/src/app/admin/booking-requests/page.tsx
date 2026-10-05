import Link from "next/link";
import { ISRAEL_TIME_ZONE } from "@barberbook/shared";
import { requireAdmin } from "@/lib/auth/session";
import { getPendingBookingRequests } from "@/lib/actions/bookingRequests";
import { DecideBookingRequestButtons } from "./DecideBookingRequestButtons";
import { CustomerContact } from "@/components/CustomerContact";
import { PageHeader } from "@/components/PageHeader";
import { AdminBrandHero } from "@/components/AdminBrandHero";

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

export default async function BookingRequestsPage() {
  await requireAdmin();
  const requests = await getPendingBookingRequests();

  return (
    <main dir="rtl" className="bg-cream mx-auto flex min-h-screen max-w-md flex-col gap-4 p-6">
      <PageHeader title="בקשות תורים" topBanner={<AdminBrandHero />} />
      <div className="flex justify-end">
        <Link href="/admin" className="text-barber-teal text-sm underline">
          חזרה לניהול
        </Link>
      </div>

      {requests.length === 0 && <p className="text-slate-muted">אין בקשות תור ממתינות.</p>}

      <ul className="flex flex-col gap-3">
        {requests.map((r) => (
          <li key={r.id} className="border-barber-teal bg-white rounded-xl border p-3 text-sm">
            <CustomerContact phone={r.phone_number} registeredName={r.customer_name} contactName={r.contact_name}>
              <p className="text-ink">{r.service_name}</p>
              <p className="text-slate-muted">אצל {r.barber_name}</p>
              <p className="text-slate-muted">{formatDateTime(r.starts_at)}</p>
              <p className="text-slate-muted">הבקשה נשלחה: {formatDateTime(r.requested_at)}</p>
            </CustomerContact>
            <div className="mt-2">
              <DecideBookingRequestButtons requestId={r.id} />
            </div>
          </li>
        ))}
      </ul>

    </main>
  );
}
