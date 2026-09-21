import Link from "next/link";
import { ISRAEL_TIME_ZONE } from "@barberbook/shared";
import { getSession } from "@/lib/auth/session";
import { logoutAction } from "@/lib/actions/auth";
import { getAnnouncements } from "@/lib/actions/announcements";
import { isOnWaitlist } from "@/lib/actions/waitlist";
import { LeaveWaitlistButton } from "./LeaveWaitlistButton";
import { BrandHero } from "@/components/BrandHero";
import { BsdBar } from "@/components/BsdBar";
import { PushNotificationToggle } from "@/components/PushNotificationToggle";

function formatDate(d: Date) {
  return d.toLocaleDateString("he-IL", { day: "numeric", month: "numeric", timeZone: ISRAEL_TIME_ZONE });
}

export default async function AccountPage() {
  const session = await getSession();
  const announcements = await getAnnouncements();
  const onWaitlist = await isOnWaitlist();

  return (
    <main dir="rtl" className="bg-cream mx-auto flex min-h-screen max-w-md flex-col p-6">
      <BsdBar />
      <BrandHero />
      <h1 className="text-barber-teal mt-6 mb-8 text-center text-3xl font-bold">היי {session?.full_name}</h1>

      <nav className="flex flex-col items-center gap-4 py-4">
        <Link
          href="/account/book"
          className="bg-barber-teal text-cream-text w-full rounded-full py-3 text-center text-xl font-bold"
        >
          קביעת תור
        </Link>
        <Link
          href="/account/appointments"
          className="bg-barber-teal text-cream-text w-full rounded-full py-3 text-center text-xl font-bold"
        >
          התורים שלי
        </Link>
      </nav>

      <PushNotificationToggle audience="customer" />

      {onWaitlist && (
        <div className="border-barber-teal mt-4 flex items-center justify-between rounded-xl border bg-white p-4">
          <p className="text-ink text-sm">את/ה ברשימת ההמתנה לתור פנוי</p>
          <LeaveWaitlistButton />
        </div>
      )}

      {announcements.length > 0 && (
        <div className="mt-6 flex flex-col gap-3">
          <h2 className="text-barber-teal font-bold">הודעות חשובות</h2>
          <ul className="flex flex-col gap-3">
            {announcements.map((a) => (
              <li key={a.id} className="from-barber-teal to-cream rounded-xl bg-gradient-to-bl p-4">
                <p className="text-ink font-bold">{a.title}</p>
                <p className="text-ink/80 mt-1 whitespace-pre-wrap text-sm">{a.content}</p>
                <p className="text-ink/60 mt-1 text-xs">{formatDate(a.published_at)}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <form action={logoutAction} className="mt-8 flex justify-center">
        <button
          type="submit"
          className="border-barber-teal text-barber-teal rounded-full border px-8 py-3 font-bold"
        >
          התנתקות
        </button>
      </form>

    </main>
  );
}
