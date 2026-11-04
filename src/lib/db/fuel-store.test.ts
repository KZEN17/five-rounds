import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { zlatko } from "@/lib/engine/__fixtures__/inputs";
import type { Database } from "./client";
import { fuelDay } from "./fuel-store";
import { saveAndGenerate } from "./plan-store";
import { foodLogs, planSessions, sessionLogs, user, weights } from "./schema";
import { scoped, type ScopedDb } from "./scoped";
import { createTestDb } from "./testing";

let db: Database;
let me: ScopedDb;

beforeEach(async () => {
  db = await createTestDb();
  await db.insert(user).values({ id: "z", name: "", email: "z@example.com" });
  me = scoped(db, "z");
  await saveAndGenerate(me, zlatko, "2026-01-05", "UTC");
});

describe("fuelDay", () => {
  it("halves the deficit on a hard day and moves it to easy days (protect hard days)", async () => {
    const hard = await fuelDay(me, "2026-01-05", zlatko); // Monday: hard BJJ
    const easy = await fuelDay(me, "2026-01-06", zlatko); // Tuesday: ATG + bike
    // 82 kg against a 79 kg limit (aim 78.5) on 2 Mar: the outlook sets the daily deficit.
    const daily = hard.outlook.dailyAdjustmentKcal;
    expect(hard.outlook.drivingId).not.toBeNull();
    expect(daily).toBe(-Math.round(((3.5 / 7) * 7700) / 7));
    expect(hard.target.adjustment).toBe(Math.round(daily / 2));
    expect(easy.target.adjustment).toBeLessThan(daily);
  });

  it("uses logged minutes instead of planned ones", async () => {
    const [bjj] = await me.select(planSessions, eq(planSessions.date, "2026-01-05"));
    const before = await fuelDay(me, "2026-01-05", zlatko);
    await me.insert(sessionLogs, { sessionId: bjj!.id, date: "2026-01-05", done: true, minutes: 45 });
    const after = await fuelDay(me, "2026-01-05", zlatko);
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
    const d = await fuelDay(me, "2026-01-07", zlatko);
    expect(d.eaten).toEqual({ kcal: 589, p: 37, c: 66, f: 7 });
    expect(d.weight.kg).toBe(81.2);
    expect(d.recent.map((r) => r.name).sort()).toEqual(["Bar", "Oats"]);
  });

  it("shows the actual weekly rate after 10+ days of weigh-ins", async () => {
    for (let i = 0; i < 15; i++) {
      const date = `2026-01-${String(5 + i).padStart(2, "0")}`;
      await me.insert(weights, { date, kg: 82 - i * 0.07 }).onConflictDoUpdate({ target: [weights.userId, weights.date], set: { kg: 82 - i * 0.07 } });
    }
    const d = await fuelDay(me, "2026-01-19", zlatko);
    expect(d.weight.actualRate).toBeCloseTo(-0.49, 1);
  });

  it("eats at maintenance once the trend weight is on weight", async () => {
    // The trend is a 7-day average, so one light morning isn't enough: a week of them is.
    for (const date of ["2026-01-05", "2026-01-06", "2026-01-07"]) {
      await me.insert(weights, { date, kg: 78 }).onConflictDoUpdate({ target: [weights.userId, weights.date], set: { kg: 78 } });
    }
    const d = await fuelDay(me, "2026-01-07", zlatko);
    expect(d.outlook.comps[0]!.status).toBe("on_weight");
    expect(d.target.adjustment).toBe(0);
  });
});
