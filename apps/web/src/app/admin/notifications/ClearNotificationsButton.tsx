"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteAdminNotificationsAction } from "@/lib/actions/adminNotifications";

export function ClearNotificationsButton({ hasAny }: { hasAny: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  if (!hasAny) return null;

  async function clearAll() {
    setPending(true);
    await deleteAdminNotificationsAction();
    setPending(false);
    router.refresh();
  }

  return (
    <button
      onClick={clearAll}
      disabled={pending}
      className="text-barber-teal self-start text-sm underline disabled:opacity-50"
    >
      {pending ? "מוחק..." : "מחיקת כל ההתראות"}
    </button>
  );
}
