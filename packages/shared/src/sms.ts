import { Sms019Provider } from "./sms019";

export interface SmsProvider {
  send(phoneNumber: string, message: string): Promise<void>;
}

export class MockSmsProvider implements SmsProvider {
  async send(phoneNumber: string, message: string): Promise<void> {
    // Password-reset OTPs flow through this same message text — never log a
    // live, guessable-in-window credential by default. Set
    // SMS_MOCK_REVEAL_CODE="true" locally when you actually need to read an
    // OTP off the console to test the reset flow by hand.
    const logged =
      process.env.SMS_MOCK_REVEAL_CODE === "true" ? message : message.replace(/\d{4,}/g, "[REDACTED]");
    console.log(`[MockSMS] to=${phoneNumber} :: ${logged}`);
  }
}

// Current decision: reminders/updates go through in-app Notification rows only,
// not SMS (see sendCustomerNotification / reminders.ts — both create a
// Notification unconditionally regardless of which provider this returns).
export class NoopSmsProvider implements SmsProvider {
  async send(): Promise<void> {
    // Intentionally no-op — SMS sending is disabled.
  }
}

// Phase 4 will add real providers (e.g. 019sms/InforU/Twilio). Until then,
// set SMS_PROVIDER="mock" to log outgoing messages instead of just recording
// the in-app Notification; leave unset (default) to send nothing. See
// MockSmsProvider — OTP codes are redacted from the logged line unless
// SMS_MOCK_REVEAL_CODE="true" is also set.
export function getSmsProvider(): SmsProvider {
  return process.env.SMS_PROVIDER === "mock" ? new MockSmsProvider() : new NoopSmsProvider();
}

/**
 * Provider for one-time login codes (customer sign-in, see docs/SMS-LOGIN.md).
 * Deliberately separate from getSmsProvider(): notifications stay in-app/push
 * only by product decision, so switching on a real SMS account for login codes
 * must NOT start texting every cancellation / waitlist broadcast (that costs
 * money per message). SMS_PROVIDER: "019" = real 019sms, "mock" = log only
 * (set SMS_MOCK_REVEAL_CODE="true" to see the code in the server log), unset =
 * nothing is sent (and customer SMS login stays disabled, see loginMode.ts).
 */
export function getOtpSmsProvider(): SmsProvider {
  switch (process.env.SMS_PROVIDER) {
    case "019":
      return new Sms019Provider({
        username: process.env.SMS_019_USERNAME ?? "",
        token: process.env.SMS_019_TOKEN ?? "",
        sender: process.env.SMS_SENDER_ID ?? "",
        endpoint: process.env.SMS_019_ENDPOINT || undefined,
      });
    case "mock":
      return new MockSmsProvider();
    default:
      return new NoopSmsProvider();
  }
}
