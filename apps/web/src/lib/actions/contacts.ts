"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@barberbook/db";
import { PHONE_NUMBER_REGEX } from "@barberbook/shared";
import { getSession } from "@/lib/auth/session";

export type ContactEntry = { phone_number: string; name: string };
export type ContactsResult = { error?: string; saved?: number };

const MAX_NAME_LENGTH = 80;
const MAX_ENTRIES = 5000;

async function requireAdminSession() {
  const session = await getSession();
  if (!session || session.role !== "administrator") return null;
  return session;
}

function cleanEntries(entries: ContactEntry[]): ContactEntry[] {
  const byPhone = new Map<string, string>();
  for (const e of entries.slice(0, MAX_ENTRIES)) {
    const name = e.name?.trim().slice(0, MAX_NAME_LENGTH);
    if (name && PHONE_NUMBER_REGEX.test(e.phone_number)) byPhone.set(e.phone_number, name);
  }
  return [...byPhone].map(([phone_number, name]) => ({ phone_number, name }));
}

function revalidateAdmin() {
  revalidatePath("/admin", "layout");
}

export type CustomerContactRow = {
  phone_number: string;
  registered_name: string | null;
  contact_name: string | null;
  source: string | null;
};

/** Every customer + every number the barber has a name for — the /admin/contacts list. */
export async function getCustomerContacts(): Promise<CustomerContactRow[]> {
  if (!(await requireAdminSession())) return [];
  const [users, names] = await Promise.all([
    prisma.user.findMany({ where: { role: "customer" }, select: { phone_number: true, full_name: true } }),
    prisma.contactName.findMany(),
  ]);
  const rows = new Map<string, CustomerContactRow>();
  for (const u of users) {
    rows.set(u.phone_number, { phone_number: u.phone_number, registered_name: u.full_name, contact_name: null, source: null });
  }
  for (const n of names) {
    const row = rows.get(n.phone_number) ?? { phone_number: n.phone_number, registered_name: null, contact_name: null, source: null };
    rows.set(n.phone_number, { ...row, contact_name: n.display_name, source: n.source });
  }
  return [...rows.values()].sort((a, b) =>
    (a.contact_name ?? a.registered_name ?? "").localeCompare(b.contact_name ?? b.registered_name ?? "", "he"),
  );
}

/**
 * Numbers a .vcf import is matched against. The import page filters the
 * parsed file against this list in the browser, so only contacts who are
 * already customers (or blocked numbers) ever reach the server.
 */
export async function getKnownCustomerPhones(): Promise<string[]> {
  if (!(await requireAdminSession())) return [];
  const [users, blocked] = await Promise.all([
    prisma.user.findMany({ where: { role: "customer" }, select: { phone_number: true } }),
    prisma.blockedPhoneNumber.findMany({ select: { phone_number: true } }),
  ]);
  return [...new Set([...users, ...blocked].map((r) => r.phone_number))];
}

/** .vcf import: only known numbers are kept, and a name set by hand in the app is never overwritten. */
export async function importContactNamesAction(entries: ContactEntry[]): Promise<ContactsResult> {
  if (!(await requireAdminSession())) return { error: "אין הרשאה" };
  const known = new Set(await getKnownCustomerPhones());
  const clean = cleanEntries(entries).filter((e) => known.has(e.phone_number));
  const manual = new Set(
    (
      await prisma.contactName.findMany({
        where: { phone_number: { in: clean.map((e) => e.phone_number) }, source: "manual" },
        select: { phone_number: true },
      })
    ).map((r) => r.phone_number),
  );
  const toSave = clean.filter((e) => !manual.has(e.phone_number));
  await prisma.$transaction(
    toSave.map((e) =>
      prisma.contactName.upsert({
        where: { phone_number: e.phone_number },
        create: { phone_number: e.phone_number, display_name: e.name, source: "import" },
        update: { display_name: e.name, source: "import" },
      }),
    ),
  );
  revalidateAdmin();
  return { saved: toSave.length };
}

/**
 * Android Contact Picker: the barber chose these contacts one by one, so they're
 * saved even if the number isn't a customer yet (it will match once they book),
 * and they replace whatever name was there.
 */
export async function savePickedContactsAction(entries: ContactEntry[]): Promise<ContactsResult> {
  if (!(await requireAdminSession())) return { error: "אין הרשאה" };
  const clean = cleanEntries(entries);
  await prisma.$transaction(
    clean.map((e) =>
      prisma.contactName.upsert({
        where: { phone_number: e.phone_number },
        create: { phone_number: e.phone_number, display_name: e.name, source: "picker" },
        update: { display_name: e.name, source: "picker" },
      }),
    ),
  );
  revalidateAdmin();
  return { saved: clean.length };
}

/** Manual edit from any admin screen. An empty name removes it, back to the registered name. */
export async function setContactNameAction(input: ContactEntry): Promise<ContactsResult> {
  if (!(await requireAdminSession())) return { error: "אין הרשאה" };
  if (!PHONE_NUMBER_REGEX.test(input.phone_number)) return { error: "מספר טלפון לא תקין" };
  const name = input.name.trim().slice(0, MAX_NAME_LENGTH);
  if (!name) {
    await prisma.contactName.deleteMany({ where: { phone_number: input.phone_number } });
  } else {
    await prisma.contactName.upsert({
      where: { phone_number: input.phone_number },
      create: { phone_number: input.phone_number, display_name: name, source: "manual" },
      update: { display_name: name, source: "manual" },
    });
  }
  revalidateAdmin();
  return { saved: name ? 1 : 0 };
}
