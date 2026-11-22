import { beforeEach, describe, expect, it } from "vitest";
import type { Database } from "./client";
import { sessionLogs, user, type ExerciseLog } from "./schema";
import { scoped, type ScopedDb } from "./scoped";
import { lastBefore, liftHistory, liftSummary, newBestsOn } from "./strength-store";
import { createTestDb } from "./testing";

let db: Database;
let me: ScopedDb;
let other: ScopedDb;

const squat = (...sets: [number, number | null][]): ExerciseLog => ({ name: "Back squat", done: true, sets: sets.map(([kg, reps]) => ({ kg, reps })) });
const log = (who: ScopedDb, date: string, exercises: ExerciseLog[]) => who.insert(sessionLogs, { date, done: true, exercises });

beforeEach(async () => {
  db = await createTestDb();
  await db.insert(user).values([
    { id: "a", name: "", email: "a@example.com" },
    { id: "b", name: "", email: "b@example.com" },
  ]);
  me = scoped(db, "a");
  other = scoped(db, "b");
});

describe("lift history", () => {
  it("groups logged sets by exercise, newest first, skipping empty sets and unlogged lifts", async () => {
    await log(me, "2026-01-05", [squat([80, 5], [80, 5]), { name: "Copenhagen plank", done: true, detail: "2 × 20 s" }]);
    await log(me, "2026-01-08", [squat([82.5, 5], [82.5, null])]);
    await log(other, "2026-01-09", [squat([200, 5])]);

    const h = await liftHistory(me);
    expect([...h.keys()]).toEqual(["Back squat"]);
    expect(h.get("Back squat")).toEqual([
      { date: "2026-01-08", sets: [{ kg: 82.5, reps: 5 }] },
      { date: "2026-01-05", sets: [{ kg: 80, reps: 5 }, { kg: 80, reps: 5 }] },
    ]);
    expect((await liftHistory(me, "2026-01-07")).get("Back squat")?.map((e) => e.date)).toEqual(["2026-01-05"]);
  });

  it("finds the last time before a date, never the same day", async () => {
    await log(me, "2026-01-05", [squat([80, 5])]);
    await log(me, "2026-01-08", [squat([82.5, 5])]);
    const h = await liftHistory(me);
    expect(lastBefore(h, ["Back squat", "Bench press"], "2026-01-08")).toEqual({ "Back squat": { date: "2026-01-05", sets: [{ kg: 80, reps: 5 }] } });
    expect(lastBefore(h, ["Back squat"], "2026-01-05")).toEqual({});
  });

  it("calls a new best only when it beats an earlier estimated max", async () => {
    await log(me, "2026-01-05", [squat([80, 5])]);
    await log(me, "2026-01-08", [squat([85, 5])]);
    await log(me, "2026-01-12", [squat([85, 3])]);
    const h = await liftHistory(me);
    expect(newBestsOn(h, "2026-01-05")).toEqual([]); // first time is a baseline, not a best
    expect(newBestsOn(h, "2026-01-08")).toEqual(["Back squat 85 kg × 5"]);
    expect(newBestsOn(h, "2026-01-12")).toEqual([]);
  });

  it("summarises best, last and the change against four weeks ago", async () => {
    await log(me, "2026-01-05", [squat([80, 5])]);
    await log(me, "2026-02-09", [squat([90, 5])]);
    const [s] = await liftSummary(me, "2026-02-09");
    expect(s).toMatchObject({ name: "Back squat", sessions: 2, lastDate: "2026-02-09", best: { kg: 90, reps: 5 }, last: { kg: 90, reps: 5 } });
    expect(s?.change).toBeCloseTo(90 * (1 + 5 / 30) - 80 * (1 + 5 / 30), 1);
    expect(await liftSummary(other, "2026-02-09")).toEqual([]);
  });
});
