"use server";

import { randomInt } from "crypto";
import { redirect } from "next/navigation";
import { prisma } from "@barberbook/db";
import { getSmsProvider, PASSWORD_RESET_CODE_TTL_MINUTES } from "@barberbook/shared";
import { createSession, destroySession } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { checkRateLimit } from "@/lib/rateLimit";
import { registerUserCore } from "@/lib/actions/registerCore";
import { isSmsLoginEnabled } from "@/lib/loginMode";
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@/lib/validation";

const RATE_LIMIT_WINDOW_MS = 15 * 60_000;
const RATE_LIMIT_MAX_ATTEMPTS = 5;
const TOO_MANY_ATTEMPTS_ERROR = "יותר מדי ניסיונות, נסה/י שוב בעוד כמה דקות";

export type ActionState = { error?: string; success?: boolean };

const SMS_MODE_UNAVAILABLE_ERROR = "האפשרות הזו אינה זמינה — יש להתחבר עם קוד שנשלח ב-SMS";

export async function registerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  // SMS-login mode: an unverified password sign-up would let anyone claim a phone number they don't own.
  if (isSmsLoginEnabled()) return { error: SMS_MODE_UNAVAILABLE_ERROR };
  const parsed = registerSchema.safeParse({
    full_name: formData.get("full_name"),
    phone_number: formData.get("phone_number"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים" };
  }
  const { full_name, phone_number, password } = parsed.data;

  const result = await registerUserCore(full_name, phone_number, password);
  if (result.outcome === "phone_taken") {
    return { error: "מספר הטלפון כבר רשום במערכת" };
  }
  if (result.outcome === "blocked") {
    return { error: "לא ניתן להירשם עם מספר טלפון זה" };
  }

  await createSession({ sub: result.user_id, role: "customer", full_name });
  redirect("/account");
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    phone_number: formData.get("phone_number"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים" };
  }
  const { phone_number, password } = parsed.data;

  if (
    !checkRateLimit(`login:${phone_number}`, {
      maxAttempts: RATE_LIMIT_MAX_ATTEMPTS,
      windowMs: RATE_LIMIT_WINDOW_MS,
    })
  ) {
    return { error: TOO_MANY_ATTEMPTS_ERROR };
  }

  const user = await prisma.user.findUnique({ where: { phone_number } });
  // SMS-login mode: passwords are for the administrator only; customers sign in with a code.
  const passwordLoginAllowed = !isSmsLoginEnabled() || user?.role === "administrator";
  if (!user || !passwordLoginAllowed || !(await verifyPassword(password, user.password_hash))) {
    return { error: "מספר טלפון או סיסמה שגויים" };
  }

  await createSession({ sub: user.id, role: user.role, full_name: user.full_name });
  redirect(user.role === "administrator" ? "/admin" : "/account");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

function generateOtp(): string {
  return String(randomInt(100000, 1000000));
}

export async function forgotPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // SMS-login mode: also stops this from being used to make the server text arbitrary numbers.
  if (isSmsLoginEnabled()) return { error: SMS_MODE_UNAVAILABLE_ERROR };
  const parsed = forgotPasswordSchema.safeParse({ phone_number: formData.get("phone_number") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "מספר טלפון לא תקין" };
  }
  const { phone_number } = parsed.data;

  const user = await prisma.user.findUnique({ where: { phone_number } });
  // Always report success even if the phone isn't registered, to avoid leaking account existence.
  if (user) {
    const code = generateOtp();
    await prisma.passwordResetCode.create({
      data: {
        user_id: user.id,
        code,
        expires_at: new Date(Date.now() + PASSWORD_RESET_CODE_TTL_MINUTES * 60_000),
      },
    });
    await getSmsProvider().send(phone_number, `קוד האימות שלך לאיפוס סיסמה ב-BarberBook: ${code}`);
  }

  return { success: true };
}

export async function resetPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (isSmsLoginEnabled()) return { error: SMS_MODE_UNAVAILABLE_ERROR };
  const parsed = resetPasswordSchema.safeParse({
    phone_number: formData.get("phone_number"),
    code: formData.get("code"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים" };
  }
  const { phone_number, code, password } = parsed.data;

  if (
    !checkRateLimit(`reset:${phone_number}`, {
      maxAttempts: RATE_LIMIT_MAX_ATTEMPTS,
      windowMs: RATE_LIMIT_WINDOW_MS,
    })
  ) {
    return { error: TOO_MANY_ATTEMPTS_ERROR };
  }

  const user = await prisma.user.findUnique({ where: { phone_number } });
  if (!user) {
    return { error: "קוד לא תקין או שפג תוקפו" };
  }

  const resetCode = await prisma.passwordResetCode.findFirst({
    where: { user_id: user.id, code, verified_at: null, expires_at: { gt: new Date() } },
    orderBy: { created_at: "desc" },
  });
  if (!resetCode) {
    return { error: "קוד לא תקין או שפג תוקפו" };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { password_hash: await hashPassword(password) },
    }),
    prisma.passwordResetCode.update({
      where: { id: resetCode.id },
      data: { verified_at: new Date() },
    }),
  ]);

  redirect("/login");
}
