import { SignJWT, jwtVerify } from "jose";
import type { UserRole } from "@barberbook/db";

export const SESSION_COOKIE = "session";
export const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30; // 30 days

/**
 * Defaults to NODE_ENV === "production", but `next start` always sets that
 * regardless of deployment specifics — and a Secure cookie is silently
 * dropped by the browser on a plain-HTTP origin (e.g. testing a production
 * build at http://ip:port before a domain + TLS are set up), which breaks
 * login with no visible error. COOKIE_SECURE lets ops override that default
 * independently of NODE_ENV for exactly that window.
 *
 * Lives here (not session.ts) because this file has no Node-only imports and
 * is safe to import from edge middleware (proxy.ts), unlike session.ts.
 */
export function cookieSecure(): boolean {
  if (process.env.COOKIE_SECURE) return process.env.COOKIE_SECURE === "true";
  return process.env.NODE_ENV === "production";
}

function getSecretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("SESSION_SECRET is missing or too short");
  }
  return new TextEncoder().encode(secret);
}

export type SessionPayload = {
  sub: string;
  role: UserRole;
  full_name: string;
};

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ role: payload.role, full_name: payload.full_name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return {
      sub: payload.sub as string,
      role: payload.role as UserRole,
      full_name: payload.full_name as string,
    };
  } catch {
    return null;
  }
}

const PHONE_PROOF_PURPOSE = "phone-verified";
const PHONE_PROOF_TTL_SECONDS = 10 * 60;

/**
 * Signed, short-lived proof that the holder just entered a valid SMS code for
 * this phone number. Only used between "code verified" and "name entered" for a
 * brand-new customer — so the number's existence as a customer is never revealed
 * before ownership is proven.
 */
export async function signPhoneProof(phone_number: string): Promise<string> {
  return new SignJWT({ purpose: PHONE_PROOF_PURPOSE })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(phone_number)
    .setIssuedAt()
    .setExpirationTime(`${PHONE_PROOF_TTL_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifyPhoneProof(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (payload.purpose !== PHONE_PROOF_PURPOSE || typeof payload.sub !== "string") return null;
    return payload.sub;
  } catch {
    return null;
  }
}

