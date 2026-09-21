import type { SmsProvider } from "./sms";

/**
 * 019sms (https://019sms.co.il) HTTP adapter — written from the public docs
 * (docs.019sms.co.il/sms/send-sms.html) and NOT yet run against a real account.
 * The docs page does not spell out how the API token is passed; this sends
 * `Authorization: Bearer <token>` — verify that against the account's own
 * documentation/first test and adjust `headers` below if it differs.
 * Point SMS_019_ENDPOINT at https://019sms.co.il/api/test for a dry run
 * (documented as the testing endpoint) before pointing it at production.
 *
 * Never logs the phone number or the message: the message carries a login code.
 */
export type Sms019Config = {
  username: string;
  token: string;
  /** Sender shown to the recipient: max 11 chars, digits and English letters only (019sms rule). */
  sender: string;
  endpoint?: string;
};

export const SMS_019_DEFAULT_ENDPOINT = "https://019sms.co.il/api";

/** Local Israeli format (0501234567) → the format 019sms documents for destinations (501234567). */
export function to019Phone(localPhone: string): string {
  return localPhone.replace(/^0/, "");
}

export function build019Payload(config: Pick<Sms019Config, "username" | "sender">, localPhone: string, message: string) {
  return {
    sms: {
      user: { username: config.username },
      source: config.sender,
      destinations: { phone: [{ $: { id: "1" }, _: to019Phone(localPhone) }] },
      message,
    },
  };
}

export class Sms019Provider implements SmsProvider {
  constructor(private readonly config: Sms019Config) {}

  async send(phoneNumber: string, message: string): Promise<void> {
    const { username, token, sender, endpoint } = this.config;
    if (!username || !token || !sender) {
      throw new Error("019sms is not configured (SMS_019_USERNAME / SMS_019_TOKEN / SMS_SENDER_ID)");
    }
    const response = await fetch(endpoint ?? SMS_019_DEFAULT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(build019Payload({ username, sender }, phoneNumber, message)),
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await response.json().catch(() => null)) as { status?: number; message?: string } | null;
    if (!response.ok || !body || body.status !== 0) {
      throw new Error(`019sms rejected the message (HTTP ${response.status}, status ${body?.status ?? "?"}: ${body?.message ?? "no body"})`);
    }
  }
}
