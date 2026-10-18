import { test } from "node:test";
import assert from "node:assert/strict";
import { workDayTimeToUtc } from "./workDayTimes";

test("keeps times at or after the start on the work date", () => {
  assert.equal(workDayTimeToUtc("2026-10-20", "18:00", "09:00")?.toISOString(), "2026-10-20T15:00:00.000Z");
});

test("moves a time before the start (up to 03:00) to the next date", () => {
  assert.equal(workDayTimeToUtc("2026-10-20", "01:00", "09:00")?.toISOString(), "2026-10-20T22:00:00.000Z");
  assert.equal(workDayTimeToUtc("2026-10-20", "03:00", "09:00")?.toISOString(), "2026-10-21T00:00:00.000Z");
  assert.equal(workDayTimeToUtc("2026-10-31", "00:00", "09:00")?.toISOString(), "2026-10-31T22:00:00.000Z");
});

test("rejects a time before the start that is later than 03:00", () => {
  assert.equal(workDayTimeToUtc("2026-10-20", "03:01", "09:00"), null);
  assert.equal(workDayTimeToUtc("2026-10-20", "08:00", "09:00"), null);
});
