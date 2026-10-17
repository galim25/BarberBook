"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { leaveDateWaitlistEntryAction, type DateWaitlistView } from "@/lib/actions/waitlist";
import { ISRAEL_TIME_ZONE } from "@barberbook/shared";

export function DateWaitlistList({ entries }: { entries: DateWaitlistView[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string>();

  async function leave(id: string) {
    setPendingId(id);
    await leaveDateWaitlistEntryAction(id);
    setPendingId(undefined);
    router.refresh();
  }

  return (
    <ul className="flex flex-col gap-2">
      {entries.map((e) => (
        <li key={e.id} className="flex items-center justify-between gap-2">
          <span className="text-ink text-sm">
            {new Date(`${e.work_date}T00:00:00Z`).toLocaleDateString("he-IL", {
              weekday: "long",
              day: "numeric",
              month: "numeric",
              timeZone: ISRAEL_TIME_ZONE,
            })}{" "}
            · {e.period_label}
          </span>
          <button
            onClick={() => leave(e.id)}
            disabled={pendingId === e.id}
            className="text-barber-teal text-sm font-medium disabled:opacity-50"
          >
            {pendingId === e.id ? "מסיר..." : "הסרה"}
          </button>
        </li>
      ))}
    </ul>
  );
}
