import { bookAppointmentCore, type BookedAppointment } from "@/lib/actions/bookingCore";
import { notifyAdminsOfNewBooking, notifyAdminsOfBookingRequest } from "@/lib/notifyAdmin";
import { getRequiresApproval } from "@/lib/actions/settings";

export type PhoneBookingResult =
  | { outcome: "booked"; pendingApproval: boolean; booked: BookedAppointment }
  | { outcome: "slot_taken" }
  | { outcome: "error" };

/**
 * IVR-side wrapper around the shared bookAppointmentCore (§6 of
 * docs/# IVR BarberBook.txt) — same requires_approval behavior as the app
 * (decision #10), same admin notification on success. DAY_BLOCKED/
 * SERVICE_NOT_OFFERED/PAST_SLOT/ATTENDEE_NAME_REQUIRED shouldn't happen here
 * since the IVR only ever offers a slot it just computed itself as valid,
 * but flow.ts treats any of them as "error" — a generic safety-net message,
 * per §7 step 7's fallback.
 */
export async function bookViaPhone(
  input: { work_day_id: string; service_id: string; starts_at: string; attendee_name?: string },
  actor: { user_id: string; customer_name: string },
): Promise<PhoneBookingResult> {
  const requiresApproval = await getRequiresApproval();
  try {
    const booked = await bookAppointmentCore(input, actor, requiresApproval, true);
    if (requiresApproval) {
      await notifyAdminsOfBookingRequest(booked);
    } else {
      await notifyAdminsOfNewBooking(booked);
    }
    return { outcome: "booked", pendingApproval: requiresApproval, booked };
  } catch (err) {
    if (err instanceof Error && err.message === "SLOT_TAKEN") {
      return { outcome: "slot_taken" };
    }
    return { outcome: "error" };
  }
}
