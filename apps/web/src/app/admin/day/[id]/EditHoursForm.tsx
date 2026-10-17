"use client";

import { useState } from "react";
import { TimeInput } from "@/components/TimeInput";
import { useRouter } from "next/navigation";
import { updateWorkDayHoursAction } from "@/lib/actions/workdays";

export function EditHoursForm({
  workDayId,
  initialStartsAt,
  initialEndsAt,
}: {
  workDayId: string;
  initialStartsAt: string;
  initialEndsAt: string;
}) {
  const router = useRouter();
  const [startsAt, setStartsAt] = useState(initialStartsAt);
  const [endsAt, setEndsAt] = useState(initialEndsAt);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(undefined);
    const result = await updateWorkDayHoursAction({
      work_day_id: workDayId,
      starts_at: startsAt,
      ends_at: endsAt,
    });
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="border-barber-teal bg-white flex flex-col gap-3 rounded-xl border p-4">
      <h2 className="text-ink font-bold">עדכון שעות עבודה</h2>
      <div className="flex gap-3">
        <label className="flex flex-1 flex-col gap-1 text-sm text-slate-muted">
          שעת התחלה
          <TimeInput
            value={startsAt}
            onChange={setStartsAt}
            className="border-barber-teal bg-white text-ink rounded-xl border p-2"
            required
          />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm text-slate-muted">
          שעת סיום
          <TimeInput
            value={endsAt}
            onChange={setEndsAt}
            className="border-barber-teal bg-white text-ink rounded-xl border p-2"
            required
          />
        </label>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="bg-barber-teal text-cream-text rounded-full p-2 font-bold disabled:opacity-50"
      >
        {pending ? "מעדכן..." : "עדכון שעות"}
      </button>
    </form>
  );
}
