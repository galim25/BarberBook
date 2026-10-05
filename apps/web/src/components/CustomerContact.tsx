"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { whatsappUrl } from "@/lib/contacts";
import { setContactNameAction } from "@/lib/actions/contacts";

const actionClass = "border-barber-teal text-barber-teal rounded-full border px-2.5 py-0.5 text-xs font-medium";

/** Call / SMS / WhatsApp buttons for one number — admin screens only. */
export function ContactActions({ phone }: { phone: string }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <a href={`tel:${phone}`} className={actionClass}>
        חיוג
      </a>
      <a href={`sms:${phone}`} className={actionClass}>
        SMS
      </a>
      <a href={whatsappUrl(phone)} target="_blank" rel="noopener noreferrer" className={actionClass}>
        וואטסאפ
      </a>
    </span>
  );
}

/**
 * A customer as the barber sees them everywhere in /admin: the name saved in
 * their phone's contacts (falling back to the name the customer registered
 * with), the mobile number under it with call/SMS/WhatsApp, and a ✎ to set
 * the name by hand. `prefix` goes before the name on the same line (e.g. the
 * appointment time); `children` adds extra detail lines under the name.
 */
export function CustomerContact({
  phone,
  registeredName,
  contactName,
  prefix,
  children,
}: {
  phone: string | null;
  registeredName: string | null;
  contactName: string | null | undefined;
  prefix?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(contactName ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const displayName = contactName || registeredName || phone || "";

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!phone) return;
    setPending(true);
    setError(undefined);
    const result = await setContactNameAction({ phone_number: phone, name: draft });
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setEditing(false);
    router.refresh();
  }

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <p className="text-ink flex min-w-0 items-center gap-1.5 font-bold">
        <span className="truncate">
          {prefix}
          {displayName}
        </span>
        {phone && !editing && (
          <button
            type="button"
            onClick={() => {
              setDraft(contactName ?? registeredName ?? "");
              setEditing(true);
            }}
            aria-label="עריכת השם אצלי"
            className="text-barber-teal shrink-0 text-xs font-normal"
          >
            ✎
          </button>
        )}
      </p>
      {contactName && registeredName && contactName !== registeredName && (
        <p className="text-slate-muted truncate text-xs">נרשם/ה בשם: {registeredName}</p>
      )}
      {children}
      {editing && phone && (
        <form onSubmit={save} className="flex flex-wrap items-center gap-1.5">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="השם אצלי (ריק = השם שנרשם)"
            maxLength={80}
            autoFocus
            className="border-barber-teal bg-white text-ink placeholder-slate-muted min-w-0 flex-1 rounded-xl border px-2 py-1 text-sm"
          />
          <button
            type="submit"
            disabled={pending}
            className="bg-barber-teal text-cream-text rounded-full px-3 py-1 text-xs font-medium disabled:opacity-50"
          >
            {pending ? "שומר..." : "שמירה"}
          </button>
          <button type="button" onClick={() => setEditing(false)} className="text-slate-muted text-xs">
            ביטול
          </button>
          {error && <p className="w-full text-xs text-red-600">{error}</p>}
        </form>
      )}
      {phone && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span dir="ltr" className="text-slate-muted">
            {phone}
          </span>
          <ContactActions phone={phone} />
        </div>
      )}
    </div>
  );
}
