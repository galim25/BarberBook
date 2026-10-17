import { z } from "zod";
import { PHONE_NUMBER_REGEX, isIsraeliMobile, normalizeIsraeliPhone } from "@barberbook/shared";

/** Accepts local (050-123-4567) and international (+972 / 972 / 00972) forms; the output is always local (0501234567). */
export const phoneSchema = z
  .string()
  .trim()
  .transform((s) => normalizeIsraeliPhone(s) ?? s)
  .pipe(z.string().regex(PHONE_NUMBER_REGEX, "מספר טלפון לא תקין"));

export const MOBILE_ONLY_ERROR = "יש להזין מספר נייד שמקבל SMS";

/** For customer sign-in/sign-up, where a code is texted to the number: local forms only mobiles pass. */
export const mobilePhoneSchema = phoneSchema.refine(isIsraeliMobile, MOBILE_ONLY_ERROR);

export const passwordSchema = z.string().min(6, "הסיסמה חייבת להכיל לפחות 6 תווים");

export const registerSchema = z.object({
  full_name: z.string().trim().min(2, "יש להזין שם מלא"),
  phone_number: mobilePhoneSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  phone_number: phoneSchema,
  password: z.string().min(1, "יש להזין סיסמה"),
});

export const forgotPasswordSchema = z.object({
  phone_number: phoneSchema,
});

export const resetPasswordSchema = z.object({
  phone_number: phoneSchema,
  code: z.string().length(6, "קוד האימות חייב להכיל 6 ספרות"),
  password: passwordSchema,
});
