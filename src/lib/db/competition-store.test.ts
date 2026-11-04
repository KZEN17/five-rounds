import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { zlatko } from "@/lib/engine/__fixtures__/inputs";
import type { Database } from "./client";
import { listCompetitions, saveMainCompetition, setMainCompetition, fieldsFromInput } from "./competition-store";
import { outlookFor } from "./fuel-store";
import { saveAndGenerate } from "./plan-store";
import { competitions, user } from "./schema";
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

describe("competition calendar", () => {
  it("the plan answers create the main competition; regenerating updates it, not a duplicate", async () => {
    await saveAndGenerate(me, { ...zlatko, competition: { ...zlatko.competition, name: "Renamed" } }, "2026-01-05", "UTC");
    expect((await listCompetitions(me)).map((c) => [c.name, c.isMain])).toEqual([["Renamed", true]]);
  });

  it("holds several competitions with one main, and switching main keeps exactly one", async () => {
    await me.insert(competitions, { ...fieldsFromInput({ ...zlatko.competition, name: "Club open", date: "2026-02-07", targetWeightKg: 80 }) });
    const [club] = await me.select(competitions, eq(competitions.name, "Club open"));
    await setMainCompetition(me, club!.id);
    const list = await listCompetitions(me);
    expect(list.map((c) => [c.name, c.isMain])).toEqual([
      ["Club open", true],
      ["Spring Open", false],
    ]);
    await saveMainCompetition(me, fieldsFromInput({ ...zlatko.competition, name: "Club open (moved)", date: "2026-02-14" }));
    expect((await listCompetitions(me)).filter((c) => c.isMain).map((c) => c.name)).toEqual(["Club open (moved)"]);
  });

  it("a nearer competition with a tighter pace takes over the calorie target", async () => {
    const before = await outlookFor(me, "2026-01-05", 82);
    expect(before.outlook.comps.map((c) => c.name)).toEqual(["Spring Open"]);
    await me.insert(competitions, { ...fieldsFromInput({ ...zlatko.competition, name: "Club open", date: "2026-02-02", targetWeightKg: 80 }) });
    const after = await outlookFor(me, "2026-01-05", 82);
    const driving = after.outlook.comps.find((c) => c.id === after.outlook.drivingId);
    expect(driving?.name).toBe("Club open");
    expect(after.outlook.dailyAdjustmentKcal).toBeLessThan(before.outlook.dailyAdjustmentKcal);
  });
});
