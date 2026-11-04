import { eq, isNotNull, lt } from "drizzle-orm";
import { addDays, pushText, weekdayOf, type Report } from "@/lib/engine";
import { todayIn } from "@/lib/time";
import { getDb, type Database } from "./client";
import { latestInput } from "./plan-store";
import { ensureDailyReport, ensureWeeklyReport, type ReportRow } from "./report-store";
import { profiles, pushSubscriptions, reports, user } from "./schema";
import { scoped, type ScopedDb } from "./scoped";

export type PushPayload = { title: string; body: string; url: string };
export type PushTarget = { endpoint: string; p256dh: string; auth: string };
/** "gone" = the device unsubscribed (HTTP 404/410): delete it. */
export type PushSender = (sub: PushTarget, payload: PushPayload) => Promise<"ok" | "gone" | "error">;
export type EmailSender = (to: string, report: Report) => Promise<void>;

const MAX_FAILURES = 5;

/** Sends a push to every working device of this user. Returns how many got it. */
export async function deliverPush(db: ScopedDb, payload: PushPayload, send: PushSender) {
  const subs = await db.select(pushSubscriptions, lt(pushSubscriptions.failureCount, MAX_FAILURES));
  let ok = 0;
  let removed = 0;
  for (const sub of subs) {
    const result = await send(sub, payload);
    if (result === "ok") {
      ok++;
      await db.update(pushSubscriptions, { failureCount: 0, lastSuccessAt: new Date() }, eq(pushSubscriptions.id, sub.id));
    } else if (result === "gone") {
      removed++;
      await db.delete(pushSubscriptions, eq(pushSubscriptions.id, sub.id));
    } else {
      await db.update(pushSubscriptions, { failureCount: sub.failureCount + 1 }, eq(pushSubscriptions.id, sub.id));
    }
  }
  return { ok, removed };
}

async function pushReport(db: ScopedDb, row: ReportRow, url: string, send: PushSender | null, now: Date) {
  if (!send || row.pushedAt) return { ok: 0, removed: 0 };
  const result = await deliverPush(db, { ...pushText(row.payload), url }, send);
  if (result.ok > 0) await db.update(reports, { pushedAt: now }, eq(reports.id, row.id));
  return result;
}

/**
 * The daily job (Vercel cron). For each onboarded user, in their own time zone: yesterday's
 * report and, on Mondays, last week's. Push to their devices and email the weekly one if they
 * asked. Idempotent: reports are unique per period and stamped when sent, so a second run sends nothing.
 */
export async function runReportJob(opts: { now: Date; sendPush: PushSender | null; sendEmail: EmailSender | null; db?: Database }) {
  const db = opts.db ?? getDb();
  const summary = { users: 0, daily: 0, weekly: 0, pushes: 0, removedDevices: 0, emails: 0, errors: 0 };
  const users = await db.select({ id: user.id, email: user.email }).from(user).where(isNotNull(user.onboardedAt));
  for (const u of users) {
    try {
      const s = scoped(db, u.id);
      const [profile] = await s.select(profiles).limit(1);
      const input = await latestInput(s);
      if (!input) continue;
      summary.users++;
      const today = todayIn(profile?.timezone ?? "UTC", opts.now);

      const daily = await ensureDailyReport(s, addDays(today, -1), input.data);
      if (daily) {
        summary.daily++;
        const r = await pushReport(s, daily, "/today", opts.sendPush, opts.now);
        summary.pushes += r.ok;
        summary.removedDevices += r.removed;
      }

      if (weekdayOf(today) === 0) {
        const weekly = await ensureWeeklyReport(s, addDays(today, -7), input.data);
        if (weekly) {
          summary.weekly++;
          const r = await pushReport(s, weekly, "/reports", opts.sendPush, opts.now);
          summary.pushes += r.ok;
          summary.removedDevices += r.removed;
          if (opts.sendEmail && profile?.notifyEmailWeekly && !weekly.emailedAt) {
            try {
              await opts.sendEmail(u.email, weekly.payload);
              await s.update(reports, { emailedAt: opts.now }, eq(reports.id, weekly.id));
              summary.emails++;
            } catch (error) {
              // e.g. Resend's test sender only reaches the account owner: log, try again next run.
              console.error(`Weekly email to user ${u.id} failed`, error);
            }
          }
        }
      }
    } catch (error) {
      summary.errors++;
      console.error(`Report job failed for user ${u.id}`, error);
    }
  }
  return summary;
}
