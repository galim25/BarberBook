"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { deleteBarberAction } from "@/lib/actions/barbers";

/** Same double-confirm delete pattern — never shown for the primary barber (checked by the caller). */
export function DeleteBarberButton({ barberId, barberName }: { barberId: string; barberName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function del(notifyCustomers: boolean) {
    const warning = notifyCustomers
      ? `למחוק לצמיתות את הספר ${barberName} — כולל כל היומן והתורים שלו/ה? לא ניתן לשחזר. לקוחות עם תור עתידי אצל ${barberName} יקבלו הודעת ביטול.`
      : `למחוק לצמיתות את הספר ${barberName} — כולל כל היומן והתורים שלו/ה? לא ניתן לשחזר. לקוחות לא יקבלו שום הודעה על כך.`;
    if (!window.confirm(warning)) return;
    if (!window.confirm("אישור נוסף: פעולה זו בלתי הפיכה. להמשיך?")) return;
    setPending(true);
    setError(undefined);
    const result = await deleteBarberAction(barberId, notifyCustomers);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-full border border-red-600 px-3 py-1 text-xs text-red-600"
      >
        מחיקת ספר
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-red-600 p-3">
      <p className="text-xs text-red-600">
        מחיקת {barberName} תמחק לצמיתות גם את כל היומן והתורים שלו/ה. מומלץ לשמור קודם{" "}
        <Link href="/admin/print-all" target="_blank" className="underline">
          עותק להדפסה/PDF
        </Link>
        .
      </p>
      <div className="flex flex-col gap-2">
        <button
          onClick={() => del(true)}
          disabled={pending}
          className="rounded-full border border-red-600 px-3 py-2 text-xs text-red-600 disabled:opacity-50"
        >
          {pending ? "מוחק..." : "מחיקה + שליחת הודעת ביטול ללקוחות"}
        </button>
        <button
          onClick={() => del(false)}
          disabled={pending}
          className="rounded-full border border-red-600 px-3 py-2 text-xs text-red-600 disabled:opacity-50"
        >
          {pending ? "מוחק..." : "מחיקה בלי לשלוח הודעה ללקוחות"}
        </button>
        <button onClick={() => setOpen(false)} disabled={pending} className="text-barber-teal text-xs underline">
          ביטול
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
