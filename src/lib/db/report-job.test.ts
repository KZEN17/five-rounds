import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { zlatko } from "@/lib/engine/__fixtures__/inputs";
import type { Database } from "./client";
import { saveAndGenerate } from "./plan-store";
import { runReportJob, type PushSender } from "./report-job";
import { dayFacts, ensureDailyReport } from "./report-store";
import { foodLogs, planSessions, profiles, pushSubscriptions, reports, sessionLogs, user, weights } from "./schema";
import { scoped, type ScopedDb } from "./scoped";
import { createTestDb } from "./testing";

let db: Database;
let me: ScopedDb;
const MONDAY = "2026-01-05";
const TUESDAY = "2026-01-06";
const at = (iso: string) => new Date(`${iso}T05:00:00Z`);

beforeEach(async () => {
  db = await createTestDb();
  await db.insert(user).values([
    { id: "z", name: "", email: "z@example.com", onboardedAt: new Date() },
    { id: "new", name: "", email: "new@example.com" },
  ]);
  me = scoped(db, "z");
  await saveAndGenerate(me, zlatko, MONDAY, "UTC");
});

async function logMonday() {
  const [bjj] = await me.select(planSessions, eq(planSessions.date, MONDAY));
  await me.insert(sessionLogs, { sessionId: bjj!.id, date: MONDAY, done: true, minutes: 90, rpe: 8, hardRounds: 6 });
  await me.insert(foodLogs, { date: MONDAY, name: "Day", kcal: 2500, p: 170, c: 280, f: 60 });
}

describe("report facts", () => {
  it("builds yesterday's facts from what was planned and logged", async () => {
    await logMonday();
    const built = await dayFacts(me, MONDAY, zlatko);
    expect(built?.facts).toMatchObject({ planned: 1, done: 1, hardRounds: 6, avgRpe: 8, missed: [], weighedIn: true });
    expect(built?.facts.food.logged).toBe(true);
    expect(built?.facts.nextPlan.length).toBeGreaterThan(0);
    expect(built?.pace?.compName).toBe("Spring Open");
  });

  it("stores each report once", async () => {
    await logMonday();
    const a = await ensureDailyReport(me, MONDAY, zlatko);
    const b = await ensureDailyReport(me, MONDAY, zlatko);
    expect(a?.id).toBe(b?.id);
    expect(await me.select(reports)).toHaveLength(1);
  });

  it("compares the pace with the last report for the same competition", async () => {
    await logMonday();
    await ensureDailyReport(me, MONDAY, zlatko);
    // Gaining weight makes the required pace faster: the next report says the target got further.
    await me.insert(weights, { date: TUESDAY, kg: 83.5 }).onConflictDoUpdate({ target: [weights.userId, weights.date], set: { kg: 83.5 } });
    const next = await ensureDailyReport(me, TUESDAY, zlatko);
    expect(next?.payload.concerns.join(" ")).toMatch(/getting further away/);
  });
});

describe("runReportJob", () => {
  it("pushes yesterday's report once per device, and a second run sends nothing", async () => {
    await logMonday();
    await me.insert(pushSubscriptions, { endpoint: "https://push.example/a", p256dh: "p".repeat(20), auth: "a".repeat(10), userAgent: null });
    const send = vi.fn<PushSender>(async () => "ok");
    const first = await runReportJob({ now: at(TUESDAY), sendPush: send, sendEmail: null, db });
    expect(first).toMatchObject({ users: 1, daily: 1, pushes: 1 });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]![1].title).toBeTruthy();
    const second = await runReportJob({ now: at(TUESDAY), sendPush: send, sendEmail: null, db });
    expect(second.pushes).toBe(0);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("removes devices that unsubscribed, and keeps going after failures", async () => {
    await logMonday();
    await me.insert(pushSubscriptions, [
      { endpoint: "https://push.example/gone", p256dh: "p".repeat(20), auth: "a".repeat(10), userAgent: null },
      { endpoint: "https://push.example/flaky", p256dh: "p".repeat(20), auth: "a".repeat(10), userAgent: null },
    ]);
    const send: PushSender = async (sub) => (sub.endpoint.endsWith("gone") ? "gone" : "error");
    const result = await runReportJob({ now: at(TUESDAY), sendPush: send, sendEmail: null, db });
    expect(result.removedDevices).toBe(1);
    const left = await me.select(pushSubscriptions);
    expect(left.map((s) => [s.endpoint, s.failureCount])).toEqual([["https://push.example/flaky", 1]]);
  });

  it("on Mondays emails the weekly recap to users who asked, once", async () => {
    await db.update(profiles).set({ notifyEmailWeekly: true }).where(eq(profiles.userId, "z"));
    await logMonday();
    const sendEmail = vi.fn(async () => {});
    const nextMonday = new Date("2026-01-12T05:00:00Z");
    const r1 = await runReportJob({ now: nextMonday, sendPush: null, sendEmail, db });
    expect(r1.weekly).toBe(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0]).toEqual(["z@example.com", expect.objectContaining({ kind: "weekly", periodStart: MONDAY })]);
    await runReportJob({ now: nextMonday, sendPush: null, sendEmail, db });
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });
});
