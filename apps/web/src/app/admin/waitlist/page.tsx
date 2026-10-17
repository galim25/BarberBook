import Link from "next/link";
import { ISRAEL_TIME_ZONE } from "@barberbook/shared";
import { requireAdmin } from "@/lib/auth/session";
import { getDateWaitlistEntriesAdmin, getWaitlistEntries } from "@/lib/actions/waitlist";
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
  const dateEntries = await getDateWaitlistEntriesAdmin();
  const byDay = new Map<string, typeof dateEntries>();
  for (const e of dateEntries) {
    const key = `${e.work_date}|${e.barber_name}`;
    byDay.set(key, [...(byDay.get(key) ?? []), e]);
  }

  return (
    <main dir="rtl" className="bg-cream mx-auto flex min-h-screen max-w-md flex-col gap-4 p-6">
      <PageHeader title="רשימת המתנה" topBanner={<AdminBrandHero />} />
      <div className="flex justify-end">
        <Link href="/admin" className="text-barber-teal text-sm underline">
          חזרה לניהול
        </Link>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-ink font-bold">ממתינים לפי תאריך</h2>
        {byDay.size === 0 && <p className="text-slate-muted">אין כרגע לקוחות ברשימת המתנה לתאריך מסוים.</p>}
        {[...byDay.entries()].map(([key, list]) => (
          <div key={key} className="flex flex-col gap-2">
            <p className="text-barber-teal text-sm font-bold">
              {new Date(`${list[0].work_date}T00:00:00Z`).toLocaleDateString("he-IL", {
                weekday: "long",
                day: "numeric",
                month: "numeric",
                timeZone: ISRAEL_TIME_ZONE,
              })}
              {list[0].barber_name ? ` · ${list[0].barber_name}` : ""}
            </p>
            <ul className="flex flex-col gap-2">
              {list.map((e) => (
                <li key={e.id} className="border-barber-teal bg-white rounded-xl border p-3 text-sm">
                  <CustomerContact phone={e.phone_number} registeredName={e.customer_name} contactName={e.contact_name}>
                    <p className="text-ink font-medium">{e.period_label}</p>
                    <p className="text-slate-muted">נרשם/ה ב-{formatDate(e.created_at)}</p>
                  </CustomerContact>
                  <div className="mt-1">
                    <RemoveWaitlistEntryButton id={e.id} kind="date" />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-ink font-bold">רשימה כללית</h2>
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
