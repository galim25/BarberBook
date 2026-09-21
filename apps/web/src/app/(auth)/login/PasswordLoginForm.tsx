"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction, type ActionState } from "@/lib/actions/auth";
import { LockIcon, PhoneIcon } from "@/components/AuthIcons";

const initialState: ActionState = {};

/** Phone + password form: the original customer login, and (in SMS-login mode) the administrator-only login at /login/admin. */
export function PasswordLoginForm({ showForgotPassword }: { showForgotPassword: boolean }) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="flex flex-col">
      <label className="border-barber-teal focus-within:ring-barber-teal flex h-[55px] items-center gap-2 rounded-xl border bg-white px-4 focus-within:ring-2">
        <PhoneIcon />
        <input
          name="phone_number"
          placeholder="מספר טלפון"
          required
          className="text-ink placeholder-slate-muted w-full bg-transparent outline-none"
        />
      </label>
      <label className="border-barber-teal focus-within:ring-barber-teal mt-[35px] flex h-[55px] items-center gap-2 rounded-xl border bg-white px-4 focus-within:ring-2">
        <LockIcon />
        <input
          name="password"
          type="password"
          placeholder="סיסמה"
          required
          className="text-ink placeholder-slate-muted w-full bg-transparent outline-none"
        />
      </label>
      {showForgotPassword && (
        <Link href="/forgot-password" className="text-barber-teal mt-[10px] self-start text-sm font-semibold">
          שכחתי סיסמה?
        </Link>
      )}
      {state.error && <p className="mt-2 text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="bg-barber-teal text-cream-text mt-[35px] h-[55px] rounded-xl text-xl font-semibold tracking-wide uppercase disabled:opacity-50"
      >
        {pending ? "מתחבר..." : "התחברות"}
      </button>
    </form>
  );
}
