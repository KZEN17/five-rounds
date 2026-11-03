import { and, eq, isNull, lt } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { zlatko } from "@/lib/engine/__fixtures__/inputs";
import type { PlanInput } from "@/lib/engine";
import type { Database } from "./client";
import { activePlan, saveAndGenerate } from "./plan-store";
import { planInputs, plans, planSessions, sessionLogs, user } from "./schema";
import { scoped, type ScopedDb } from "./scoped";
import { createTestDb } from "./testing";

let db: Database;
let me: ScopedDb;

beforeEach(async () => {
  db = await createTestDb();
  await db.insert(user).values({ id: "z", name: "", email: "z@example.com" });
  me = scoped(db, "z");
});

const live = (where?: ReturnType<typeof and>) => me.select(planSessions, and(isNull(planSessions.deletedAt), where));

describe("saveAndGenerate", () => {
  it("stores version 1 of the answers, an active plan, and the sessions from today", async () => {
    await saveAndGenerate(me, zlatko, "2026-01-05", "UTC");
    expect((await me.select(planInputs)).map((r) => r.version)).toEqual([1]);
    const plan = await activePlan(me);
    expect(plan?.output.weeks).toHaveLength(8);
    const sessions = await live();
    expect(sessions.length).toBe(plan!.output.weeks.flatMap((w) => w.days.flatMap((d) => d.sessions)).length);
    expect(sessions.every((s) => s.source === "generated" && s.planId === plan!.id)).toBe(true);
  });

  it("regenerating keeps the past and anything logged, and replaces the rest of the future", async () => {
    await saveAndGenerate(me, zlatko, "2026-01-05", "UTC");
    const pastBefore = await live(lt(planSessions.date, "2026-01-12"));
    // Log a future session (e.g. ticked done in advance).
    const [future] = await live(eq(planSessions.date, "2026-01-13"));
    await me.insert(sessionLogs, { sessionId: future!.id, date: future!.date, done: true });

    const changed: PlanInput = { ...zlatko, availability: { ...zlatko.availability, extraSessions: 1 } };
    await saveAndGenerate(me, changed, "2026-01-12", "UTC");

    expect((await me.select(planInputs)).map((r) => r.version).sort()).toEqual([1, 2]);
    expect((await me.select(plans, eq(plans.active, true))).map((p) => p.version)).toEqual([2]);
    // Past days untouched.
    expect((await live(lt(planSessions.date, "2026-01-12"))).map((s) => s.id).sort()).toEqual(pastBefore.map((s) => s.id).sort());
    // The logged session survives, and its day isn't doubled up.
    const tuesday = await live(eq(planSessions.date, "2026-01-13"));
    expect(tuesday.map((s) => s.id)).toContain(future!.id);
    expect(tuesday.every((s) => s.planId !== null)).toBe(true);
    // With one extra session there's no easy bike left on a future Thursday.
    const thursday = await live(eq(planSessions.date, "2026-01-15"));
    expect(thursday.some((s) => s.type === "aerobic")).toBe(false);
  });
});
