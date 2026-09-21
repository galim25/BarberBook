"use client";

import { useActionState } from "react";
import { smsLoginAction, type SmsLoginState } from "@/lib/actions/smsLogin";
import { LockIcon, PhoneIcon, UserIcon } from "@/components/AuthIcons";

const initialState: SmsLoginState = { step: "phone" };

const inputClass = "text-ink placeholder-slate-muted w-full bg-transparent outline-none";
const fieldClass =
  "border-barber-teal focus-within:ring-barber-teal flex h-[55px] items-center gap-2 rounded-xl border bg-white px-4 focus-within:ring-2";
const primaryButtonClass =
  "bg-barber-teal text-cream-text mt-[35px] h-[55px] rounded-xl text-xl font-semibold tracking-wide disabled:opacity-50";

/**
 * Customer sign-in without a password (docs/SMS-LOGIN.md): phone → 6-digit SMS code →
 * (new numbers only) name. One server action drives all three steps; the button that
 * submits the form carries the step it means (name="step" value="…").
 */
export function SmsLoginForm() {
  const [state, formAction, pending] = useActionState(smsLoginAction, initialState);

  return (
    <form action={formAction} className="flex flex-col">
      {state.step === "phone" && (
        <>
          <p className="text-slate-muted mb-4 text-center text-sm">נשלח אלייך קוד כניסה ב-SMS</p>
          <label className={fieldClass}>
            <PhoneIcon />
            <input
              name="phone_number"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              defaultValue={state.phone_number ?? ""}
              placeholder="מספר טלפון"
              required
              className={inputClass}
            />
          </label>
          <SubmitError error={state.error} />
          <button type="submit" name="step" value="send" disabled={pending} className={primaryButtonClass}>
            {pending ? "שולח..." : "שלחו לי קוד"}
          </button>
        </>
      )}

      {state.step === "code" && (
        <>
          <p className="text-slate-muted mb-4 text-center text-sm">
            אם המספר <span dir="ltr">{state.phone_number}</span> תקין, נשלח אליו קוד בן 6 ספרות
          </p>
          <input type="hidden" name="phone_number" value={state.phone_number ?? ""} />
          <label className={fieldClass}>
            <LockIcon />
            <input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="קוד בן 6 ספרות"
              required
              autoFocus
              className={inputClass}
            />
          </label>
          <SubmitError error={state.error} />
          <button type="submit" name="step" value="verify" disabled={pending} className={primaryButtonClass}>
            {pending ? "מאמת..." : "כניסה"}
          </button>
          <button
            type="submit"
            name="step"
            value="send"
            formNoValidate
            disabled={pending}
            className="text-barber-teal mt-4 text-sm font-semibold disabled:opacity-50"
          >
            לא קיבלתי — שלחו שוב
          </button>
        </>
      )}

      {state.step === "name" && (
        <>
          <p className="text-slate-muted mb-4 text-center text-sm">נעים להכיר! איך קוראים לך?</p>
          <input type="hidden" name="proof" value={state.proof ?? ""} />
          <label className={fieldClass}>
            <UserIcon />
            <input
              name="full_name"
              autoComplete="name"
              placeholder="שם מלא"
              required
              autoFocus
              className={inputClass}
            />
          </label>
          <SubmitError error={state.error} />
          <button type="submit" name="step" value="signup" disabled={pending} className={primaryButtonClass}>
            {pending ? "נכנס..." : "המשך"}
          </button>
        </>
      )}
    </form>
  );
}

function SubmitError({ error }: { error?: string }) {
  return error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null;
}
