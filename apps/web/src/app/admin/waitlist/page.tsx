import Link from "next/link";
import { ISRAEL_TIME_ZONE } from "@barberbook/shared";
import { requireAdmin } from "@/lib/auth/session";
import { getWaitlistEntries } from "@/lib/actions/waitlist";
import { RemoveWaitlistEntryButton } from "./RemoveWaitlistEntryButton";
import { CustomerContact } from "@/components/CustomerContact";
import { PageHeader } from "@/components/PageHeader";
import { AdminBrandHero } from "@/components/AdminBrandHero";

function formatDate(d: Date) {
  return d.toLocaleDateString("he-IL", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    timeZone: ISRAEL_TIME_ZONE,
  });
}

export default async function WaitlistPage() {
  await requireAdmin();
  const entries = await getWaitlistEntries();

  return (
    <main dir="rtl" className="bg-cream mx-auto flex min-h-screen max-w-md flex-col gap-4 p-6">
      <PageHeader title="רשימת המתנה" topBanner={<AdminBrandHero />} />
      <div className="flex justify-end">
        <Link href="/admin" className="text-barber-teal text-sm underline">
          חזרה לניהול
        </Link>
      </div>

      <div className="flex flex-col gap-2">
        {entries.length === 0 && <p className="text-slate-muted">אין כרגע לקוחות ברשימת ההמתנה.</p>}
        <ul className="flex flex-col gap-2">
          {entries.map((e) => (
            <li key={e.id} className="border-barber-teal bg-white rounded-xl border p-3 text-sm">
              <CustomerContact phone={e.phone_number} registeredName={e.customer_name} contactName={e.contact_name}>
                <p className="text-slate-muted">נרשם/ה ב-{formatDate(e.created_at)}</p>
              </CustomerContact>
              <div className="mt-1">
                <RemoveWaitlistEntryButton id={e.id} />
              </div>
            </li>
          ))}
        </ul>
      </div>

    </main>
  );
}
