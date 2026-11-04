import webpush from "web-push";
import { appBaseUrl } from "@/lib/auth";
import type { PushSender } from "@/lib/db/report-job";

/** Web Push needs a VAPID key pair (`npx web-push generate-vapid-keys`). Without it, push is off. */
export function vapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY ? process.env.VAPID_PUBLIC_KEY : null;
}

let configured = false;

/** Sends through the browser's push service. 404/410 mean the device unsubscribed. */
export function pushSenderFromEnv(): PushSender | null {
  const publicKey = vapidPublicKey();
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return null;
  if (!configured) {
    const subject = process.env.OWNER_EMAIL ? `mailto:${process.env.OWNER_EMAIL}` : appBaseUrl();
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
  }
  return async (sub, payload) => {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), { TTL: 12 * 3600 });
      return "ok";
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) return "gone";
      console.error("Push failed", status ?? error);
      return "error";
    }
  };
}
