import Link from "next/link";
import { notFound } from "next/navigation";
import { ISRAEL_TIME_ZONE } from "@barberbook/shared";
import { requireAdmin } from "@/lib/auth/session";
import { getWorkDayDetail } from "@/lib/actions/workdays";
import { getAppointmentsForWorkDay } from "@/lib/actions/adminAppointments";
import { buildDayTimeline } from "@/lib/dayTimeline";
import { EditHoursForm } from "./EditHoursForm";
import { CreateManualAppointmentForm } from "./CreateManualAppointmentForm";
import { DeleteWorkDayButton } from "./DeleteWorkDayButton";
import { BlockDayToggle } from "./BlockDayToggle";
import { PageHeader } from "@/components/PageHeader";
import { AdminBrandHero } from "@/components/AdminBrandHero";
import { QuickDayAppointments } from "../../QuickDayAppointments";

function formatHHMM(d: Date) {
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: ISRAEL_TIME_ZONE,
    hour12: false,
  });
}

function formatWorkDate(d: Date) {
  return d.toLocaleDateString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "numeric",
    timeZone: ISRAEL_TIME_ZONE,
  });
}

export default async function AdminDayPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const workDay = await getWorkDayDetail(id);
  if (!workDay) notFound();

  const appointments = await getAppointmentsForWorkDay(id);
  const timeline = buildDayTimeline(
    workDay.starts_at,
    workDay.ends_at,
    workDay.breaks,
    workDay.blocked_times,
    appointments,
  );

  return (
    <main dir="rtl" className="bg-cream mx-auto flex min-h-screen max-w-md flex-col gap-4 p-6">
      <PageHeader title={formatWorkDate(workDay.work_date)} topBanner={<AdminBrandHero />} />
      <div className="flex items-center justify-between">
        <p className="text-slate-muted text-sm">{workDay.barber.full_name}</p>
        <Link href="/admin" className="text-barber-teal text-sm underline">
          חזרה לניהול
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <Link href={`/admin/day/${workDay.id}/print`} className="text-barber-teal text-sm underline">
          הדפסה / שמירה כ-PDF
        </Link>
        <DeleteWorkDayButton workDayId={workDay.id} />
      </div>

      <BlockDayToggle workDayId={workDay.id} initialValue={workDay.is_blocked} />

      <EditHoursForm
        workDayId={workDay.id}
        initialStartsAt={formatHHMM(workDay.starts_at)}
        initialEndsAt={formatHHMM(workDay.ends_at)}
      />

      <CreateManualAppointmentForm workDayId={workDay.id} barberId={workDay.barber_id} />

      <div className="border-barber-teal bg-white flex flex-col gap-3 rounded-xl border p-4">
        <h2 className="text-ink font-bold">לוח היום ({appointments.length} תורים)</h2>
        <QuickDayAppointments
          workDayId={workDay.id}
          barberId={workDay.barber_id}
          timeline={timeline}
          showMoveButton
        />
      </div>

    </main>
  );
}
