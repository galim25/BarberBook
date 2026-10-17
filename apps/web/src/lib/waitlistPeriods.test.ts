import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_WAITLIST_PERIODS,
  parseWaitlistPeriods,
  validateWaitlistPeriods,
  waitlistPeriodOf,
  type WaitlistPeriodConfig,
} from "./waitlistPeriods";

const D = DEFAULT_WAITLIST_PERIODS;
const edit = (key: string, patch: Partial<WaitlistPeriodConfig>) => D.map((p) => (p.key === key ? { ...p, ...patch } : p));

test("buckets by Israel wall-clock time (winter, UTC+2)", () => {
  assert.equal(waitlistPeriodOf(new Date("2026-12-01T07:00:00Z"), D), "morning"); // 09:00
  assert.equal(waitlistPeriodOf(new Date("2026-12-01T10:50:00Z"), D), "morning"); // 12:50
  assert.equal(waitlistPeriodOf(new Date("2026-12-01T11:00:00Z"), D), "afternoon"); // 13:00
  assert.equal(waitlistPeriodOf(new Date("2026-12-01T15:00:00Z"), D), "evening"); // 17:00
});

test("slots outside every enabled range, or in a disabled one, belong to none", () => {
  assert.equal(waitlistPeriodOf(new Date("2026-12-01T05:00:00Z"), D), null); // 07:00
  assert.equal(waitlistPeriodOf(new Date("2026-12-01T18:00:00Z"), D), null); // 20:00, end exclusive
  assert.equal(waitlistPeriodOf(new Date("2026-12-01T11:30:00Z"), edit("afternoon", { enabled: false })), null);
});

test("custom ranges are honoured down to the minute", () => {
  const custom = edit("morning", { from: "08:30", to: "12:15" });
  assert.equal(waitlistPeriodOf(new Date("2026-12-01T06:30:00Z"), custom), "morning"); // 08:30
  assert.equal(waitlistPeriodOf(new Date("2026-12-01T10:15:00Z"), custom), null); // 12:15
});

test("validation", () => {
  assert.equal(validateWaitlistPeriods(D), null);
  assert.match(validateWaitlistPeriods(edit("morning", { from: "13:00" }))!, /אחרי/);
  assert.match(validateWaitlistPeriods(edit("morning", { to: "14:00" }))!, /חופפים/);
  assert.match(validateWaitlistPeriods(D.map((p) => ({ ...p, enabled: false })))!, /לפחות/);
  assert.match(validateWaitlistPeriods(edit("morning", { from: "9" }))!, /פורמט/);
  // overlap only matters between enabled periods
  assert.equal(validateWaitlistPeriods(edit("morning", { to: "14:00" }).map((p) => (p.key === "afternoon" ? { ...p, enabled: false } : p))), null);
});

test("parse falls back to defaults for junk and keeps stored values", () => {
  assert.deepEqual(parseWaitlistPeriods(null), D);
  assert.deepEqual(parseWaitlistPeriods("x"), D);
  const parsed = parseWaitlistPeriods([{ key: "morning", enabled: false, from: "08:00", to: "11:00" }, { key: "evening", from: "bad", to: "20:00" }]);
  assert.deepEqual(parsed[0], { key: "morning", label: "בוקר", enabled: false, from: "08:00", to: "11:00" });
  assert.deepEqual(parsed[2], D[2]);
});
