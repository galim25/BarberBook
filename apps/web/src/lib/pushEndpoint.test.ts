import { test } from "node:test";
import assert from "node:assert/strict";
import { isAllowedPushEndpoint } from "./pushEndpoint";

test("accepts the push services real browsers use", () => {
  assert.equal(isAllowedPushEndpoint("https://fcm.googleapis.com/fcm/send/abc123"), true);
  assert.equal(isAllowedPushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/abc"), true);
  assert.equal(isAllowedPushEndpoint("https://web.push.apple.com/QAbc"), true);
  assert.equal(isAllowedPushEndpoint("https://db5p.notify.windows.com/?token=abc"), true);
});

test("rejects internal, non-https and lookalike hosts", () => {
  assert.equal(isAllowedPushEndpoint("http://fcm.googleapis.com/fcm/send/abc"), false);
  assert.equal(isAllowedPushEndpoint("https://localhost/hook"), false);
  assert.equal(isAllowedPushEndpoint("https://127.0.0.1/hook"), false);
  assert.equal(isAllowedPushEndpoint("https://169.254.169.254/latest/meta-data"), false);
  assert.equal(isAllowedPushEndpoint("https://fcm.googleapis.com.evil.example/x"), false);
  assert.equal(isAllowedPushEndpoint("https://evilfcm.googleapis.com@evil.example/x"), false);
  assert.equal(isAllowedPushEndpoint("https://fcm.googleapis.com:8443/x"), false);
  assert.equal(isAllowedPushEndpoint("not a url"), false);
});
