import { prisma } from "@barberbook/db";

/** Deletes SMS login codes (docs/SMS-LOGIN.md) that expired more than a day ago — they are useless the moment they expire, this just stops the table growing forever. */
export async function purgeExpiredLoginCodes(): Promise<void> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60_000);
  const { count } = await prisma.loginCode.deleteMany({ where: { expires_at: { lt: cutoff } } });
  if (count > 0) console.log(`[worker] purged ${count} expired login codes`);
}
