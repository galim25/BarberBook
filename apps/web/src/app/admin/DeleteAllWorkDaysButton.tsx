"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { deleteAllWorkDaysAction } from "@/lib/actions/workdays";

export function DeleteAllWorkDaysButton({ barberId, barberName }: { barberId: string; barberName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function del(notifyCustomers: boolean) {
    const warning = notifyCustomers
      ? `למחוק לצמיתות את כל היומן של ${barberName} — כל ימי העבודה וכל התורים שלו/ה, בלי יוצא מן הכלל? לא ניתן לשחזר. לקוחות עם תור פעיל יקבלו הודעת ביטול.`
      : `למחוק לצמיתות את כל היומן של ${barberName} — כל ימי העבודה וכל התורים שלו/ה, בלי יוצא מן הכלל? לא ניתן לשחזר. לקוחות לא יקבלו שום הודעה על כך.`;
    if (!window.confirm(warning)) return;
    if (!window.confirm("אישור נוסף: פעולה זו בלתי הפיכה. להמשיך?")) return;
    setPending(true);
    setError(undefined);
    const result = await deleteAllWorkDaysAction(barberId, notifyCustomers);
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
        className="border-red-600 text-red-600 rounded-full border px-4 py-2 text-sm font-medium"
      >
        מחיקת כל היומן
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-red-600 p-3">
      <p className="text-sm text-red-600">
        מומלץ לשמור קודם{" "}
        <Link href="/admin/print-all" target="_blank" className="underline">
          עותק להדפסה/PDF של כל היומן
        </Link>{" "}
        לפני המחיקה — היא בלתי הפיכה.
      </p>
      <div className="flex flex-col gap-2">
        <button
          onClick={() => del(true)}
          disabled={pending}
          className="rounded-full border border-red-600 px-3 py-2 text-sm text-red-600 disabled:opacity-50"
        >
          {pending ? "מוחק..." : "מחיקה + שליחת הודעת ביטול ללקוחות"}
        </button>
        <button
          onClick={() => del(false)}
          disabled={pending}
          className="rounded-full border border-red-600 px-3 py-2 text-sm text-red-600 disabled:opacity-50"
        >
          {pending ? "מוחק..." : "מחיקה בלי לשלוח הודעה ללקוחות"}
        </button>
        <button onClick={() => setOpen(false)} disabled={pending} className="text-barber-teal text-sm underline">
          ביטול
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
