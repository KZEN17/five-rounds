"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { UserError, userAction } from "@/lib/actions";
import { saveProfile } from "@/lib/db/profile";
import { claimPushSubscription } from "@/lib/db/push-store";
import { deliverPush } from "@/lib/db/report-job";
import { pushSubscriptions } from "@/lib/db/schema";
import { pushSenderFromEnv } from "@/lib/push";

export const savePushSubscription = userAction(
  z.object({ endpoint: z.url().max(1000), p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100), userAgent: z.string().max(200).nullable() }),
  async (sub, { db }) => {
    await claimPushSubscription(db, sub);
    revalidatePath("/settings/notifications");
    return null;
  },
);

export const removePushSubscription = userAction(z.object({ endpoint: z.string().max(1000) }), async ({ endpoint }, { db }) => {
  await db.delete(pushSubscriptions, eq(pushSubscriptions.endpoint, endpoint));
  revalidatePath("/settings/notifications");
  return null;
});

export const sendTestPush = userAction(z.object({}), async (_input, { db }) => {
  const send = pushSenderFromEnv();
  if (!send) throw new UserError("Notifications aren't set up on the server yet.");
  const { ok } = await deliverPush(db, { title: "Five Rounds", body: "Notifications are on. Your report arrives each morning.", url: "/today" }, send);
  if (!ok) throw new UserError("Couldn't reach this device. Turn notifications off and on again.");
  return ok;
});

export const setWeeklyEmail = userAction(z.object({ on: z.boolean() }), async ({ on }, { db }) => {
  await saveProfile(db, { notifyEmailWeekly: on });
  revalidatePath("/settings/notifications");
  return null;
});
