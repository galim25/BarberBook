"use client";

import { useState } from "react";
import { ISRAEL_TIME_ZONE } from "@barberbook/shared";
import type { TimelineSegment } from "@/lib/dayTimeline";
import { CancelAppointmentButton } from "./day/[id]/CancelAppointmentButton";
import { CreateManualAppointmentForm } from "./day/[id]/CreateManualAppointmentForm";
import { MoveAppointmentButton } from "./day/[id]/MoveAppointmentButton";
import { CustomerContact } from "@/components/CustomerContact";
import { PlusIcon } from "@/components/AdminIcons";

function formatHHMM(d: Date) {
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: ISRAEL_TIME_ZONE,
    hour12: false,
  });
}

export function QuickDayAppointments({
  workDayId,
  timeline,
  showMoveButton = false,
  freeAsSlots = false,
  withCreateButton = false,
}: {
  workDayId: string;
  timeline: TimelineSegment[];
  showMoveButton?: boolean;
  /** Free time is already split into single slots (see `splitFreeSegments`) — show each by its start time only. */
  freeAsSlots?: boolean;
  /** Show the primary "קביעת תור ידני" button above the list (same form as the per-slot button, no preset time). */
  withCreateButton?: boolean;
}) {
  const [openSlotStartsAt, setOpenSlotStartsAt] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      {withCreateButton &&
        (createOpen ? (
          <CreateManualAppointmentForm workDayId={workDayId} onCancel={() => setCreateOpen(false)} />
        ) : (
          <button
            onClick={() => setCreateOpen(true)}
            className="bg-barber-teal text-cream-text flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-5 font-bold"
          >
            <PlusIcon size={20} />
            קביעת תור ידני
          </button>
        ))}
      {timeline.length === 0 && <p className="text-slate-muted text-sm">אין תורים להצגה ביום זה.</p>}
      <ul className="flex flex-col gap-2">
        {timeline.map((s, i) => {
          const time = (
            <span dir="ltr" className="text-barber-teal shrink-0 font-bold tabular-nums">
              {freeAsSlots || s.kind === "appointment"
                ? formatHHMM(s.starts_at)
                : `${formatHHMM(s.starts_at)}–${formatHHMM(s.ends_at)}`}
            </span>
          );
          if (s.kind === "free") {
            const iso = s.starts_at.toISOString();
            if (openSlotStartsAt === iso) {
              return (
                <li key={i}>
                  <CreateManualAppointmentForm
                    workDayId={workDayId}
                    initialStartsAt={iso}
                    onCancel={() => setOpenSlotStartsAt(null)}
                  />
                </li>
              );
            }
            return (
              <li
                key={i}
                className="border-barber-teal/40 bg-cream flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-xl border border-dashed px-3 py-2 text-sm"
              >
                <span className="flex min-w-0 items-center gap-2">
                  {time}
                  <span className="text-slate-muted">· פנוי</span>
                </span>
                <button
                  onClick={() => setOpenSlotStartsAt(iso)}
                  className="border-barber-teal text-barber-teal inline-flex min-h-11 items-center gap-1.5 rounded-full border bg-white px-4 text-sm font-medium"
                >
                  <PlusIcon size={16} />
                  קביעת תור ידני
                </button>
              </li>
            );
          }
          if (s.kind === "break" || s.kind === "blocked") {
            return (
              <li
                key={i}
                className="border-barber-teal/40 text-slate-muted flex items-center gap-2 rounded-xl border border-dashed bg-white px-3 py-2 text-sm"
              >
                {time}
                <span>· {s.kind === "break" ? "הפסקה" : "חסום"}</span>
              </li>
            );
          }
          return (
            <li key={s.id} className="border-barber-teal bg-white flex flex-col gap-3 rounded-xl border p-3 text-sm">
              <div className="flex items-start gap-3">
                <span className="bg-barber-teal/10 rounded-lg px-2 py-1">{time}</span>
                <div className="min-w-0 flex-1">
                  <CustomerContact
                    large
                    phone={s.phone_number}
                    registeredName={s.customer_name}
                    contactName={s.contact_name}
                  >
                    <p className="text-slate-muted text-xs break-words">
                      {s.service_name}
                      {s.attendee_type === "child" && ` (עבור: ${s.attendee_name})`}
                      {!s.has_account && " · תור ידני"}
                      {s.booked_via_ivr && " · נקבע בטלפון (IVR)"}
                    </p>
                  </CustomerContact>
                </div>
              </div>
              <div className="border-barber-teal/20 flex flex-wrap items-center gap-2 border-t pt-3">
                {showMoveButton && (
                  <MoveAppointmentButton appointmentId={s.id} workDayId={workDayId} serviceId={s.service_id} large />
                )}
                <CancelAppointmentButton appointmentId={s.id} large />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
