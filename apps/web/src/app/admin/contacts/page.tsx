import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { getCustomerContacts } from "@/lib/actions/contacts";
import { ContactsImport } from "./ContactsImport";
import { CustomerContact } from "@/components/CustomerContact";
import { PageHeader } from "@/components/PageHeader";
import { AdminBrandHero } from "@/components/AdminBrandHero";

export default async function ContactsPage() {
  await requireAdmin();
  const contacts = await getCustomerContacts();
  const withoutName = contacts.filter((c) => !c.contact_name).length;

  return (
    <main dir="rtl" className="bg-cream mx-auto flex min-h-screen max-w-md flex-col gap-4 p-6">
      <PageHeader title="אנשי קשר" topBanner={<AdminBrandHero />} />
      <div className="flex justify-end">
        <Link href="/admin" className="text-barber-teal text-sm underline">
          חזרה לניהול
        </Link>
      </div>

      <ContactsImport />

      <div className="flex flex-col gap-2">
        <h2 className="text-ink font-bold">לקוחות ({contacts.length})</h2>
        {withoutName > 0 && (
          <p className="text-slate-muted text-sm">
            ל-{withoutName} מהם אין עדיין שם מאנשי הקשר. אפשר לייבא שוב או ללחוץ ✎ ליד השם.
          </p>
        )}
        {contacts.length === 0 && <p className="text-slate-muted">אין עדיין לקוחות רשומים.</p>}
        <ul className="flex flex-col gap-2">
          {contacts.map((c) => (
            <li key={c.phone_number} className="border-barber-teal bg-white rounded-xl border p-3 text-sm">
              <CustomerContact phone={c.phone_number} registeredName={c.registered_name} contactName={c.contact_name}>
                {!c.registered_name && <p className="text-slate-muted text-xs">עדיין לא נרשם/ה כלקוח/ה</p>}
              </CustomerContact>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
