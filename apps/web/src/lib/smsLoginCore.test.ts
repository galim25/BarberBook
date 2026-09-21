import { test } from "node:test";
import assert from "node:assert/strict";
import { generateLoginCode, hashLoginCode, hashesMatch } from "./smsLoginCore";
import { isSmsLoginEnabled } from "./loginMode";

const SECRET = "test-secret-at-least-16-chars";

test("generated login codes are always 6 digits", () => {
  for (let i = 0; i < 200; i++) assert.match(generateLoginCode(), /^\d{6}$/);
});

test("code hash is deterministic and bound to both phone and code", () => {
  const h = hashLoginCode("0501234567", "123456", SECRET);
  assert.equal(h, hashLoginCode("0501234567", "123456", SECRET));
  assert.notEqual(h, hashLoginCode("0501234567", "123457", SECRET));
  assert.notEqual(h, hashLoginCode("0507654321", "123456", SECRET));
  assert.notEqual(h, hashLoginCode("0501234567", "123456", "another-secret-16-chars-min"));
  assert.match(h, /^[0-9a-f]{64}$/);
});

test("hashesMatch compares by value and rejects mismatched lengths", () => {
  const h = hashLoginCode("0501234567", "123456", SECRET);
  assert.equal(hashesMatch(h, h), true);
  assert.equal(hashesMatch(h, hashLoginCode("0501234567", "000000", SECRET)), false);
  assert.equal(hashesMatch(h, "abcd"), false);
});

test("SMS login needs both the mode flag and a provider that can send", () => {
  const original = { mode: process.env.CUSTOMER_LOGIN_MODE, provider: process.env.SMS_PROVIDER };
  const set = (mode: string | undefined, provider: string | undefined) => {
    if (mode === undefined) delete process.env.CUSTOMER_LOGIN_MODE; else process.env.CUSTOMER_LOGIN_MODE = mode;
    if (provider === undefined) delete process.env.SMS_PROVIDER; else process.env.SMS_PROVIDER = provider;
  };
  try {
    set(undefined, undefined);
    assert.equal(isSmsLoginEnabled(), false);
    set("sms_code", undefined); // flag without a provider must NOT lock customers out
    assert.equal(isSmsLoginEnabled(), false);
    set("sms_code", "bogus");
    assert.equal(isSmsLoginEnabled(), false);
    set("password", "019");
    assert.equal(isSmsLoginEnabled(), false);
    set("sms_code", "019");
    assert.equal(isSmsLoginEnabled(), true);
    set("sms_code", "mock");
    assert.equal(isSmsLoginEnabled(), true);
  } finally {
    set(original.mode, original.provider);
  }
});
