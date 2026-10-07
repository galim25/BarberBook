"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteHistoryAction } from "@/lib/actions/workdays";

export function DeleteHistoryMenuItem() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function del() {
    if (
      !window.confirm(
        "למחוק לצמיתות את כל ההיסטוריה — כל התורים וימי העבודה עד הרגע הזה? תורים עתידיים לא יימחקו. לא ניתן לשחזר. מומלץ לשמור קודם עותק דרך 'היסטוריה וגיבוי'.",
      )
    )
      return;
    setPending(true);
    setError(undefined);
    const result = await deleteHistoryAction();
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <>
      <button
        onClick={del}
        disabled={pending}
        className="flex items-center rounded-lg px-3 py-2 text-start text-sm font-medium text-red-600 hover:bg-white disabled:opacity-50"
      >
        {pending ? "מוחק..." : "מחיקת היסטוריה"}
      </button>
      {error && <p className="px-3 text-sm text-red-600">{error}</p>}
    </>
  );
}
