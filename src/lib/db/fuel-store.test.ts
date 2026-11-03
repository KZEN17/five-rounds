import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { zlatko } from "@/lib/engine/__fixtures__/inputs";
import type { Plan } from "@/lib/engine";
import type { Database } from "./client";
import { fuelDay } from "./fuel-store";
import { activePlan, saveAndGenerate } from "./plan-store";
import { foodLogs, planSessions, sessionLogs, user, weights } from "./schema";
import { scoped, type ScopedDb } from "./scoped";
import { createTestDb } from "./testing";

let db: Database;
let me: ScopedDb;
let plan: Plan;

beforeEach(async () => {
  db = await createTestDb();
  await db.insert(user).values({ id: "z", name: "", email: "z@example.com" });
  me = scoped(db, "z");
  await saveAndGenerate(me, zlatko, "2026-01-05", "UTC");
  plan = (await activePlan(me))!.output;
});

describe("fuelDay", () => {
  it("halves the deficit on a hard day and moves it to easy days (protect hard days)", async () => {
    const hard = await fuelDay(me, "2026-01-05", zlatko, plan); // Monday: hard BJJ
    const easy = await fuelDay(me, "2026-01-06", zlatko, plan); // Tuesday: ATG + bike
    const daily = plan.nutrition.dailyAdjustmentKcal;
    expect(daily).toBeLessThan(0);
    expect(hard.target.adjustment).toBe(Math.round(daily / 2));
    expect(easy.target.adjustment).toBeLessThan(daily);
  });

  it("uses logged minutes instead of planned ones", async () => {
    const [bjj] = await me.select(planSessions, eq(planSessions.date, "2026-01-05"));
    const before = await fuelDay(me, "2026-01-05", zlatko, plan);
    await me.insert(sessionLogs, { sessionId: bjj!.id, date: "2026-01-05", done: true, minutes: 45 });
    const after = await fuelDay(me, "2026-01-05", zlatko, plan);
    expect(before.target.burns[0]!.minutes).toBe(90);
    expect(after.target.burns[0]!.minutes).toBe(45);
    expect(after.target.training).toBeLessThan(before.target.training);
  });

  it("totals the food log and uses the latest weigh-in", async () => {
    await me.insert(foodLogs, [
      { date: "2026-01-07", name: "Oats", kcal: 389, p: 17, c: 66, f: 7 },
      { date: "2026-01-07", name: "Bar", kcal: 200, p: 20, c: null, f: null },
    ]);
    await me.insert(weights, { date: "2026-01-06", kg: 81.2 });
    const d = await fuelDay(me, "2026-01-07", zlatko, plan);
    expect(d.eaten).toEqual({ kcal: 589, p: 37, c: 66, f: 7 });
    expect(d.weight.kg).toBe(81.2);
    expect(d.recent.map((r) => r.name).sort()).toEqual(["Bar", "Oats"]);
  });

  it("shows the actual weekly rate after 10+ days of weigh-ins", async () => {
    for (let i = 0; i < 15; i++) {
      const date = `2026-01-${String(5 + i).padStart(2, "0")}`;
      await me.insert(weights, { date, kg: 82 - i * 0.07 }).onConflictDoUpdate({ target: [weights.userId, weights.date], set: { kg: 82 - i * 0.07 } });
    }
    const d = await fuelDay(me, "2026-01-19", zlatko, plan);
    expect(d.weight.actualRate).toBeCloseTo(-0.49, 1);
  });
});
