"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setNotifyFreedSlotsAction } from "@/lib/actions/waitlist";

export function FreedSlotNotifyToggle({ initialValue }: { initialValue: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function toggle() {
    const next = !value;
    setPending(true);
    setError(undefined);
    const result = await setNotifyFreedSlotsAction(next);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setValue(next);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-3">
        <p className="text-ink text-sm">התראה כשמתפנה תור</p>
        <button
          onClick={toggle}
          disabled={pending}
          role="switch"
          aria-checked={value}
          aria-label="התראה כשמתפנה תור"
          className={`h-7 w-12 shrink-0 rounded-full border p-1 transition-colors disabled:opacity-50 ${
            value ? "bg-barber-teal border-barber-teal" : "bg-white border-barber-teal"
          }`}
        >
          <span
            className={`block h-5 w-5 rounded-full transition-transform ${
              value ? "bg-white translate-x-[-20px]" : "bg-slate-muted translate-x-0"
            }`}
          />
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
