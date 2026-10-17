"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  approveRescheduleRequestAction,
  rejectRescheduleRequestAction,
} from "@/lib/actions/rescheduleRequests";

export function DecideRequestButtons({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState<"approve" | "reject">();
  const [error, setError] = useState<string>();

  async function decide(action: "approve" | "reject") {
    setPending(action);
    setError(undefined);
    const result = await (action === "approve"
      ? approveRescheduleRequestAction(requestId)
      : rejectRescheduleRequestAction(requestId));
    setPending(undefined);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-3">
        <button
          onClick={() => decide("approve")}
          disabled={!!pending}
          className="bg-barber-teal text-cream-text rounded-full px-3 py-1 text-sm font-bold disabled:opacity-50"
        >
          {pending === "approve" ? "מאשר..." : "אישור שינוי"}
        </button>
        <button
          onClick={() => decide("reject")}
          disabled={!!pending}
          className="border-barber-teal text-barber-teal rounded-full border px-3 py-1 text-sm font-medium disabled:opacity-50"
        >
          {pending === "reject" ? "דוחה..." : "דחיית בקשה"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
