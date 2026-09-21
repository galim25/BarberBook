import { prisma } from "@barberbook/db";
import { hashPassword } from "@/lib/auth/password";
import { notifyAdminsOfNewCustomer } from "@/lib/notifyAdmin";

export type RegisterCoreResult =
  | { outcome: "created"; user_id: string }
  | { outcome: "phone_taken" }
  | { outcome: "blocked" };

/**
 * Shared by the app's registerAction (auth.ts) and the phone IVR's new-caller
 * registration (ivr/identifyCaller.ts) — the one place that checks
 * BlockedPhoneNumber/existing-user and creates a customer User, so the two
 * entry points can't drift on that logic. Not "use server": the IVR route
 * has no form/session to hand a server action, and this returns a typed
 * outcome instead of the app's ActionState so each caller can render/speak
 * its own message.
 */
export async function registerUserCore(
  full_name: string,
  phone_number: string,
  password: string,
): Promise<RegisterCoreResult> {
  const existing = await prisma.user.findUnique({ where: { phone_number } });
  if (existing) return { outcome: "phone_taken" };

  const blocked = await prisma.blockedPhoneNumber.findUnique({ where: { phone_number } });
  if (blocked) return { outcome: "blocked" };

  const user = await prisma.user.create({
    data: {
      full_name,
      phone_number,
      password_hash: await hashPassword(password),
      role: "customer",
    },
  });

  // The account already exists — a failure to tell the barber must not turn a successful sign-up into an error.
  await notifyAdminsOfNewCustomer({ customer_name: full_name }).catch((err) =>
    console.error("[notify] failed to notify admins of new customer:", err),
  );

  return { outcome: "created", user_id: user.id };
}
