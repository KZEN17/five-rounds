import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { ZLATKO_TODAY, zlatko } from "@/lib/engine/__fixtures__/inputs";
import { toIso } from "@/lib/engine";
import type { Database } from "./client";
import { saveAndGenerate } from "./plan-store";
import {
  foodLogs,
  foods,
  meals,
  planInputs,
  plans,
  planSessions,
  readiness,
  readinessAdjustments,
  sessionLogs,
  user,
  weekMarks,
  weights,
} from "./schema";
import { scoped, type OwnedTable } from "./scoped";
import { createTestDb } from "./testing";

let db: Database;
const today = toIso(ZLATKO_TODAY);

beforeEach(async () => {
  db = await createTestDb();
  await db.insert(user).values([
    { id: "alice", name: "", email: "alice@example.com" },
    { id: "bob", name: "", email: "bob@example.com" },
  ]);
  const a = scoped(db, "alice");
  await saveAndGenerate(a, zlatko, today, "Europe/Skopje");
  const [s] = await a.select(planSessions).limit(1);
  await a.insert(sessionLogs, { sessionId: s!.id, date: s!.date, done: true });
  await a.insert(weekMarks, { weekStart: today, done: true });
  await a.insert(readiness, { date: today, sleepH: 7 });
  await a.insert(readinessAdjustments, { date: today, action: "ignored", reasons: ["test"] });
  await a.insert(meals, { name: "Bowl", items: [], portions: 1 });
  await a.insert(foodLogs, { date: today, name: "Bowl", kcal: 500 });
  await a.foods.insert({ name: "Alice's bar", kcal: 400, p: 30, c: 40, f: 10 });
  await db.insert(foods).values({ name: "Rice", kcal: 130, p: 2.7, c: 28, f: 0.3 });
});

const TABLES: [string, OwnedTable][] = [
  ["plan_inputs", planInputs],
  ["plans", plans],
  ["plan_sessions", planSessions],
  ["session_logs", sessionLogs],
  ["week_marks", weekMarks],
  ["readiness", readiness],
  ["readiness_adjustments", readinessAdjustments],
  ["weights", weights],
  ["meals", meals],
  ["food_logs", foodLogs],
];

describe.each(TABLES)("%s: bob can never reach alice's rows", (_name, table) => {
  it("reads only his own (none)", async () => {
    expect((await scoped(db, "alice").select(table)).length).toBeGreaterThan(0);
    expect(await scoped(db, "bob").select(table)).toHaveLength(0);
  });

  it("can't update or delete them", async () => {
    const before = await scoped(db, "alice").select(table);
    await scoped(db, "bob").delete(table);
    expect(await scoped(db, "alice").select(table)).toHaveLength(before.length);
  });
});

describe("foods", () => {
  it("everyone sees the shared list; private foods stay private", async () => {
    const names = async (id: string) => (await scoped(db, id).foods.visible()).map((f) => f.name).sort();
    expect(await names("alice")).toEqual(["Alice's bar", "Rice"]);
    expect(await names("bob")).toEqual(["Rice"]);
  });

  it("bob can't delete alice's private food", async () => {
    const [bar] = await scoped(db, "alice").foods.visible(eq(foods.name, "Alice's bar"));
    await scoped(db, "bob").foods.delete(bar!.id);
    expect(await scoped(db, "alice").foods.visible(eq(foods.name, "Alice's bar"))).toHaveLength(1);
  });
});

describe("the database itself rejects cross-user references", () => {
  it("bob can't log against alice's session", async () => {
    const [s] = await scoped(db, "alice").select(planSessions).limit(1);
    await expect(scoped(db, "bob").insert(sessionLogs, { sessionId: s!.id, date: s!.date, done: true })).rejects.toThrow();
  });

  it("bob can't add a session to alice's plan", async () => {
    const [p] = await scoped(db, "alice").select(plans).limit(1);
    await expect(
      scoped(db, "bob").insert(planSessions, { planId: p!.id, date: today, type: "walk", title: "x", params: { intensity: "easy", modality: "walk", purpose: "", notes: "" } }),
    ).rejects.toThrow();
  });
});
