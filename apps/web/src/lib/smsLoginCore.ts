import { createHmac, randomInt, timingSafeEqual } from "crypto";
import { prisma } from "@barberbook/db";
import { LOGIN_CODE_MAX_ATTEMPTS, LOGIN_CODE_TTL_MINUTES } from "@barberbook/shared";

/**
 * Storage/verification of one-time SMS login codes (docs/SMS-LOGIN.md). Not a
 * "use server" file: these must never be callable straight from the browser —
 * only the rate-limited action in actions/smsLogin.ts uses them.
 */

export function generateLoginCode(): string {
  return String(randomInt(100000, 1000000));
}

/** HMAC (keyed with SESSION_SECRET) so a leaked table can't be brute-forced offline as easily as a bare hash of 6 digits. */
export function hashLoginCode(phone_number: string, code: string, secret = process.env.SESSION_SECRET): string {
  if (!secret) throw new Error("SESSION_SECRET is missing");
  return createHmac("sha256", secret).update(`${phone_number}:${code}`).digest("hex");
}

export function hashesMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

/** Invalidates any earlier unused code for this number (only the newest works), stores the new one and returns it in the clear so it can be texted. */
export async function issueLoginCode(phone_number: string): Promise<string> {
  await prisma.loginCode.updateMany({
    where: { phone_number, consumed_at: null },
    data: { consumed_at: new Date() },
  });
  const code = generateLoginCode();
  await prisma.loginCode.create({
    data: {
      phone_number,
      code_hash: hashLoginCode(phone_number, code),
      expires_at: new Date(Date.now() + LOGIN_CODE_TTL_MINUTES * 60_000),
    },
  });
  return code;
}

export type LoginCodeCheck = "ok" | "wrong_code" | "no_code" | "too_many_attempts";

/** Single-use: a correct code is consumed atomically; wrong guesses count against the code and burn it after LOGIN_CODE_MAX_ATTEMPTS. */
export async function checkLoginCode(phone_number: string, code: string): Promise<LoginCodeCheck> {
  const row = await prisma.loginCode.findFirst({
    where: { phone_number, consumed_at: null, expires_at: { gt: new Date() } },
    orderBy: { created_at: "desc" },
  });
  if (!row) return "no_code";
  if (row.attempts >= LOGIN_CODE_MAX_ATTEMPTS) return "too_many_attempts";

  if (!hashesMatch(row.code_hash, hashLoginCode(phone_number, code))) {
    await prisma.loginCode.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
    return "wrong_code";
  }

  const consumed = await prisma.loginCode.updateMany({
    where: { id: row.id, consumed_at: null },
    data: { consumed_at: new Date() },
  });
  return consumed.count === 1 ? "ok" : "no_code";
}
