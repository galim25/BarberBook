"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ISRAEL_TIME_ZONE } from "@barberbook/shared";
import { getSlotsForDate } from "@/lib/actions/booking";
import { adminRescheduleAppointmentAction } from "@/lib/actions/adminAppointments";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: ISRAEL_TIME_ZONE,
  });
}

export function MoveAppointmentButton({
  appointmentId,
  workDayId,
  serviceId,
}: {
  appointmentId: string;
  workDayId: string;
  serviceId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [slots, setSlots] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function start() {
    setOpen(true);
    setError(undefined);
    setSlots(await getSlotsForDate(workDayId, serviceId, appointmentId));
  }

  async function chooseSlot(starts_at: string) {
    setPending(true);
    setError(undefined);
    const result = await adminRescheduleAppointmentAction({
      appointment_id: appointmentId,
      work_day_id: workDayId,
      starts_at,
    });
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={start} className="bg-barber-teal text-cream-text rounded-full px-3 py-1 text-xs font-medium">
        העברת התור לשעה אחרת
      </button>
    );
  }

  return (
    <div className="border-barber-teal bg-white mt-2 flex flex-col gap-2 rounded-xl border p-3">
      <p className="text-sm text-slate-muted">בחרו שעה חדשה באותו יום:</p>
      {slots.length === 0 && <p className="text-sm text-slate-muted">אין שעות פנויות אחרות ביום זה.</p>}
      <div className="grid grid-cols-4 gap-2">
        {slots.map((s) => (
          <button
            key={s}
            disabled={pending}
            onClick={() => chooseSlot(s)}
            className="border-barber-teal text-barber-teal rounded-xl border p-2 text-sm disabled:opacity-50"
          >
            {formatTime(s)}
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button onClick={() => setOpen(false)} className="text-sm text-slate-muted underline">
        ביטול
      </button>
    </div>
  );
}
