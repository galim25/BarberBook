import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDayTimeline } from "./dayTimeline";

const at = (h: number, m = 0) => new Date(`2026-08-01T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`);

test("a day with nothing booked is a single free segment", () => {
  const timeline = buildDayTimeline(at(9), at(18), [], [], []);
  assert.deepEqual(timeline, [{ kind: "free", starts_at: at(9), ends_at: at(18) }]);
});

test("fills the gaps around a break, a blocked time and an appointment in order", () => {
  const timeline = buildDayTimeline(
    at(9),
    at(12),
    [{ starts_at: at(10), ends_at: at(10, 15) }],
    [{ starts_at: at(11), ends_at: at(11, 30) }],
    [
      {
        id: "a1",
        service_id: "s1",
        starts_at: at(9, 30),
        ends_at: at(9, 45),
        customer_name: "דנה",
        attendee_name: "דנה",
        attendee_type: "self",
        service_name: "תספורת מבוגר",
        has_account: true,
        booked_via_ivr: true,
        phone_number: "0501234567",
      },
    ],
  );

  assert.deepEqual(
    timeline.map((s) => [s.kind, s.starts_at.getTime(), s.ends_at.getTime()]),
    [
      ["free", at(9).getTime(), at(9, 30).getTime()],
      ["appointment", at(9, 30).getTime(), at(9, 45).getTime()],
      ["free", at(9, 45).getTime(), at(10).getTime()],
      ["break", at(10).getTime(), at(10, 15).getTime()],
      ["free", at(10, 15).getTime(), at(11).getTime()],
      ["blocked", at(11).getTime(), at(11, 30).getTime()],
      ["free", at(11, 30).getTime(), at(12).getTime()],
    ],
  );
});

test("an appointment touching the day start or end leaves no free segment there", () => {
  const timeline = buildDayTimeline(
    at(9),
    at(10),
    [],
    [],
    [
      {
        id: "a1",
        service_id: "s1",
        starts_at: at(9),
        ends_at: at(10),
        customer_name: "יוסי",
        attendee_name: "יוסי",
        attendee_type: "self",
        service_name: "חלאקה",
        has_account: false,
        booked_via_ivr: false,
        phone_number: null,
      },
    ],
  );
  assert.equal(timeline.length, 1);
  assert.equal(timeline[0].kind, "appointment");
});
