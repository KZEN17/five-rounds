import type { Metadata } from "next";
import { getProfile } from "@/lib/db/profile";
import { vapidPublicKey } from "@/lib/push";
import { requireUser } from "@/lib/session";
import { EmailSetting, PushSetting } from "./push-setting";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const { user, db } = await requireUser();
  const profile = await getProfile(db);
  const key = vapidPublicKey();
  return (
    <>
      <h2>Notifications</h2>
      <section className="panel" aria-labelledby="push-heading">
        <h3 id="push-heading">Morning report on your phone</h3>
        <p className="hint">Every morning: how yesterday went, what slipped, and today&apos;s session. On Mondays, the weekly recap. Each device you turn it on for gets them.</p>
        {key ? <PushSetting publicKey={key} /> : <p className="hint">Phone notifications aren&apos;t set up on the server yet.</p>}
      </section>
      <section className="panel" aria-labelledby="email-heading">
        <h3 id="email-heading">Weekly email</h3>
        <EmailSetting on={profile?.notifyEmailWeekly ?? false} configured={Boolean(process.env.AUTH_RESEND_KEY && process.env.EMAIL_FROM)} email={user.email} />
      </section>
    </>
  );
}
