import webpush from "web-push";
import { prisma, type Prisma } from "./client";

/**
 * Real Web Push (device/browser notification, works even with the app
 * closed) — separate from the in-app Notification feed. Lives in packages/db
 * (not apps/web) because both the web app and apps/worker (appointment
 * reminders) send pushes, and this is the one place that has Prisma.
 * Requires NEXT_PUBLIC_VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY/VAPID_SUBJECT in the
 * environment (see .env.example — the worker needs its own copy in
 * apps/worker/.env); silently does nothing without them so a missing/
 * not-yet-configured deploy never breaks booking/cancellation flows.
 * Sending never throws: a push failure must not fail the booking, cancellation
 * or announcement that triggered it.
 */
function getVapidConfig() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return null;
  return { publicKey, privateKey, subject };
}

let configured = false;
function ensureConfigured(config: { publicKey: string; privateKey: string; subject: string }) {
  if (configured) return;
  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
  configured = true;
}

export type PushPayload = {
  title: string;
  body: string;
  /** Relative path opened when the notification is tapped, e.g. "/admin/booking-requests". */
  url: string;
};

async function sendPush(where: Prisma.PushSubscriptionWhereInput, payload: PushPayload): Promise<void> {
  try {
    const config = getVapidConfig();
    if (!config) return;
    ensureConfigured(config);

    const subscriptions = await prisma.pushSubscription.findMany({ where });
    if (subscriptions.length === 0) return;

    const body = JSON.stringify(payload);
    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            body,
          );
        } catch (err) {
          // 404/410 means the browser dropped the subscription (uninstalled, cleared data, expired) — stop targeting it.
          const statusCode = (err as { statusCode?: number }).statusCode;
          if (statusCode === 404 || statusCode === 410) {
            await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
          } else {
            // Not logging the endpoint/keys — they're per-device secrets. Status + message is enough to tell "bad VAPID key" (401/403) from a network blip.
            console.error("[push] delivery failed:", statusCode ?? "no-status", (err as Error).message);
          }
        }
      }),
    );
  } catch (err) {
    console.error("[push] failed to send:", err);
  }
}

/** Sends a real push notification to every administrator's subscribed devices. No-op if VAPID isn't configured. */
export function sendPushToAdmins(payload: PushPayload): Promise<void> {
  return sendPush({ user: { role: "administrator" } }, payload);
}

/** Sends a real push notification to every device one specific user (customer) subscribed. No-op if VAPID isn't configured. */
export function sendPushToUser(user_id: string, payload: PushPayload): Promise<void> {
  return sendPush({ user_id }, payload);
}

/**
 * Broadcast to every subscribed customer device (a new barber announcement, a freed-up slot).
 * `excludeUserIds` skips people who are already being told some other way (e.g. waitlist
 * members who got their own notification) or for whom the message makes no sense (the
 * customer whose own appointment just freed the slot). No-op if VAPID isn't configured.
 */
export function sendPushToCustomers(payload: PushPayload, options?: { excludeUserIds?: string[] }): Promise<void> {
  const excluded = options?.excludeUserIds?.filter(Boolean) ?? [];
  return sendPush(
    { user: { role: "customer" }, ...(excluded.length > 0 ? { user_id: { notIn: excluded } } : {}) },
    payload,
  );
}
