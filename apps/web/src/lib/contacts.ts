import { PHONE_NUMBER_REGEX } from "@barberbook/shared";

export type ParsedContact = { name: string; phone_number: string };

/**
 * Turns a phone number as it appears in a phone's contacts ("+972 50-123-4567",
 * "050 1234567", "00972501234567", "(050) 123 4567") into the local format every
 * phone_number in the DB uses (0501234567, see PHONE_NUMBER_REGEX). Returns null
 * for anything that isn't an Israeli number — those can't match a customer.
 */
export function normalizeIsraeliPhone(raw: string): string | null {
  let digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  else if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("972")) digits = `0${digits.slice(3).replace(/^0/, "")}`;
  return PHONE_NUMBER_REGEX.test(digits) ? digits : null;
}

/** wa.me wants the international number without "+" or the local leading 0. */
export function whatsappUrl(phone_number: string): string {
  return `https://wa.me/972${phone_number.replace(/^0/, "")}`;
}

function decodeQuotedPrintable(value: string): string {
  const bytes: number[] = [];
  for (let i = 0; i < value.length; i++) {
    const hex = value.slice(i + 1, i + 3);
    if (value[i] === "=" && /^[0-9A-Fa-f]{2}$/.test(hex)) {
      bytes.push(parseInt(hex, 16));
      i += 2;
    } else {
      bytes.push(value.charCodeAt(i));
    }
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}

function unescapeValue(value: string): string {
  return value.replace(/\\([,;\\])/g, "$1").replace(/\\n/gi, " ");
}

/**
 * Minimal vCard (.vcf) reader for a contacts export from Android/iPhone/Google
 * Contacts — only FN/N (name) and TEL (numbers). Handles the two quirks real
 * exports hit: folded lines (RFC 6350 continuation lines start with a space)
 * and Android's QUOTED-PRINTABLE encoding for non-ASCII (Hebrew) names, whose
 * soft line breaks end in "=". One entry per Israeli number on the card;
 * non-Israeli numbers and cards without a name are skipped.
 */
export function parseVCards(text: string): ParsedContact[] {
  const rawLines = text.replace(/\r\n?/g, "\n").split("\n");
  const lines: string[] = [];
  for (const line of rawLines) {
    const prev = lines.length - 1;
    if (prev >= 0 && /^[ \t]/.test(line)) lines[prev] += line.slice(1);
    else if (prev >= 0 && /ENCODING=QUOTED-PRINTABLE/i.test(lines[prev]) && lines[prev].endsWith("=")) {
      lines[prev] = lines[prev].slice(0, -1) + line;
    } else lines.push(line);
  }

  const contacts: ParsedContact[] = [];
  let fn: string | null = null;
  let n: string | null = null;
  let phones: string[] = [];

  for (const line of lines) {
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const [prop, ...params] = line.slice(0, colon).split(";");
    const key = prop.replace(/^item\d+\./i, "").toUpperCase();
    let value = line.slice(colon + 1);
    if (params.some((p) => /QUOTED-PRINTABLE/i.test(p))) value = decodeQuotedPrintable(value);

    if (key === "BEGIN" && value.toUpperCase() === "VCARD") {
      fn = n = null;
      phones = [];
    } else if (key === "FN") {
      fn = unescapeValue(value).trim();
    } else if (key === "N") {
      // N is "family;given;middle;prefix;suffix" — used only when FN is missing.
      const [family = "", given = ""] = value.split(/(?<!\\);/).map(unescapeValue);
      n = `${given} ${family}`.trim();
    } else if (key === "TEL") {
      const phone = normalizeIsraeliPhone(value);
      if (phone && !phones.includes(phone)) phones.push(phone);
    } else if (key === "END" && value.toUpperCase() === "VCARD") {
      const name = fn || n;
      if (name) for (const phone_number of phones) contacts.push({ name, phone_number });
    }
  }
  return contacts;
}
