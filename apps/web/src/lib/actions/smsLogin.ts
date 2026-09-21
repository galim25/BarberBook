"use server";

import { randomBytes } from "crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@barberbook/db";
import { getOtpSmsProvider } from "@barberbook/shared";
import { createSession } from "@/lib/auth/session";
import { signPhoneProof, verifyPhoneProof } from "@/lib/auth/jwt";
import { checkRateLimit } from "@/lib/rateLimit";
import { isSmsLoginEnabled } from "@/lib/loginMode";
import { checkLoginCode, issueLoginCode } from "@/lib/smsLoginCore";
import { registerUserCore } from "@/lib/actions/registerCore";
import { phoneSchema } from "@/lib/validation";

/**
 * Customer sign-in with a one-time SMS code (docs/SMS-LOGIN.md) — one action for
 * the three steps of the login form, dispatched on the hidden/submitter `step`
 * field: "send" (phone → text a code), "verify" (code → session, or ask for a
 * name if the number is new), "signup" (name + proof → create customer + session).
 *
 * Administrators never use this path (they sign in with a password at
 * /login/admin): for an admin's number "send" pretends success without sending
 * anything and no code can ever exist, so this can't be used to probe or attack
 * the admin account.
 */
export type SmsLoginState = {
  step: "phone" | "code" | "name";
  phone_number?: string;
  /** Signed proof that the phone was just verified — only on the "name" step. */
  proof?: string;
  error?: string;
};

const MINUTE = 60_000;
const TOO_MANY = "יותר מדי ניסיונות, נסה/י שוב בעוד כמה דקות";
const SEND_FAILED = "לא ניתן לשלוח קוד כרגע, נסה/י שוב בעוד מספר דקות";
const BLOCKED = "לא ניתן להתחבר עם מספר טלפון זה";
const WRONG_OR_EXPIRED = "הקוד שגוי או שפג תוקפו";

// In-memory limiters (see rateLimit.ts for the single-instance caveat). The global
// cap is the cost guard against SMS-pumping: a bot can't make the server text
// unlimited numbers even if it rotates IPs and phone numbers.
const SEND_PER_PHONE = { maxAttempts: 3, windowMs: 15 * MINUTE };
const SEND_PER_IP = { maxAttempts: 10, windowMs: 60 * MINUTE };
const SEND_GLOBAL = { maxAttempts: 100, windowMs: 60 * MINUTE };
const VERIFY_PER_PHONE = { maxAttempts: 10, windowMs: 15 * MINUTE };

async function clientIp(): Promise<string> {
  const forwarded = (await headers()).get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

async function isBlocked(phone_number: string): Promise<boolean> {
  return (await prisma.blockedPhoneNumber.findUnique({ where: { phone_number } })) !== null;
}

export async function smsLoginAction(_prev: SmsLoginState, formData: FormData): Promise<SmsLoginState> {
  if (!isSmsLoginEnabled()) return { step: "phone", error: "כניסה עם קוד אינה זמינה כרגע" };

  switch (formData.get("step")) {
    case "send":
      return sendCode(formData);
    case "verify":
      return verifyCode(formData);
    case "signup":
      return completeSignup(formData);
    default:
      return { step: "phone" };
  }
}

async function sendCode(formData: FormData): Promise<SmsLoginState> {
  const parsed = phoneSchema.safeParse(formData.get("phone_number"));
  if (!parsed.success) return { step: "phone", error: "מספר טלפון לא תקין" };
  const phone_number = parsed.data;

  const ip = await clientIp();
  if (
    !checkRateLimit(`sms-login:send:phone:${phone_number}`, SEND_PER_PHONE) ||
    !checkRateLimit(`sms-login:send:ip:${ip}`, SEND_PER_IP) ||
    !checkRateLimit("sms-login:send:global", SEND_GLOBAL)
  ) {
    return { step: "phone", phone_number, error: TOO_MANY };
  }

  if (await isBlocked(phone_number)) return { step: "phone", phone_number, error: BLOCKED };

  const existing = await prisma.user.findUnique({ where: { phone_number }, select: { role: true } });
  if (existing?.role === "administrator") return { step: "code", phone_number };

  const code = await issueLoginCode(phone_number);
  try {
    await getOtpSmsProvider().send(phone_number, `קוד הכניסה שלך ל-BarberBook: ${code}`);
  } catch (err) {
    // Message/phone deliberately not logged — the message contains the code.
    console.error("[sms-login] failed to send code:", (err as Error).message);
    return { step: "phone", phone_number, error: SEND_FAILED };
  }
  return { step: "code", phone_number };
}

async function verifyCode(formData: FormData): Promise<SmsLoginState> {
  const parsedPhone = phoneSchema.safeParse(formData.get("phone_number"));
  const code = String(formData.get("code") ?? "").trim();
  if (!parsedPhone.success) return { step: "phone", error: "מספר טלפון לא תקין" };
  const phone_number = parsedPhone.data;
  if (!/^\d{6}$/.test(code)) return { step: "code", phone_number, error: "יש להזין את הקוד בן 6 הספרות" };

  if (!checkRateLimit(`sms-login:verify:phone:${phone_number}`, VERIFY_PER_PHONE)) {
    return { step: "code", phone_number, error: TOO_MANY };
  }
  if (await isBlocked(phone_number)) return { step: "phone", phone_number, error: BLOCKED };

  const result = await checkLoginCode(phone_number, code);
  if (result !== "ok") {
    return { step: "code", phone_number, error: result === "too_many_attempts" ? TOO_MANY : WRONG_OR_EXPIRED };
  }

  const user = await prisma.user.findUnique({ where: { phone_number } });
  if (user) {
    // A code can never be issued for an administrator's number; refuse anyway as defence in depth.
    if (user.role !== "customer") return { step: "code", phone_number, error: WRONG_OR_EXPIRED };
    await createSession({ sub: user.id, role: "customer", full_name: user.full_name });
    redirect("/account");
  }

  // Brand-new customer: number is proven, now ask for a name (the proof carries the number to the next step).
  return { step: "name", phone_number, proof: await signPhoneProof(phone_number) };
}

const signupSchema = z.object({
  full_name: z.string().trim().min(2, "יש להזין שם מלא").max(60, "השם ארוך מדי"),
});

async function completeSignup(formData: FormData): Promise<SmsLoginState> {
  const proof = String(formData.get("proof") ?? "");
  const phone_number = await verifyPhoneProof(proof);
  if (!phone_number) return { step: "phone", error: "פג תוקף האימות, יש להתחיל מחדש" };

  const parsedName = signupSchema.safeParse({ full_name: formData.get("full_name") });
  if (!parsedName.success) {
    return { step: "name", phone_number, proof, error: parsedName.error.issues[0]?.message ?? "שם לא תקין" };
  }
  const { full_name } = parsedName.data;

  // No real password exists for these accounts — same "random, never-shown password" the phone line (IVR) uses.
  const result = await registerUserCore(full_name, phone_number, randomBytes(24).toString("base64url"));
  if (result.outcome === "blocked") return { step: "phone", phone_number, error: BLOCKED };

  const user = await prisma.user.findUnique({ where: { phone_number } });
  // phone_taken here just means the account appeared between the two steps (e.g. a double submit) — log into it.
  if (!user || user.role !== "customer") return { step: "phone", error: WRONG_OR_EXPIRED };
  await createSession({ sub: user.id, role: "customer", full_name: user.full_name });
  redirect("/account");
}
