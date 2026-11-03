import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { zlatko } from "@/lib/engine/__fixtures__/inputs";
import type { Database } from "./client";
import { saveAndGenerate } from "./plan-store";
import { applySuggestions, ignoreSuggestions, readinessFor } from "./readiness-store";
import { planSessions, readiness, readinessAdjustments, user } from "./schema";
import { scoped, type ScopedDb } from "./scoped";
import { createTestDb } from "./testing";

let db: Database;
let me: ScopedDb;
const SAT = "2026-01-10"; // week 1 Saturday: comp sim

beforeEach(async () => {
  db = await createTestDb();
  await db.insert(user).values({ id: "z", name: "", email: "z@example.com" });
  me = scoped(db, "z");
  await saveAndGenerate(me, zlatko, "2026-01-05", "UTC");
  for (const d of ["2026-01-05", "2026-01-06", "2026-01-07", "2026-01-08"]) {
    await me.insert(readiness, { date: d, sleepH: 8, rhr: 50, hrv: 80 });
  }
});

describe("readiness suggestions", () => {
  it("offers nothing on a green day", async () => {
    await me.insert(readiness, { date: SAT, sleepH: 8, rhr: 51, hrv: 79 });
    expect((await readinessFor(me, SAT, zlatko)).suggestions).toEqual([]);
  });

  it("applies the swap on a flagged day and logs it; then stops offering", async () => {
    await me.insert(readiness, { date: SAT, sleepH: 5.5, rhr: 58, hrv: 60 });
    const before = await readinessFor(me, SAT, zlatko);
    expect(before.suggestions.map((s) => [s.from.type, s.to.type])).toEqual([["comp_sim", "aerobic"]]);

    await applySuggestions(me, SAT, zlatko);
    const [swapped] = await me.select(planSessions, eq(planSessions.date, SAT));
    expect(swapped?.type).toBe("aerobic");
    expect(swapped?.source).toBe("readiness_swap");
    const log = await me.select(readinessAdjustments);
    expect(log).toEqual([expect.objectContaining({ action: "applied", sessionId: swapped!.id })]);
    expect((await readinessFor(me, SAT, zlatko)).suggestions).toEqual([]);
  });

  it("ignoring is remembered for the day", async () => {
    await me.insert(readiness, { date: SAT, sleepH: 5 });
    await ignoreSuggestions(me, SAT);
    expect((await readinessFor(me, SAT, zlatko)).suggestions).toEqual([]);
    const [s] = await me.select(planSessions, eq(planSessions.date, SAT));
    expect(s?.type).toBe("comp_sim");
  });
});
