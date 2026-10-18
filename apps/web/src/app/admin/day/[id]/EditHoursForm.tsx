"use client";

import { useState } from "react";
import { TimeInput } from "@/components/TimeInput";
import { useRouter } from "next/navigation";
import { updateWorkDayHoursAction } from "@/lib/actions/workdays";

type BreakRow = { starts_at: string; ends_at: string };

export function EditHoursForm({
  workDayId,
  initialStartsAt,
  initialEndsAt,
  initialBreaks,
}: {
  workDayId: string;
  initialStartsAt: string;
  initialEndsAt: string;
  initialBreaks: BreakRow[];
}) {
  const router = useRouter();
  const [startsAt, setStartsAt] = useState(initialStartsAt);
  const [endsAt, setEndsAt] = useState(initialEndsAt);
  const [breaks, setBreaks] = useState<BreakRow[]>(initialBreaks);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  function updateBreak(index: number, field: keyof BreakRow, value: string) {
    setBreaks((b) => b.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(undefined);
    const result = await updateWorkDayHoursAction({
      work_day_id: workDayId,
      starts_at: startsAt,
      ends_at: endsAt,
      breaks,
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
      <div className="flex flex-col gap-2">
        <p className="text-sm text-slate-muted">הפסקות</p>
        {breaks.map((b, i) => (
          <div key={i} className="flex items-center gap-2">
            <TimeInput
              value={b.starts_at}
              onChange={(v) => updateBreak(i, "starts_at", v)}
              className="border-barber-teal bg-white text-ink w-0 min-w-0 flex-1 rounded-xl border p-2"
              required
            />
            <span className="text-slate-muted">—</span>
            <TimeInput
              value={b.ends_at}
              onChange={(v) => updateBreak(i, "ends_at", v)}
              className="border-barber-teal bg-white text-ink w-0 min-w-0 flex-1 rounded-xl border p-2"
              required
            />
            <button
              type="button"
              onClick={() => setBreaks((rows) => rows.filter((_, j) => j !== i))}
              className="shrink-0 text-sm text-red-600 underline"
            >
              הסרה
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setBreaks((rows) => [...rows, { starts_at: "13:00", ends_at: "14:00" }])}
          className="text-barber-teal w-fit text-sm underline"
        >
          + הוספת הפסקה
        </button>
      </div>
      <p className="text-xs text-slate-muted">ניתן לסיים עד 03:00 לפנות בוקר (למשל 01:30 = אחרי חצות).</p>
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
