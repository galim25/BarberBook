import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeIsraeliPhone, parseVCards, whatsappUrl } from "./contacts";

test("normalizes the ways a phone's contacts write an Israeli number", () => {
  for (const raw of ["0501234567", "050-123-4567", "+972 50-123-4567", "972501234567", "00972501234567", "(050) 123 4567", "+972 050 1234567"]) {
    assert.equal(normalizeIsraeliPhone(raw), "0501234567", raw);
  }
  assert.equal(normalizeIsraeliPhone("03-1234567"), "031234567");
  assert.equal(normalizeIsraeliPhone("+1 212 555 0100"), null);
  assert.equal(normalizeIsraeliPhone("*2700"), null);
});

test("builds a wa.me link from a local number", () => {
  assert.equal(whatsappUrl("0501234567"), "https://wa.me/972501234567");
});

test("reads names and numbers from a plain vCard 3.0 export", () => {
  const vcf = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    "N:Cohen;Dana;;;",
    "FN:Dana Cohen",
    "TEL;TYPE=CELL:+972 50-123-4567",
    "TEL;TYPE=HOME:03-1234567",
    "END:VCARD",
    "BEGIN:VCARD",
    "VERSION:3.0",
    "FN:Abroad Only",
    "TEL:+1 212 555 0100",
    "END:VCARD",
  ].join("\r\n");
  assert.deepEqual(parseVCards(vcf), [
    { name: "Dana Cohen", phone_number: "0501234567" },
    { name: "Dana Cohen", phone_number: "031234567" },
  ]);
});

test("decodes Android's quoted-printable Hebrew names, including soft line breaks", () => {
  // "יוסי כהן" as UTF-8 quoted-printable, split across lines with a trailing "=".
  const vcf = [
    "BEGIN:VCARD",
    "VERSION:2.1",
    "N;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:=D7=9B=D7=94=D7=9F;=D7=99=D7=95=D7=A1=D7=99;;;",
    "FN;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:=D7=99=D7=95=D7=A1=D7=99=20=D7=9B=",
    "=D7=94=D7=9F",
    "TEL;CELL:050-765-4321",
    "END:VCARD",
  ].join("\n");
  assert.deepEqual(parseVCards(vcf), [{ name: "יוסי כהן", phone_number: "0507654321" }]);
});

test("falls back to N when FN is missing, and unfolds continuation lines", () => {
  const vcf = ["BEGIN:VCARD", "N:Levi;Avi;;;", "item1.TEL:054", " 1112223", "END:VCARD"].join("\n");
  assert.deepEqual(parseVCards(vcf), [{ name: "Avi Levi", phone_number: "0541112223" }]);
});
