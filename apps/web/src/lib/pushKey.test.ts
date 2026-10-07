import { test } from "node:test";
import assert from "node:assert/strict";
import { subscriptionUsesKey, urlBase64ToUint8Array } from "./pushKey";

test("decodes a base64url VAPID key to bytes", () => {
  assert.deepEqual([...urlBase64ToUint8Array("AQID")], [1, 2, 3]);
  assert.deepEqual([...urlBase64ToUint8Array("-_8")], [251, 255]);
});

test("detects a subscription made with a different VAPID key", () => {
  const current = Uint8Array.from([1, 2, 3]);
  assert.equal(subscriptionUsesKey(Uint8Array.from([1, 2, 3]).buffer, current), true);
  assert.equal(subscriptionUsesKey(Uint8Array.from([1, 2, 4]).buffer, current), false);
  assert.equal(subscriptionUsesKey(Uint8Array.from([1, 2]).buffer, current), false);
  assert.equal(subscriptionUsesKey(null, current), true);
});
