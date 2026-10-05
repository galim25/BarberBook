import "server-only";
import { prisma } from "@barberbook/db";

/**
 * phone_number → the barber's own name for it (ContactName). Callers are
 * admin-only loaders that have already checked the session; this is kept out
 * of a "use server" file so it can't be invoked directly from the client.
 */
export async function getContactNameMap(phones: (string | null | undefined)[]): Promise<Map<string, string>> {
  const unique = [...new Set(phones.filter((p): p is string => !!p))];
  if (unique.length === 0) return new Map();
  const rows = await prisma.contactName.findMany({
    where: { phone_number: { in: unique } },
    select: { phone_number: true, display_name: true },
  });
  return new Map(rows.map((r) => [r.phone_number, r.display_name]));
}
