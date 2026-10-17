"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setWaitlistPeriodsAction } from "@/lib/actions/waitlistSettings";
import { TimeInput } from "@/components/TimeInput";
import type { WaitlistPeriodConfig } from "@/lib/waitlistPeriods";

export function WaitlistPeriodsForm({ initial }: { initial: WaitlistPeriodConfig[] }) {
  const router = useRouter();
  const [periods, setPeriods] = useState(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);

  function update(key: string, patch: Partial<WaitlistPeriodConfig>) {
    setSaved(false);
    setPeriods((all) => all.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  }

  async function save() {
    setPending(true);
    setError(undefined);
    const result = await setWaitlistPeriodsAction(periods);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  const inputClass = "border-barber-teal bg-white text-ink w-24 rounded-xl border p-2";

  return (
    <div className="flex flex-col gap-4">
      <p className="text-slate-muted text-sm">
        סמנו אילו טווחים יוצגו ללקוחות כשהם נכנסים לרשימת המתנה לתאריך, וקבעו את השעות של כל טווח. ההגדרה חלה גם על
        ההתראות: לקוח שנרשם לטווח מקבל התראה רק על תור שהתפנה בשעות האלה.
      </p>

      {periods.map((p) => (
        <div
          key={p.key}
          className={`rounded-xl border p-3 ${p.enabled ? "border-barber-teal bg-white" : "border-slate-300 bg-white/60"}`}
        >
          <button
            type="button"
            role="switch"
            aria-checked={p.enabled}
            onClick={() => update(p.key, { enabled: !p.enabled })}
            className="flex w-full items-center justify-between text-right"
          >
            <span className={`text-lg font-bold ${p.enabled ? "text-ink" : "text-slate-muted"}`}>{p.label}</span>
            <span
              className={`rounded-full px-3 py-1 text-sm font-medium ${
                p.enabled ? "bg-barber-teal text-cream-text" : "border border-slate-300 text-slate-muted"
              }`}
            >
              {p.enabled ? "מוצג ללקוחות ✓" : "מוסתר"}
            </span>
          </button>
          <div className="mt-3 flex items-center gap-2">
            <TimeInput value={p.from} onChange={(v) => update(p.key, { from: v })} className={inputClass} ariaLabel={`${p.label} - התחלה`} />
            <span className="text-slate-muted">—</span>
            <TimeInput value={p.to} onChange={(v) => update(p.key, { to: v })} className={inputClass} ariaLabel={`${p.label} - סיום`} />
          </div>
        </div>
      ))}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-barber-teal text-sm font-medium">ההגדרות נשמרו.</p>}
      <button
        type="button"
        onClick={save}
        disabled={pending}
        className="bg-barber-teal text-cream-text rounded-full py-2 font-bold disabled:opacity-50"
      >
        {pending ? "שומר..." : "שמירה"}
      </button>
    </div>
  );
}
