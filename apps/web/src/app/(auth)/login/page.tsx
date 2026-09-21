import Link from "next/link";
import { Heebo } from "next/font/google";
import { BrandHero } from "@/components/BrandHero";
import { BsdBar } from "@/components/BsdBar";
import { isSmsLoginEnabled } from "@/lib/loginMode";
import { PasswordLoginForm } from "./PasswordLoginForm";
import { SmsLoginForm } from "./SmsLoginForm";

// The form shown depends on CUSTOMER_LOGIN_MODE, which must be read per request, not baked in at build time.
export const dynamic = "force-dynamic";

// Maven Pro (מבוקש בפיגמה) אין לו glyphs בעברית — Heebo נבחר כתחליף הכי קרוב לו
// ויזואלית מתוך Google Fonts שכן תומך בעברית. מוגבל לדפי ההתחברות בכוונה (2026-07-24).
const heebo = Heebo({ subsets: ["hebrew", "latin"], weight: ["400", "500", "600", "700"] });

export default function LoginPage() {
  const smsMode = isSmsLoginEnabled();

  return (
    <main
      dir="rtl"
      className={`${heebo.className} bg-cream mx-auto flex min-h-screen max-w-sm flex-col p-6`}
    >
      <BsdBar />
      <BrandHero />
      <h1 className="text-barber-teal mt-6 mb-12 text-center text-[40px] font-semibold">התחברות</h1>
      {smsMode ? <SmsLoginForm /> : <PasswordLoginForm showForgotPassword />}
      {smsMode ? (
        <p className="text-slate-muted mt-10 text-center text-xs">
          <Link href="/login/admin" className="underline">
            כניסת מנהל
          </Link>
        </p>
      ) : (
        <p className="text-slate-muted mt-6 text-center text-sm">
          אין לך חשבון?{" "}
          <Link href="/register" className="text-barber-teal font-medium">
            הרשמה.
          </Link>
        </p>
      )}
    </main>
  );
}
