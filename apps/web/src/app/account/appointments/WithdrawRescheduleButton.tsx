"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { withdrawRescheduleRequestAction } from "@/lib/actions/rescheduleRequests";

export function WithdrawRescheduleButton({ appointmentId }: { appointmentId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function withdraw() {
    setPending(true);
    setError(undefined);
    const result = await withdrawRescheduleRequestAction(appointmentId);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-1">
      <button onClick={withdraw} disabled={pending} className="text-barber-teal self-start text-sm font-medium disabled:opacity-50">
        {pending ? "מבטל..." : "ביטול בקשת השינוי"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
