/**
 * Customer sign-in mode (docs/SMS-LOGIN.md).
 *  - "password" (default): the original phone + password login and registration.
 *  - "sms_code": phone → one-time SMS code (new numbers also enter a name). No
 *    passwords, no registration page, no password reset for customers; the
 *    administrator still signs in with a password at /login/admin.
 *
 * Turned on only when CUSTOMER_LOGIN_MODE="sms_code" AND an SMS provider that can
 * actually deliver (or log) codes is configured — otherwise flipping the flag
 * without a provider would lock every customer out. Reads only env strings so it
 * is safe to call from the edge proxy as well as server code, and is evaluated at
 * request time (pages that branch on it must be dynamic).
 */
export function isSmsLoginEnabled(): boolean {
  if (process.env.CUSTOMER_LOGIN_MODE !== "sms_code") return false;
  return process.env.SMS_PROVIDER === "019" || process.env.SMS_PROVIDER === "mock";
}
