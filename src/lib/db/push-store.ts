import { eq } from "drizzle-orm";
import { pushSubscriptions } from "./schema";
import { RAW, type ScopedDb } from "./scoped";

/**
 * Saves this device's subscription for the signed-in user. A push endpoint belongs to one
 * browser; if it was registered under another account on this device, it moves to this one.
 */
export async function claimPushSubscription(db: ScopedDb, sub: { endpoint: string; p256dh: string; auth: string; userAgent: string | null }) {
  await db.transaction(async (tx) => {
    await tx[RAW].delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, sub.endpoint));
    await tx.insert(pushSubscriptions, sub);
  });
}
