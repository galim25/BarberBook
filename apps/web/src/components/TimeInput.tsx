"use client";

import { useState } from "react";

/** "930" → "09:30", "9" → "09:00", "9:3" → "09:30"; anything unusable is returned as typed. */
function normalize(text: string): string {
  const [h = "", m = ""] = text.includes(":") ? text.split(":") : [text.slice(0, text.length > 2 ? text.length - 2 : text.length), text.length > 2 ? text.slice(-2) : ""];
  if (!h) return text;
  return `${h.padStart(2, "0")}:${m.padEnd(2, "0")}`;
}

/**
 * Plain typed HH:MM field (replaces the clunky native clock picker). Digits only, the colon is inserted
 * automatically; the value reported to the parent is always what is shown, and is a valid "HH:MM"
 * once complete (the `pattern` also blocks form submit while it isn't).
 */
export function TimeInput({
  value,
  onChange,
  className,
  required,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  required?: boolean;
  ariaLabel?: string;
}) {
  const [text, setText] = useState(value);
  // Keep in sync when the parent replaces the value (e.g. resets the form).
  if (value !== text && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)) setText(value);

  function handle(raw: string) {
    let out: string;
    if (raw.includes(":")) {
      const [h, ...rest] = raw.split(":");
      const hh = h.replace(/\D/g, "").slice(0, 2);
      const mm = rest.join("").replace(/\D/g, "").slice(0, 2);
      // Deleting back over the colon should remove it, not re-add it.
      out = mm === "" && raw.length < text.length ? hh : `${hh}:${mm}`;
    } else {
      const d = raw.replace(/\D/g, "").slice(0, 4);
      out = d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d.length === 2 && raw.length >= text.length ? `${d}:` : d;
    }
    setText(out);
    onChange(out);
  }

  function blur() {
    if (!text) return;
    const n = normalize(text);
    setText(n);
    onChange(n);
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      dir="ltr"
      placeholder="HH:MM"
      maxLength={5}
      // Without an explicit size an <input> has a ~20-character minimum width, which made two side-by-side
      // time fields wider than a phone screen and pushed the whole admin page into horizontal scroll.
      size={5}
      pattern="([01][0-9]|2[0-3]):[0-5][0-9]"
      title="שעה בפורמט 09:30"
      aria-label={ariaLabel}
      value={text}
      required={required}
      onChange={(e) => handle(e.target.value)}
      onBlur={blur}
      className={`${className ?? ""} min-w-0 text-center`}
    />
  );
}
