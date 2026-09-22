"use client";

import { useState } from "react";
import { ISRAEL_TIME_ZONE } from "@barberbook/shared";
import type { TimelineSegment } from "@/lib/dayTimeline";
import { CancelAppointmentButton } from "./day/[id]/CancelAppointmentButton";
import { CreateManualAppointmentForm } from "./day/[id]/CreateManualAppointmentForm";
import { MoveAppointmentButton } from "./day/[id]/MoveAppointmentButton";

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
  barberId,
  timeline,
  showMoveButton = false,
}: {
  workDayId: string;
  barberId: string;
  timeline: TimelineSegment[];
  showMoveButton?: boolean;
}) {
  const [openSlotStartsAt, setOpenSlotStartsAt] = useState<string | null>(null);

  return (
    <ul className="flex flex-col gap-1">
      {timeline.map((s, i) => {
        if (s.kind === "free") {
          const iso = s.starts_at.toISOString();
          if (openSlotStartsAt === iso) {
            return (
              <li key={i} className="py-1">
                <CreateManualAppointmentForm
                  workDayId={workDayId}
                  barberId={barberId}
                  initialStartsAt={iso}
                  onCancel={() => setOpenSlotStartsAt(null)}
                />
              </li>
            );
          }
          return (
            <li key={i} className="flex items-center justify-between py-2 text-sm">
              <span className="text-ink font-bold">
                {formatHHMM(s.starts_at)}–{formatHHMM(s.ends_at)} ·{" "}
                <span className="text-red-600">פנוי</span>
              </span>
              <button
                onClick={() => setOpenSlotStartsAt(iso)}
                className="bg-barber-teal text-cream-text rounded-full px-3 py-1 text-xs font-medium"
              >
                קביעת תור ידני
              </button>
            </li>
          );
        }
        if (s.kind === "break" || s.kind === "blocked") {
          return (
            <li
              key={i}
              className="border-barber-teal/40 bg-white rounded-xl border border-dashed p-2 text-sm text-slate-muted"
            >
              {formatHHMM(s.starts_at)}–{formatHHMM(s.ends_at)} ·{" "}
              {s.kind === "break" ? "הפסקה" : "חסום"}
            </li>
          );
        }
        return (
          <li
            key={s.id}
            className="border-barber-teal/20 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b py-3 text-sm last:border-b-0"
          >
            <div className="min-w-0">
              <p className="text-ink truncate font-bold">
                {formatHHMM(s.starts_at)} · {s.customer_name}
              </p>
              <p className="text-slate-muted truncate text-xs">
                {s.service_name}
                {s.attendee_type === "child" && ` (עבור: ${s.attendee_name})`}
                {!s.has_account && " · תור ידני"}
              </p>
              {s.booked_via_ivr && (
                <p className="text-slate-muted truncate text-xs">
                  נקבע בטלפון (IVR)
                  {s.phone_number && (
                    <>
                      {" · "}
                      <span dir="ltr">{s.phone_number}</span>
                    </>
                  )}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              {s.booked_via_ivr && s.phone_number && (
                <a
                  href={`tel:${s.phone_number}`}
                  className="border-barber-teal text-barber-teal rounded-full border px-3 py-1 text-xs font-medium"
                >
                  חיוג
                </a>
              )}
              {showMoveButton && (
                <MoveAppointmentButton appointmentId={s.id} workDayId={workDayId} serviceId={s.service_id} />
              )}
              <CancelAppointmentButton appointmentId={s.id} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
