"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { normalizeIsraeliPhone, parseVCards, type ParsedContact } from "@/lib/contacts";
import { getKnownCustomerPhones, importContactNamesAction, savePickedContactsAction } from "@/lib/actions/contacts";

/** Contact Picker API (Chrome on Android only) — not in TypeScript's DOM lib yet. */
type ContactsManager = {
  select(props: ("name" | "tel")[], options: { multiple: boolean }): Promise<{ name?: string[]; tel?: string[] }[]>;
};

function contactsManager(): ContactsManager | null {
  if (typeof navigator === "undefined" || !("contacts" in navigator)) return null;
  return (navigator as Navigator & { contacts: ContactsManager }).contacts;
}

export function ContactsImport() {
  const router = useRouter();
  // Browser-only capability: false during SSR, real value after hydration.
  const pickerSupported = useSyncExternalStore(
    () => () => {},
    () => contactsManager() !== null,
    () => false,
  );
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();

  async function importFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPending(true);
    setError(undefined);
    setMessage(undefined);
    try {
      const parsed = parseVCards(await file.text());
      if (parsed.length === 0) {
        setError("לא נמצאו בקובץ אנשי קשר עם מספר ישראלי. ודאו שזה קובץ ‎.vcf‎ שיוצא מאנשי הקשר.");
        return;
      }
      // Filtered here, in the browser: contacts who aren't customers never leave the phone.
      const known = new Set(await getKnownCustomerPhones());
      const matches = parsed.filter((c) => known.has(c.phone_number));
      const result = await importContactNamesAction(matches.map((c) => ({ phone_number: c.phone_number, name: c.name })));
      if (result.error) setError(result.error);
      else {
        const skipped = matches.length - (result.saved ?? 0);
        setMessage(
          `נקראו ${parsed.length} מספרים מהקובץ, ${matches.length} מהם של לקוחות. עודכנו ${result.saved} שמות.` +
            (skipped > 0 ? ` ${skipped} לא שונו כי ערכתם אותם ידנית באפליקציה.` : ""),
        );
        router.refresh();
      }
    } catch {
      setError("קריאת הקובץ נכשלה.");
    } finally {
      setPending(false);
    }
  }

  async function pickContacts() {
    const manager = contactsManager();
    if (!manager) return;
    setError(undefined);
    setMessage(undefined);
    let selected: { name?: string[]; tel?: string[] }[];
    try {
      selected = await manager.select(["name", "tel"], { multiple: true });
    } catch {
      return; // the barber closed the picker
    }
    const entries: ParsedContact[] = [];
    for (const c of selected) {
      const name = c.name?.[0]?.trim();
      if (!name) continue;
      for (const tel of c.tel ?? []) {
        const phone_number = normalizeIsraeliPhone(tel);
        if (phone_number) entries.push({ name, phone_number });
      }
    }
    if (entries.length === 0) {
      if (selected.length > 0) setError("לאנשי הקשר שנבחרו אין מספר טלפון ישראלי.");
      return;
    }
    setPending(true);
    const result = await savePickedContactsAction(entries.map((c) => ({ phone_number: c.phone_number, name: c.name })));
    setPending(false);
    if (result.error) setError(result.error);
    else {
      setMessage(`נשמרו ${result.saved} שמות מאנשי הקשר.`);
      router.refresh();
    }
  }

  return (
    <div className="border-barber-teal bg-white flex flex-col gap-3 rounded-xl border p-4 text-sm">
      <h2 className="text-ink font-bold">חיבור לאנשי הקשר בטלפון</h2>
      <p className="text-slate-muted">
        השמות מוצגים רק לך, בכל מסכי הניהול, במקום השם שהלקוח נרשם איתו. הלקוחות לא רואים אותם.
      </p>

      {pickerSupported && (
        <button
          type="button"
          onClick={pickContacts}
          disabled={pending}
          className="bg-barber-teal text-cream-text rounded-full p-2 font-bold disabled:opacity-50"
        >
          בחירה מאנשי הקשר
        </button>
      )}

      <label
        className={`border-barber-teal text-barber-teal cursor-pointer rounded-full border p-2 text-center font-bold ${pending ? "pointer-events-none opacity-50" : ""}`}
      >
        {pending ? "מעבד..." : "ייבוא קובץ אנשי קשר (‎.vcf‎)"}
        <input type="file" accept=".vcf,text/vcard,text/x-vcard" onChange={importFile} className="hidden" />
      </label>

      <details className="text-slate-muted">
        <summary className="text-barber-teal cursor-pointer">איך מייצאים קובץ אנשי קשר באנדרואיד?</summary>
        <ol className="mt-2 list-decimal pr-5">
          <li>פותחים את אפליקציית &quot;אנשי קשר&quot;.</li>
          <li>תפריט / הגדרות ← &quot;ייצוא&quot; (או &quot;ניהול אנשי קשר&quot; ← &quot;ייבוא/ייצוא&quot;).</li>
          <li>בוחרים לייצא לקובץ ‎.vcf‎ ושומרים אותו בטלפון.</li>
          <li>חוזרים לכאן, לוחצים &quot;ייבוא קובץ&quot; ובוחרים את הקובץ.</li>
        </ol>
        <p className="mt-2">
          רק שמות של מספרים שכבר רשומים כלקוחות נשמרים במערכת. שאר אנשי הקשר לא יוצאים מהטלפון. אחרי שמצטרפים לקוחות
          חדשים אפשר לייבא שוב. ייבוא חוזר לא דורס שם שערכתם ידנית באפליקציה.
        </p>
      </details>

      {message && <p className="text-barber-teal">{message}</p>}
      {error && <p className="text-red-600">{error}</p>}
    </div>
  );
}
