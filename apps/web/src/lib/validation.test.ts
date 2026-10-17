import { test } from "node:test";
import assert from "node:assert/strict";
import { phoneSchema } from "./validation";

test("phoneSchema normalizes international and formatted Israeli numbers to local", () => {
  for (const input of [
    "0501234567",
    "050-123-4567",
    " 050 123 4567 ",
    "+972501234567",
    "972501234567",
    "00972501234567",
    "+972 (0)50 123 4567",
    "+972-50-123-4567",
  ]) {
    assert.equal(phoneSchema.parse(input), "0501234567", input);
  }
  assert.equal(phoneSchema.parse("+97235551234"), "035551234");
});

test("phoneSchema still rejects things that are not Israeli numbers", () => {
  for (const input of ["", "12345", "+14155550123", "+97250123", "abc", "5012345678"]) {
    assert.equal(phoneSchema.safeParse(input).success, false, input);
  }
});

import { mobilePhoneSchema } from "./validation";

test("mobilePhoneSchema accepts mobiles in any typed form and rejects landline/VoIP", () => {
  for (const input of ["0521234567", "+972521234567", "052-123-4567"]) {
    assert.equal(mobilePhoneSchema.parse(input), "0521234567", input);
  }
  for (const input of ["035551234", "+97235551234", "0771234567", "021234567"]) {
    assert.equal(mobilePhoneSchema.safeParse(input).success, false, input);
  }
});
