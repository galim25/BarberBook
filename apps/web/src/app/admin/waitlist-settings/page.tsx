import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { getWaitlistPeriods } from "@/lib/actions/waitlistSettings";
import { WaitlistPeriodsForm } from "./WaitlistPeriodsForm";
import { PageHeader } from "@/components/PageHeader";
import { AdminBrandHero } from "@/components/AdminBrandHero";

export default async function WaitlistSettingsPage() {
  await requireAdmin();
  const periods = await getWaitlistPeriods();

  return (
    <main dir="rtl" className="bg-cream mx-auto flex min-h-screen max-w-md flex-col gap-4 p-6">
      <PageHeader title="ניהול רשימת המתנה" topBanner={<AdminBrandHero />} />
      <div className="flex justify-end">
        <Link href="/admin" className="text-barber-teal text-sm underline">
          חזרה לניהול
        </Link>
      </div>
      <WaitlistPeriodsForm initial={periods} />
    </main>
  );
}
