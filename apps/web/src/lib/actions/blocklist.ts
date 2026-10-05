"use server";

import { revalidatePath } from "next/cache";
import { prisma, Prisma } from "@barberbook/db";
import { PHONE_NUMBER_REGEX } from "@barberbook/shared";
import { getSession } from "@/lib/auth/session";
import { getContactNameMap } from "@/lib/contactNames";

export type BlockedPhoneNumberView = {
  id: string;
  phone_number: string;
  reason: string | null;
  created_at: Date;
  /** Name of the customer account with this number, if any — a blocked number may never have registered. */
  registered_name: string | null;
  contact_name: string | null;
};
export type BlocklistResult = { error?: string; success?: boolean };

async function requireAdminSession() {
  const session = await getSession();
  if (!session || session.role !== "administrator") return null;
  return session;
}

export async function getBlockedPhoneNumbers(): Promise<BlockedPhoneNumberView[]> {
  if (!(await requireAdminSession())) return [];
  const blocked = await prisma.blockedPhoneNumber.findMany({
    orderBy: { created_at: "desc" },
    select: { id: true, phone_number: true, reason: true, created_at: true },
  });
  const phones = blocked.map((b) => b.phone_number);
  const [users, contactNames] = await Promise.all([
    prisma.user.findMany({ where: { phone_number: { in: phones } }, select: { phone_number: true, full_name: true } }),
    getContactNameMap(phones),
  ]);
  const registered = new Map(users.map((u) => [u.phone_number, u.full_name]));
  return blocked.map((b) => ({
    ...b,
    registered_name: registered.get(b.phone_number) ?? null,
    contact_name: contactNames.get(b.phone_number) ?? null,
  }));
}

export async function blockPhoneNumberAction(input: {
  phone_number: string;
  reason?: string;
}): Promise<BlocklistResult> {
  const session = await requireAdminSession();
  if (!session) return { error: "אין הרשאה" };

  const phone_number = input.phone_number.trim();
  if (!PHONE_NUMBER_REGEX.test(phone_number)) {
    return { error: "מספר טלפון לא תקין" };
  }

  try {
    await prisma.blockedPhoneNumber.create({
      data: {
        phone_number,
        reason: input.reason?.trim() || null,
        blocked_by_user_id: session.sub,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { error: "מספר זה כבר חסום" };
    }
    return { error: "לא ניתן היה לחסום את המספר, נסה/י שוב" };
  }

  revalidatePath("/admin/blocked-customers");
  return { success: true };
}

export async function unblockPhoneNumberAction(id: string): Promise<BlocklistResult> {
  if (!(await requireAdminSession())) return { error: "אין הרשאה" };

  try {
    await prisma.blockedPhoneNumber.delete({ where: { id } });
  } catch (err) {
    // P2025 = record already gone — deleting an already-removed row is a safe no-op.
    // Anything else (e.g. a transient DB error) must not be reported as success.
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025")) {
      return { error: "לא ניתן היה להסיר את החסימה, נסה/י שוב" };
    }
  }

  revalidatePath("/admin/blocked-customers");
  return { success: true };
}
