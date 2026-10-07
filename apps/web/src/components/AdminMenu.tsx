"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

export type AdminMenuItem = { href: string; label: string; count?: number };

/**
 * Collapses the /admin top-row links into a single toggle button that opens
 * a panel below it — same "compact control that reveals a popup" pattern as
 * the admin date calendar (see OpenWorkDayForm.tsx). Right-aligned (flush
 * with the page's right edge, like everything below it) rather than
 * centered — the panel hangs from the button's right edge via `right-0`
 * instead of the old centered left-1/2/-translate-x-1/2.
 */
export function AdminMenu({ items, footer }: { items: AdminMenuItem[]; footer?: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative flex justify-start">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="border-barber-teal text-barber-teal flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium"
      >
        <MenuIcon />
        תפריט
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="border-barber-teal bg-cream absolute top-full right-0 z-20 mt-2 flex w-64 flex-col gap-1 rounded-xl border p-2 shadow-lg">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="text-barber-teal hover:bg-white flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium"
              >
                <span>{item.label}</span>
                {!!item.count && (
                  <span className="bg-barber-teal text-cream-text rounded-full px-2 py-0.5 text-xs font-medium">
                    {item.count}
                  </span>
                )}
              </Link>
            ))}
            {footer}
          </div>
        </>
      )}
    </div>
  );
}

function MenuIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </svg>
  );
}
