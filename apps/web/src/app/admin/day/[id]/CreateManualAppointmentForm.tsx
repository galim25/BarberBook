"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ISRAEL_TIME_ZONE, MANUAL_APPOINTMENT_DURATIONS } from "@barberbook/shared";
import { getSlotsForDuration } from "@/lib/actions/booking";
import { createManualAppointmentAction } from "@/lib/actions/adminAppointments";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: ISRAEL_TIME_ZONE,
  });
}

export function CreateManualAppointmentForm({
  workDayId,
  initialStartsAt,
  onCancel,
}: {
  workDayId: string;
  initialStartsAt?: string;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [duration, setDuration] = useState<number>();
  const [slots, setSlots] = useState<string[]>([]);
  const [startsAt, setStartsAt] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    // Reset-then-refetch on a changing id (React's own documented pattern for
    // "fetch data that depends on a prop/state"), not a derived-state sync —
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSlots([]);
    setStartsAt("");
    if (!duration) return;
    getSlotsForDuration(workDayId, duration).then((s) => {
      setSlots(s);
      setStartsAt(initialStartsAt && s.includes(initialStartsAt) ? initialStartsAt : "");
    });
  }, [duration, workDayId, initialStartsAt]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!duration || !startsAt) {
      setError("יש לבחור משך זמן ושעה");
      return;
    }
    setPending(true);
    setError(undefined);
    const result = await createManualAppointmentAction({
      work_day_id: workDayId,
      duration_minutes: duration,
      starts_at: startsAt,
      customer_name: customerName,
    });
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setDuration(undefined);
    setStartsAt("");
    setCustomerName("");
    router.refresh();
  }

  const inputClass = "border-barber-teal bg-white text-ink placeholder-slate-muted rounded-xl border p-2";

  return (
    <form onSubmit={submit} className="border-barber-teal bg-white flex flex-col gap-3 rounded-xl border p-4">
      <h2 className="text-ink font-bold">קביעת תור ידנית (לקוח ללא חשבון)</h2>

      <input
        placeholder="שם הלקוח"
        value={customerName}
        onChange={(e) => setCustomerName(e.target.value)}
        className={inputClass}
        required
      />

      <label className="flex flex-col gap-1 text-sm text-slate-muted">
        משך זמן
        <select
          value={duration ?? ""}
          onChange={(e) => setDuration(Number(e.target.value))}
          className={inputClass}
          required
        >
          <option value="" disabled>
            בחרו משך זמן
          </option>
          {MANUAL_APPOINTMENT_DURATIONS.map((d) => (
            <option key={d} value={d}>
              {d} דק&apos;
            </option>
          ))}
        </select>
      </label>

      {duration && (
        <label className="flex flex-col gap-1 text-sm text-slate-muted">
          שעה
          <select value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={inputClass} required>
            <option value="" disabled>
              {slots.length === 0 ? "אין שעות פנויות ביום זה" : "בחרו שעה"}
            </option>
            {slots.map((s) => (
              <option key={s} value={s}>
                {formatTime(s)}
              </option>
            ))}
          </select>
        </label>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="bg-barber-teal text-cream-text rounded-full p-2 font-bold disabled:opacity-50"
      >
        {pending ? "שומר..." : "קביעת תור"}
      </button>

      {onCancel && (
        <button type="button" onClick={onCancel} className="text-slate-muted text-sm underline">
          ביטול
        </button>
      )}
    </form>
  );
}
