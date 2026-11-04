import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { zlatko } from "@/lib/engine/__fixtures__/inputs";
import { legacyState } from "@/lib/legacy/__fixtures__/legacy-state";
import { isLegacyState, mapLegacy } from "@/lib/legacy/map";
import type { Database } from "./client";
import { exportAll, importLegacy, importV2 } from "./data-store";
import { saveAndGenerate } from "./plan-store";
import { competitions, foodLogs, meals, planSessions, profiles, readiness, sessionLogs, user, weekMarks, weights } from "./schema";
import { scoped, type ScopedDb } from "./scoped";
import { createTestDb } from "./testing";

let db: Database;
let me: ScopedDb;

beforeEach(async () => {
  db = await createTestDb();
  await db.insert(user).values([
    { id: "z", name: "", email: "z@example.com" },
    { id: "other", name: "", email: "other@example.com" },
  ]);
  me = scoped(db, "z");
});

describe("mapLegacy", () => {
  const rows = mapLegacy(legacyState);
  it("rebuilds the 8-week legacy plan on real dates, honouring custom days", () => {
    expect(isLegacyState(legacyState)).toBe(true);
    const day = (date: string) => rows.sessions.filter((s) => s.date === date).map((s) => s.title);
    expect(day("2026-01-05")).toEqual(["Hard BJJ"]);
    expect(day("2026-01-06")).toEqual(["ATG", "Bike 30 min"]);
    expect(day("2026-01-10")).toEqual(["Comp sim 3 × 5:00"]);
    expect(day("2026-01-17")).toEqual(["Rowing 3 × 5:00"]);
    expect(day("2026-01-21")).toEqual(["Hard BJJ", "Wrestling"]);
    expect(rows.sessions.find((s) => s.title === "Wrestling")?.timeOfDay).toBe("morning");
  });

  it("maps logs with their per-round numbers, and keeps orphaned logs on their date", () => {
    const log = (id: string) => rows.logs.find((l) => l.externalId === `legacy:${id}`);
    expect(log("w1d0")).toMatchObject({ done: true, minutes: 90, rpe: 8, hardRounds: 6, notes: "Good rounds" });
    expect(log("w1d1")).toMatchObject({ avgHr: 128, maxHr: 141 });
    expect(log("w1d5")?.rounds?.map((r) => r.gas)).toEqual(["Attacking", null, "Holding on"]);
    expect(log("w2d5")?.rounds?.[0]).toEqual({ rpe: null, gas: null, endHr: 172, recHr: 130, output: 1300 });
    expect(log("w3d2-x1")).toMatchObject({ sessionExternalId: null, date: "2026-01-21" });
  });

  it("reads comma decimals the way the old app stored them", () => {
    expect(rows.weights).toContainEqual({ date: "2026-01-06", kg: 81.9 });
  });
});

describe("importLegacy", () => {
  it("is idempotent: importing the same backup twice changes nothing", async () => {
    const first = await importLegacy(me, legacyState);
    const count = async () => ({
      sessions: (await me.select(planSessions)).length,
      logs: (await me.select(sessionLogs)).length,
      food: (await me.select(foodLogs)).length,
      meals: (await me.select(meals)).length,
      private: (await me.foods.visible()).filter((f) => f.ownerId).length,
    });
    const after1 = await count();
    await importLegacy(me, legacyState);
    expect(await count()).toEqual(after1);
    expect(after1.sessions).toBe(first.sessions);
    expect(after1.logs).toBe(first.logs);
    expect(after1.private).toBe(1);
  });

  it("links logs to sessions and brings in readiness, weights, weeks and profile", async () => {
    await importLegacy(me, legacyState);
    const [bjj] = await me.select(planSessions, eq(planSessions.externalId, "legacy:w1d0:p"));
    const [log] = await me.select(sessionLogs, eq(sessionLogs.externalId, "legacy:w1d0"));
    expect(log?.sessionId).toBe(bjj?.id);
    expect(await me.select(readiness)).toEqual([expect.objectContaining({ date: "2026-01-05", sleepH: 7.5, rhr: 52, hrv: 80 })]);
    expect((await me.select(weights)).length).toBe(2);
    expect(await me.select(weekMarks)).toEqual([expect.objectContaining({ weekStart: "2026-01-05", done: true })]);
    const [profile] = await me.select(profiles);
    expect(profile).toMatchObject({ z2CeilingBpm: 138, sex: "male", age: 35, heightCm: 180 });
  });

  it("dry run counts without writing", async () => {
    const counts = await importLegacy(me, legacyState, { dryRun: true });
    expect(counts.sessions).toBeGreaterThan(50);
    expect(await me.select(planSessions)).toHaveLength(0);
  });
});

describe("export and import (v2)", () => {
  it("round-trips everything into another account", async () => {
    await saveAndGenerate(me, zlatko, "2026-01-05", "UTC");
    await importLegacy(me, legacyState);
    const doc = JSON.parse(JSON.stringify(await exportAll(me, "z@example.com")));
    const other = scoped(db, "other");
    await importV2(other, doc);
    for (const t of [competitions, planSessions, sessionLogs, foodLogs, meals, weights, readiness]) {
      expect((await other.select(t)).length).toBe((await me.select(t)).length);
    }
    // Logs still point at their (re-issued) sessions in the new account.
    const linked = (await other.select(sessionLogs)).filter((l) => l.sessionId);
    const ids = new Set((await other.select(planSessions)).map((s) => s.id));
    expect(linked.every((l) => ids.has(l.sessionId!))).toBe(true);
    // The original account is untouched.
    expect((await me.select(planSessions)).length).toBeGreaterThan(0);
  });

  it("still restores exports made before the calendar (a single competition)", async () => {
    await saveAndGenerate(me, zlatko, "2026-01-05", "UTC");
    const doc = JSON.parse(JSON.stringify(await exportAll(me, "z@example.com")));
    const [only] = doc.data.competitions;
    delete doc.data.competitions;
    doc.data.competition = { ...only, isMain: undefined };
    const other = scoped(db, "other");
    await importV2(other, doc);
    expect(await other.select(competitions)).toEqual([expect.objectContaining({ name: "Spring Open", isMain: true })]);
  });
});
