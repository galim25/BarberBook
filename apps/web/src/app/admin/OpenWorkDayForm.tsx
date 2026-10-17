"use client";

import { useState } from "react";
import { TimeInput } from "@/components/TimeInput";
import { useRouter } from "next/navigation";
import { createWorkDayAction } from "@/lib/actions/workdays";

type BreakRow = { starts_at: string; ends_at: string };

const WEEKDAY_LABELS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
const MONTH_LABELS = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function todayDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatDateDisplay(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("he-IL", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
}

/**
 * Month grid matching the customer DateCalendar's look (account/book/page.tsx)
 * — RTL, Sunday on the right, filled teal circle for the active date. Unlike
 * the customer version (only pre-opened dates are pickable, since the
 * customer is choosing among days the barber already opened), here the
 * barber is the one opening a day, so every future date is pickable —
 * except ones already open (shown taken/disabled) and past dates.
 */
function AdminDateCalendar({
  value,
  takenDates,
  onChoose,
}: {
  value: string;
  takenDates: Set<string>;
  onChoose: (date: string) => void;
}) {
  const todayStr = todayDateStr();
  const [monthKey, setMonthKey] = useState(() => (value || todayStr).slice(0, 7));
  const currentMonthKey = todayStr.slice(0, 7);

  const [year, month] = monthKey.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function shiftMonth(delta: number) {
    const d = new Date(year, month - 1 + delta, 1);
    setMonthKey(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`);
  }

  return (
    <div className="border-barber-teal rounded-xl border bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          disabled={monthKey <= currentMonthKey}
          onClick={() => shiftMonth(-1)}
          className="text-barber-teal disabled:opacity-20"
          aria-label="חודש קודם"
        >
          ‹
        </button>
        <p className="text-ink font-bold">
          {MONTH_LABELS[month - 1]} {year}
        </p>
        <button type="button" onClick={() => shiftMonth(1)} className="text-barber-teal" aria-label="חודש הבא">
          ›
        </button>
      </div>
      <div dir="rtl" className="grid grid-cols-7 gap-y-2 text-center">
        {WEEKDAY_LABELS.map((w) => (
          <div key={w} className="text-slate-muted text-xs">
            {w}
          </div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={i} />;
          const dateStr = `${monthKey}-${pad(day)}`;
          const isPast = dateStr < todayStr;
          const isTaken = takenDates.has(dateStr);
          const disabled = isPast || isTaken;
          const selected = dateStr === value;
          return (
            <button
              type="button"
              key={i}
              disabled={disabled}
              onClick={() => onChoose(dateStr)}
              title={isTaken ? "כבר קיים יום עבודה פתוח בתאריך זה" : undefined}
              className={
                selected
                  ? "bg-barber-teal text-cream-text mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium"
                  : disabled
                    ? "text-ink/30 mx-auto flex h-8 w-8 items-center justify-center text-sm"
                    : "border-barber-teal text-ink mx-auto flex h-8 w-8 items-center justify-center rounded-full border text-sm font-medium"
              }
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function OpenWorkDayForm({
  barberId,
  openWorkDates,
}: {
  barberId: string;
  openWorkDates: string[];
}) {
  const router = useRouter();
  const [workDate, setWorkDate] = useState("");
  const [startsAt, setStartsAt] = useState("09:00");
  const [endsAt, setEndsAt] = useState("18:00");
  const [breaks, setBreaks] = useState<BreakRow[]>([]);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const takenDates = new Set(openWorkDates);

  function addBreak() {
    setBreaks((b) => [...b, { starts_at: "13:00", ends_at: "14:00" }]);
  }

  function updateBreak(index: number, field: keyof BreakRow, value: string) {
    setBreaks((b) => b.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  function removeBreak(index: number) {
    setBreaks((b) => b.filter((_, i) => i !== index));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!workDate) {
      setError("יש לבחור תאריך");
      return;
    }
    setPending(true);
    setError(undefined);
    const result = await createWorkDayAction({
      barber_id: barberId,
      work_date: workDate,
      starts_at: startsAt,
      ends_at: endsAt,
      breaks,
    });
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setWorkDate("");
    setBreaks([]);
    router.refresh();
  }

  const inputClass = "border-barber-teal bg-white text-ink rounded-xl border p-2";

  return (
    <form onSubmit={submit} className="border-barber-teal bg-white flex flex-col gap-3 rounded-xl border p-4">
      <h2 className="text-ink font-bold">פתיחת יום עבודה חדש</h2>

      <div className="flex flex-col gap-1">
        <p className="text-sm text-slate-muted">תאריך</p>
        <button
          type="button"
          onClick={() => setCalendarOpen((o) => !o)}
          className={`${inputClass} text-right`}
        >
          {workDate ? formatDateDisplay(workDate) : "בחרו תאריך"}
        </button>
        {calendarOpen && (
          <AdminDateCalendar
            value={workDate}
            takenDates={takenDates}
            onChoose={(d) => {
              setWorkDate(d);
              setCalendarOpen(false);
            }}
          />
        )}
      </div>

      <div className="flex gap-3">
        <label className="flex flex-1 flex-col gap-1 text-sm text-slate-muted">
          שעת התחלה
          <TimeInput
            value={startsAt}
            onChange={setStartsAt}
            className={inputClass}
            required
          />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm text-slate-muted">
          שעת סיום
          <TimeInput
            value={endsAt}
            onChange={setEndsAt}
            className={inputClass}
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
              className={inputClass}
            />
            <span className="text-slate-muted">—</span>
            <TimeInput
              value={b.ends_at}
              onChange={(v) => updateBreak(i, "ends_at", v)}
              className={inputClass}
            />
            <button
              type="button"
              onClick={() => removeBreak(i)}
              className="text-sm text-red-600 underline"
            >
              הסרה
            </button>
          </div>
        ))}
        <button type="button" onClick={addBreak} className="text-barber-teal w-fit text-sm underline">
          + הוספת הפסקה
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="bg-barber-teal text-cream-text rounded-full p-2 font-bold disabled:opacity-50"
      >
        {pending ? "פותח יום..." : "פתיחת יום עבודה"}
      </button>
    </form>
  );
}
