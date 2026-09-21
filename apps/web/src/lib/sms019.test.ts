import { test } from "node:test";
import assert from "node:assert/strict";
import { build019Payload, to019Phone, getOtpSmsProvider, NoopSmsProvider, MockSmsProvider, Sms019Provider } from "@barberbook/shared";

test("019sms wants the local number without its leading zero", () => {
  assert.equal(to019Phone("0501234567"), "501234567");
  assert.equal(to019Phone("031234567"), "31234567");
});

test("019sms payload follows the documented sms.user/source/destinations/message shape", () => {
  const payload = build019Payload({ username: "u", sender: "BarberBook" }, "0501234567", "hello");
  assert.deepEqual(payload, {
    sms: {
      user: { username: "u" },
      source: "BarberBook",
      destinations: { phone: [{ $: { id: "1" }, _: "501234567" }] },
      message: "hello",
    },
  });
});

test("OTP provider selection: real only for 019, log-only for mock, otherwise nothing is sent", () => {
  const original = process.env.SMS_PROVIDER;
  try {
    delete process.env.SMS_PROVIDER;
    assert.ok(getOtpSmsProvider() instanceof NoopSmsProvider);
    process.env.SMS_PROVIDER = "mock";
    assert.ok(getOtpSmsProvider() instanceof MockSmsProvider);
    process.env.SMS_PROVIDER = "019";
    assert.ok(getOtpSmsProvider() instanceof Sms019Provider);
  } finally {
    if (original === undefined) delete process.env.SMS_PROVIDER; else process.env.SMS_PROVIDER = original;
  }
});

test("019sms provider refuses to send when it is not configured", async () => {
  await assert.rejects(() => new Sms019Provider({ username: "", token: "", sender: "" }).send("0501234567", "x"), /not configured/);
});
