"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ISRAEL_TIME_ZONE } from "@barberbook/shared";
import {
  getServices,
  getOpenDates,
  getSlotsForDate,
  bookAppointmentAction,
  type ServiceOption,
  type OpenDate,
} from "@/lib/actions/booking";
import { getActiveBarbers, type BarberOption } from "@/lib/actions/barbers";
import { joinWaitlistAction } from "@/lib/actions/waitlist";
import { getRequiresApproval } from "@/lib/actions/settings";
import { getDayPeriods, type DayPeriod } from "@/lib/availability";
import { BrandHero } from "@/components/BrandHero";
import { BsdBar } from "@/components/BsdBar";

type Step = "barber" | "date" | "service" | "period" | "slot" | "attendee" | "summary" | "done";

const WEEKDAY_LABELS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
const MONTH_LABELS = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
];

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: ISRAEL_TIME_ZONE,
  });
}

function formatDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "numeric",
    timeZone: ISRAEL_TIME_ZONE,
  });
}

/** Real month grid, RTL (Sunday on the right) — only dates present in `openDates` are clickable. */
function DateCalendar({
  openDates,
  onChoose,
}: {
  openDates: OpenDate[];
  onChoose: (d: OpenDate) => void;
}) {
  const openByDate = useMemo(() => new Map(openDates.map((d) => [d.work_date, d])), [openDates]);
  const availableMonths = useMemo(() => {
    const months = new Set(openDates.map((d) => d.work_date.slice(0, 7)));
    return Array.from(months).sort();
  }, [openDates]);
  const [monthKey, setMonthKey] = useState(availableMonths[0] ?? new Date().toISOString().slice(0, 7));
  // Derived, not synced via effect: falls back to the first available month
  // whenever the stored monthKey isn't (or is no longer) in availableMonths
  // (e.g. openDates arrives async after the initial render).
  const effectiveMonthKey = availableMonths.includes(monthKey) ? monthKey : (availableMonths[0] ?? monthKey);

  const [year, month] = effectiveMonthKey.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const monthIndex = availableMonths.indexOf(effectiveMonthKey);

  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="border-barber-teal rounded-xl border bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          disabled={monthIndex <= 0}
          onClick={() => setMonthKey(availableMonths[monthIndex - 1])}
          className="text-barber-teal disabled:opacity-20"
          aria-label="חודש קודם"
        >
          ‹
        </button>
        <p className="text-ink font-bold">
          {MONTH_LABELS[month - 1]} {year}
        </p>
        <button
          type="button"
          disabled={monthIndex === -1 || monthIndex >= availableMonths.length - 1}
          onClick={() => setMonthKey(availableMonths[monthIndex + 1])}
          className="text-barber-teal disabled:opacity-20"
          aria-label="חודש הבא"
        >
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
          const dateStr = `${monthKey}-${String(day).padStart(2, "0")}`;
          const open = openByDate.get(dateStr);
          return (
            <button
              type="button"
              key={i}
              disabled={!open}
              onClick={() => open && onChoose(open)}
              className={
                open
                  ? "bg-barber-teal text-cream-text mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium"
                  : "text-ink/30 mx-auto flex h-8 w-8 items-center justify-center text-sm"
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

export default function BookAppointmentPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("barber");
  const [barbers, setBarbers] = useState<BarberOption[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [dates, setDates] = useState<OpenDate[]>([]);
  const [datesLoading, setDatesLoading] = useState(true);
  // Separate from `barbers.length === 0`: a load that is still running or that failed
  // must not look like "the shop has no barbers" (2026-10-06 incident).
  const [barbersLoading, setBarbersLoading] = useState(true);
  const [barbersError, setBarbersError] = useState(false);
  const [slots, setSlots] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [waitlistJoined, setWaitlistJoined] = useState(false);
  const [waitlistPending, setWaitlistPending] = useState(false);
  const [pendingApproval, setPendingApproval] = useState(false);
  const [requiresApproval, setRequiresApproval] = useState(false);

  const [barber, setBarber] = useState<BarberOption>();
  const [service, setService] = useState<ServiceOption>();
  const [date, setDate] = useState<OpenDate>();
  const [period, setPeriod] = useState<DayPeriod>();
  const [slot, setSlot] = useState<string>();
  const [attendeeName, setAttendeeName] = useState("");

  const periods = useMemo(
    () =>
      date
        ? getDayPeriods({ starts_at: new Date(date.starts_at), ends_at: new Date(date.ends_at) })
        : [],
    [date],
  );
  const periodSlots = useMemo(
    () =>
      period
        ? slots.filter((s) => {
            const t = new Date(s);
            return t >= period.starts_at && t < period.ends_at;
          })
        : slots,
    [slots, period],
  );

  // Barber comes first, then dates, then service: the customer sees whether
  // there's anything open at all before picking a service, instead of
  // choosing a service and only then discovering there are no open dates.
  // A shop with only one active barber (today's default, before any
  // sub-barber is added) skips straight to date selection — no pointless
  // single-option picker.
  // Initial state is already loading=true/error=false, so nothing is set synchronously
  // (setState inside the mount effect is flagged by react-hooks); results arrive in callbacks.
  function requestBarbers() {
    return getActiveBarbers()
      .then(async (list) => {
        setBarbers(list);
        if (list.length === 1) {
          if (!(await chooseBarber(list[0]))) setBarbersError(true);
        } else {
          setDatesLoading(false);
        }
      })
      .catch(() => {
        setBarbersError(true);
        setDatesLoading(false);
      })
      .finally(() => setBarbersLoading(false));
  }

  function retryLoadBarbers() {
    setBarbersLoading(true);
    setBarbersError(false);
    return requestBarbers();
  }

  /** Returns false (and shows an error) when the open dates could not be loaded. */
  async function chooseBarber(b: BarberOption): Promise<boolean> {
    setBarber(b);
    setError(undefined);
    setDatesLoading(true);
    try {
      const openDates = await getOpenDates(b.id);
      setDates(openDates);
      setStep("date");
      return true;
    } catch {
      setError("לא הצלחנו לטעון את התאריכים הפנויים. נסו שוב.");
      return false;
    } finally {
      setDatesLoading(false);
    }
  }

  useEffect(() => {
    requestBarbers();
    getRequiresApproval()
      .then(setRequiresApproval)
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function chooseDate(d: OpenDate) {
    if (!barber) return;
    setDate(d);
    setError(undefined);
    const available = await getServices(barber.id);
    setServices(available);
    setStep("service");
  }

  async function chooseService(s: ServiceOption) {
    if (!date) return;
    setService(s);
    setError(undefined);
    const available = await getSlotsForDate(date.work_day_id, s.id);
    setSlots(available);
    // The whole open day fits in one time-of-day bucket — skip a
    // meaningless single-button choice and go straight to the slot grid.
    if (periods.length === 1) {
      setPeriod(periods[0]);
      setStep("slot");
      return;
    }
    setStep("period");
  }

  function choosePeriod(p: DayPeriod) {
    setPeriod(p);
    setError(undefined);
    setStep("slot");
  }

  function chooseSlot(s: string) {
    setSlot(s);
    setError(undefined);
    // Nothing is booked yet — the customer reviews everything on the summary
    // step and only "אישור" there actually creates the appointment.
    setStep(service?.is_child_service ? "attendee" : "summary");
  }

  async function confirm() {
    const starts_at = slot;
    if (!service || !date || !starts_at) return;
    setPending(true);
    setError(undefined);
    const result = await bookAppointmentAction({
      work_day_id: date.work_day_id,
      service_id: service.id,
      starts_at,
      attendee_name: service.is_child_service ? attendeeName : undefined,
    });
    setPending(false);
    if (result.error) {
      setError(result.error);
      // The slot might have just been taken by someone else — refresh the list.
      const available = await getSlotsForDate(date.work_day_id, service.id);
      setSlots(available);
      setStep("slot");
      return;
    }
    setPendingApproval(!!result.pendingApproval);
    setStep("done");
  }

  async function joinWaitlist() {
    setWaitlistPending(true);
    await joinWaitlistAction();
    setWaitlistPending(false);
    setWaitlistJoined(true);
  }

  /** Back to the very first step — after a booking ("קביעת תור נוסף") and from the summary's "ביטול". */
  function bookAnother() {
    setError(undefined);
    setService(undefined);
    setDate(undefined);
    setPeriod(undefined);
    setSlot(undefined);
    setAttendeeName("");
    setPendingApproval(false);
    if (barbers.length === 1) {
      setStep("date");
    } else {
      setBarber(undefined);
      setDates([]);
      setStep("barber");
    }
  }

  return (
    <main dir="rtl" className="bg-cream mx-auto flex min-h-screen max-w-md flex-col p-6">
      <BsdBar />
      <BrandHero />
      <h1 className="text-barber-teal mt-6 mb-6 text-center text-3xl font-bold">קביעת תור</h1>

      {requiresApproval && step !== "done" && (
        <p className="text-slate-muted mb-4 text-sm">
          לתשומת ליבך: כרגע כל תור וכל בקשת ביטול דורשים אישור מפורש של הספר.
        </p>
      )}

      {step === "barber" && (
        <div className="flex flex-col gap-2">
          <p className="text-ink font-bold">בחרו ספר:</p>
          {barbersLoading ? (
            <p className="text-slate-muted">טוען...</p>
          ) : barbersError ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-red-600">לא הצלחנו לטעון את הנתונים. בדקו את החיבור ונסו שוב.</p>
              <button
                type="button"
                onClick={retryLoadBarbers}
                className="bg-barber-teal text-cream-text rounded-full py-3 text-center text-lg font-bold"
              >
                נסו שוב
              </button>
            </div>
          ) : barbers.length === 0 ? (
            <p className="text-slate-muted">אין כרגע ספרים זמינים.</p>
          ) : (
            barbers.map((b) => (
              <button
                type="button"
                key={b.id}
                onClick={() => chooseBarber(b)}
                className="border-barber-teal text-ink hover:bg-barber-teal/10 rounded-xl border bg-white p-3 text-right"
              >
                {b.full_name}
              </button>
            ))
          )}
          {error && !barbersError && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}

      {step === "date" && (
        <div className="flex flex-col gap-3">
          <p className="text-ink font-bold">בחרו תאריך:</p>
          {datesLoading ? (
            <p className="text-slate-muted">טוען תאריכים...</p>
          ) : dates.length === 0 ? (
            <div className="flex flex-col gap-2">
              <p className="text-slate-muted">אין כרגע ימים פתוחים להזמנה.</p>
              {waitlistJoined ? (
                <p className="text-barber-teal text-sm font-medium">
                  תקבל/י התראה ברגע שייפתחו תאריכים חדשים לקביעת תורים.
                </p>
              ) : (
                <button
                  type="button"
                  onClick={joinWaitlist}
                  disabled={waitlistPending}
                  className="border-barber-teal text-barber-teal rounded-full border py-2 text-sm font-medium disabled:opacity-50"
                >
                  {waitlistPending ? "נרשם..." : "התרע/י לי כשייפתחו תאריכים לקביעת תורים"}
                </button>
              )}
            </div>
          ) : (
            <DateCalendar openDates={dates} onChoose={chooseDate} />
          )}
          {barbers.length > 1 && (
            <button
              type="button"
              onClick={() => {
                setBarber(undefined);
                setStep("barber");
              }}
              className="text-barber-teal self-start text-sm font-medium"
            >
              חזרה
            </button>
          )}
        </div>
      )}

      {step === "service" && (
        <div className="flex flex-col gap-2">
          <p className="text-ink font-bold">בחרו שירות:</p>
          {services.map((s) => (
            <button
              type="button"
              key={s.id}
              onClick={() => chooseService(s)}
              className="border-barber-teal text-ink hover:bg-barber-teal/10 rounded-xl border bg-white p-3 text-right"
            >
              {s.name} <span className="text-slate-muted text-sm">({s.duration_minutes} דק&apos;)</span>
            </button>
          ))}
          <button type="button" onClick={() => setStep("date")} className="text-barber-teal self-start text-sm font-medium">
            חזרה
          </button>
        </div>
      )}

      {step === "period" && (
        <div className="flex flex-col gap-3">
          <p className="text-ink font-bold">באיזה חלק מהיום נוח לך?</p>
          <div className="flex flex-col gap-2">
            {periods.map((p) => {
              const count = slots.filter((s) => {
                const t = new Date(s);
                return t >= p.starts_at && t < p.ends_at;
              }).length;
              return (
                <button
                  type="button"
                  key={p.key}
                  disabled={count === 0}
                  onClick={() => choosePeriod(p)}
                  className="border-barber-teal text-ink hover:bg-barber-teal/10 rounded-xl border bg-white p-3 text-right disabled:opacity-50"
                >
                  {p.label}{" "}
                  <span className="text-slate-muted text-sm">
                    ({formatTime(p.starts_at.toISOString())}–{formatTime(p.ends_at.toISOString())} ·{" "}
                    {count > 0 ? `${count} פנויים` : "מלא"})
                  </span>
                </button>
              );
            })}
          </div>
          {slots.length === 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-slate-muted">אין שעות פנויות ביום זה.</p>
              {waitlistJoined ? (
                <p className="text-barber-teal text-sm font-medium">
                  נרשמת לרשימת ההמתנה — נעדכן אותך כשיתפנה תור.
                </p>
              ) : (
                <button
                  type="button"
                  onClick={joinWaitlist}
                  disabled={waitlistPending}
                  className="border-barber-teal text-barber-teal rounded-full border py-2 text-sm font-medium disabled:opacity-50"
                >
                  {waitlistPending ? "נרשם..." : "הצטרפ/י לרשימת ההמתנה"}
                </button>
              )}
            </div>
          )}
          <button type="button" onClick={() => setStep("service")} className="text-barber-teal self-start text-sm font-medium">
            חזרה
          </button>
        </div>
      )}

      {step === "slot" && (
        <div className="flex flex-col gap-3">
          <p className="text-ink font-bold">בחרו שעה:</p>
          {periodSlots.length === 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-slate-muted">אין שעות פנויות בטווח הזה.</p>
              {waitlistJoined ? (
                <p className="text-barber-teal text-sm font-medium">
                  נרשמת לרשימת ההמתנה — נעדכן אותך כשיתפנה תור.
                </p>
              ) : (
                <button
                  type="button"
                  onClick={joinWaitlist}
                  disabled={waitlistPending}
                  className="border-barber-teal text-barber-teal rounded-full border py-2 text-sm font-medium disabled:opacity-50"
                >
                  {waitlistPending ? "נרשם..." : "הצטרפ/י לרשימת ההמתנה"}
                </button>
              )}
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex flex-wrap gap-2">
            {periodSlots.map((s) => (
              <button
                type="button"
                key={s}
                disabled={pending}
                onClick={() => chooseSlot(s)}
                className="border-barber-teal text-barber-teal hover:bg-barber-teal hover:text-cream-text rounded-full border px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {formatTime(s)}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setStep(periods.length === 1 ? "service" : "period")}
            className="text-barber-teal self-start text-sm font-medium"
          >
            חזרה
          </button>
        </div>
      )}

      {step === "attendee" && (
        <div className="flex flex-col gap-4">
          <p className="text-slate-muted">
            {service?.name} · {date && formatDate(date.work_date)} · {slot && formatTime(slot)}
          </p>
          <label className="border-barber-teal focus-within:ring-barber-teal flex items-center gap-2 rounded-xl border bg-white px-4 py-3 focus-within:ring-2">
            <input
              placeholder="שם הילד/ה"
              value={attendeeName}
              onChange={(e) => setAttendeeName(e.target.value)}
              className="text-ink placeholder-slate-muted w-full bg-transparent outline-none"
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="button"
            onClick={() => setStep("summary")}
            disabled={!attendeeName.trim()}
            className="bg-barber-teal text-cream-text rounded-full py-3 text-center text-lg font-bold tracking-wide uppercase disabled:opacity-50"
          >
            המשך
          </button>
          <button type="button" onClick={() => setStep("slot")} className="text-barber-teal self-start text-sm font-medium">
            חזרה
          </button>
        </div>
      )}

      {step === "summary" && (
        <div className="flex flex-col gap-4">
          {/* Same look as the "הודעות חשובות" announcement cards on /account. */}
          <div className="from-barber-teal to-cream rounded-xl bg-gradient-to-bl p-4 text-right">
            <p className="text-ink text-lg font-bold">סיכום פרטי התור</p>
            <ul className="text-ink/80 mt-2 flex flex-col gap-1">
              {barber && (
                <li>
                  <span className="text-ink font-bold">ספר: </span>
                  {barber.full_name}
                </li>
              )}
              <li>
                <span className="text-ink font-bold">שירות: </span>
                {service?.name} ({service?.duration_minutes} דק&apos;)
              </li>
              {service?.is_child_service && (
                <li>
                  <span className="text-ink font-bold">עבור: </span>
                  {attendeeName}
                </li>
              )}
              <li>
                <span className="text-ink font-bold">תאריך: </span>
                {date && formatDate(date.work_date)}
              </li>
              <li>
                <span className="text-ink font-bold">שעה: </span>
                {slot && formatTime(slot)}
              </li>
            </ul>
            {requiresApproval && (
              <p className="text-ink/60 mt-2 text-xs">לאחר האישור, התור יישלח לאישור הספר.</p>
            )}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="button"
            onClick={confirm}
            disabled={pending}
            className="bg-barber-teal text-cream-text rounded-full py-3 text-center text-lg font-bold disabled:opacity-50"
          >
            {pending ? "שומר..." : "אישור"}
          </button>
          <button
            type="button"
            onClick={bookAnother}
            disabled={pending}
            className="border-barber-teal text-barber-teal rounded-full border py-3 font-bold disabled:opacity-50"
          >
            ביטול
          </button>
        </div>
      )}

      {step === "done" && (
        <div className="flex flex-col gap-4">
          <p className="text-ink text-lg font-bold">
            {pendingApproval ? "הבקשה שלך נשלחה לאישור הספר." : "התור נקבע בהצלחה!"}
          </p>
          <button
            type="button"
            onClick={bookAnother}
            className="border-barber-teal text-barber-teal rounded-full border py-3 font-bold"
          >
            קביעת תור נוסף
          </button>
          <button
            type="button"
            onClick={() => router.push("/account/appointments")}
            className="bg-barber-teal text-cream-text rounded-full py-3 text-center font-bold"
          >
            לצפייה בתורים שלי
          </button>
        </div>
      )}

    </main>
  );
}
