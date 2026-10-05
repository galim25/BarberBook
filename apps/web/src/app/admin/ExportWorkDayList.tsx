import { ISRAEL_TIME_ZONE } from "@barberbook/shared";
import type { ExportWorkDay } from "@/lib/actions/workdays";

function formatWorkDate(d: Date) {
  return d.toLocaleDateString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "numeric",
    year: "numeric",
    timeZone: ISRAEL_TIME_ZONE,
  });
}

function formatHHMM(d: Date) {
  return d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", timeZone: ISRAEL_TIME_ZONE });
}

export function ExportWorkDayList({ days }: { days: ExportWorkDay[] }) {
  return (
    <div className="flex flex-col gap-6">
      {days.map((d) => (
        <div key={d.id} className="break-inside-avoid">
          <h2 className="mb-2 font-bold">
            {formatWorkDate(d.work_date)} · {formatHHMM(d.starts_at)}–{formatHHMM(d.ends_at)}
          </h2>
          {d.appointments.length === 0 ? (
            <p className="text-sm text-gray-500">אין תורים ביום זה.</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-300 text-right">
                  <th className="p-1">שעה</th>
                  <th className="p-1">שירות</th>
                  <th className="p-1">לקוח</th>
                  <th className="p-1">טלפון</th>
                </tr>
              </thead>
              <tbody>
                {d.appointments.map((a) => (
                  <tr key={a.id} className="border-b border-gray-200">
                    <td className="p-1">
                      {formatHHMM(a.starts_at)}–{formatHHMM(a.ends_at)}
                    </td>
                    <td className="p-1">{a.service_name}</td>
                    <td className="p-1">
                      {a.contact_name ?? a.customer_name}
                      {a.attendee_type === "child" && ` (עבור: ${a.attendee_name})`}
                    </td>
                    <td className="p-1 text-right" dir="ltr">
                      {a.phone_number ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  );
}
