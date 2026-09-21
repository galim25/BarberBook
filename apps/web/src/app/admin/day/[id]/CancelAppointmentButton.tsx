"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cancelAppointmentAction } from "@/lib/actions/adminAppointments";

export function CancelAppointmentButton({ appointmentId }: { appointmentId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function cancel() {
    if (!window.confirm("לבטל את התור? הלקוח יקבל הודעה על הביטול. לא ניתן לשחזר.")) return;
    setPending(true);
    setError(undefined);
    const result = await cancelAppointmentAction(appointmentId);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="inline-flex flex-col gap-1">
      <button
        onClick={cancel}
        disabled={pending}
        className="bg-barber-teal text-cream-text rounded-full px-3 py-1 text-xs font-medium disabled:opacity-50"
      >
        {pending ? "מבטל..." : "ביטול תור"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
