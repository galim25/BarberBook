import Link from "next/link";
import { Heebo } from "next/font/google";
import { BrandHero } from "@/components/BrandHero";
import { BsdBar } from "@/components/BsdBar";
import { PasswordLoginForm } from "../PasswordLoginForm";

const heebo = Heebo({ subsets: ["hebrew", "latin"], weight: ["400", "500", "600", "700"] });

/** Administrator sign-in (phone + password). Always available; in SMS-login mode it is the only place a password is accepted. */
export default function AdminLoginPage() {
  return (
    <main
      dir="rtl"
      className={`${heebo.className} bg-cream mx-auto flex min-h-screen max-w-sm flex-col p-6`}
    >
      <BsdBar />
      <BrandHero />
      <h1 className="text-barber-teal mt-6 mb-12 text-center text-[40px] font-semibold">כניסת מנהל</h1>
      <PasswordLoginForm showForgotPassword={false} />
      <p className="text-slate-muted mt-10 text-center text-xs">
        <Link href="/login" className="underline">
          כניסת לקוחות
        </Link>
      </p>
    </main>
  );
}
