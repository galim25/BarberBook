"use server";

import { prisma } from "@barberbook/db";
import { getSession } from "@/lib/auth/session";
import { isAllowedPushEndpoint } from "@/lib/pushEndpoint";
import type { BookingResult } from "@/lib/actions/booking";

type SubscriptionInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

const MAX_SUBSCRIPTIONS_PER_USER = 10;

/** Called once per browser/device when a logged-in user (customer or admin) turns push notifications on. */
export async function subscribeToPushAction(subscription: SubscriptionInput): Promise<BookingResult> {
  const session = await getSession();
  if (!session) return { error: "יש להתחבר" };

  const { endpoint, keys } = subscription;
  if (!isAllowedPushEndpoint(endpoint) || !keys?.p256dh || !keys?.auth) {
    return { error: "מכשיר לא נתמך להתראות" };
  }

  const existing = await prisma.pushSubscription.findUnique({ where: { endpoint } });
  if (!existing) {
    const count = await prisma.pushSubscription.count({ where: { user_id: session.sub } });
    if (count >= MAX_SUBSCRIPTIONS_PER_USER) return { error: "יותר מדי מכשירים רשומים להתראות" };
  }

  // Same physical device, new login (e.g. a different account on a shared phone) → the subscription moves to that user.
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { user_id: session.sub, p256dh: keys.p256dh, auth: keys.auth },
    create: { user_id: session.sub, endpoint, p256dh: keys.p256dh, auth: keys.auth },
  });

  return { success: true };
}

/** Called when the user turns push notifications off on this device, or the browser reports the subscription expired. */
export async function unsubscribeFromPushAction(endpoint: string): Promise<BookingResult> {
  const session = await getSession();
  if (!session) return { error: "יש להתחבר" };

  await prisma.pushSubscription.deleteMany({ where: { endpoint, user_id: session.sub } });
  return { success: true };
}
