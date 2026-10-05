import Link from "next/link";
import { ISRAEL_TIME_ZONE } from "@barberbook/shared";
import { requireAdmin } from "@/lib/auth/session";
import { getBlockedPhoneNumbers } from "@/lib/actions/blocklist";
import { BlockPhoneNumberForm } from "./BlockPhoneNumberForm";
import { UnblockButton } from "./UnblockButton";
import { CustomerContact } from "@/components/CustomerContact";
import { PageHeader } from "@/components/PageHeader";
import { AdminBrandHero } from "@/components/AdminBrandHero";

function formatDate(d: Date) {
  return d.toLocaleDateString("he-IL", { day: "numeric", month: "numeric", year: "numeric", timeZone: ISRAEL_TIME_ZONE });
}

export default async function BlockedCustomersPage() {
  await requireAdmin();
  const blocked = await getBlockedPhoneNumbers();

  return (
    <main dir="rtl" className="bg-cream mx-auto flex min-h-screen max-w-md flex-col gap-4 p-6">
      <PageHeader title="לקוחות חסומים" topBanner={<AdminBrandHero />} />
      <div className="flex justify-end">
        <Link href="/admin" className="text-barber-teal text-sm underline">
          חזרה לניהול
        </Link>
      </div>

      <BlockPhoneNumberForm />

      <div className="flex flex-col gap-2">
        {blocked.length === 0 && <p className="text-slate-muted">אין מספרים חסומים כרגע.</p>}
        <ul className="flex flex-col gap-2">
          {blocked.map((b) => (
            <li key={b.id} className="border-barber-teal bg-white rounded-xl border p-3 text-sm">
              <CustomerContact phone={b.phone_number} registeredName={b.registered_name} contactName={b.contact_name}>
                {b.reason && <p className="text-slate-muted">{b.reason}</p>}
                <p className="text-slate-muted">נחסם ב-{formatDate(b.created_at)}</p>
              </CustomerContact>
              <div className="mt-1">
                <UnblockButton id={b.id} />
              </div>
            </li>
          ))}
        </ul>
      </div>

    </main>
  );
}
