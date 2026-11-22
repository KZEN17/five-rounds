import { describe, expect, it } from "vitest";
import { ZLATKO_TODAY, withWeeks, zlatko } from "../__fixtures__/inputs";
import { generatePlan } from "../generate";
import type { PlanInput } from "../input";
import { alternativesFor, bestSet, e1rm, suggestNext } from "../lifting";
import type { Plan, Session } from "../types";

const gym = (base: PlanInput = zlatko): PlanInput => ({ ...base, strength: { ...base.strength, style: "barbell", prehab: "atg" } });
const all = (p: Plan) => p.weeks.flatMap((w) => w.days.flatMap((d) => d.sessions.map((s) => ({ s, w, d }))));
const strength = (p: Plan) => all(p).filter((x) => x.s.type === "strength" && x.s.variant !== "primer");

describe("classic gym with ATG prehab", () => {
  const plan = generatePlan(gym(), ZLATKO_TODAY);

  it("alternates gym workout A and B across the whole plan", () => {
    const titles = strength(plan).map((x) => x.s.title);
    expect(titles.length).toBeGreaterThan(6);
    titles.forEach((t, i) => expect(t).toBe(i % 2 === 0 ? "Gym A" : "Gym B"));
  });

  it("gives every lift sets × reps to log, starting with the ATG warm-up; timed holds are ticked off", () => {
    const first = strength(plan)[0]!.s;
    expect(first.exercises?.[0]?.name).toBe("ATG warm-up");
    const rest = first.exercises!.slice(1);
    const lifts = rest.filter((x) => x.name !== "Copenhagen plank");
    expect(lifts.map((x) => x.name)).toContain("Back squat");
    for (const x of lifts) {
      expect(x.sets).toBeGreaterThan(0);
      expect(x.reps).toBeGreaterThan(0);
    }
    const hold = rest.find((x) => x.name === "Copenhagen plank");
    expect(hold).toMatchObject({ prescription: "2 × 20 s / side", pattern: "core" });
    expect(hold?.sets).toBeUndefined();
  });

  it("puts ATG prehab on the rest day instead of generic mobility", () => {
    const sunday = plan.weeks[0]!.days[6]!;
    expect(sunday.sessions.map((s) => s.title)).toEqual(["ATG prehab", "Recovery walk"]);
  });

  it("keeps ATG prehab on the usual strength days when strength steps down, and only a primer in the taper", () => {
    const peak = plan.weeks.find((w) => w.phase === "peak")!;
    const peakTitles = peak.days.flatMap((d) => d.sessions.map((s) => s.title));
    expect(peakTitles.filter((t) => t.startsWith("Gym"))).toHaveLength(1);
    expect(peakTitles.filter((t) => t === "ATG prehab").length).toBeGreaterThanOrEqual(2);
    const taper = plan.weeks.at(-1)!.days.flatMap((d) => d.sessions);
    expect(taper.filter((s: Session) => s.title.startsWith("Gym"))).toEqual([]);
    expect(taper.some((s) => s.title === "Primer (Gym)")).toBe(true);
  });

  it("trims a set in deload weeks", () => {
    const long = generatePlan(gym(withWeeks(12)), ZLATKO_TODAY);
    const deload = long.weeks.find((w) => w.deload)!;
    const normal = long.weeks.find((w) => w.phase === deload.phase && !w.deload)!;
    const squat = (w: Plan["weeks"][number]) =>
      w.days.flatMap((d) => d.sessions).flatMap((s) => s.exercises ?? []).find((x) => x.name === "Back squat" || x.name === "Deadlift");
    expect(squat(deload)!.sets).toBe(squat(normal)!.sets! - 1);
  });
});

describe("lifting helpers", () => {
  it("estimates a one-rep max and finds the best set", () => {
    expect(e1rm(100, 5)).toBeCloseTo(116.7, 1);
    expect(e1rm(100, 15)).toBe(0);
    expect(bestSet([{ kg: 100, reps: 5 }, { kg: 105, reps: 3 }, { kg: null, reps: 5 }])).toEqual({ kg: 100, reps: 5, e1rm: 116.7 });
  });

  it("suggests the next weight from last time", () => {
    const target = { sets: 4, reps: 5, increment: 5 };
    const hit = [100, 100, 100, 100].map((kg) => ({ kg, reps: 5 }));
    expect(suggestNext(target, hit)).toEqual({ kg: 105, note: "Every rep hit last time: try 105 kg." });
    expect(suggestNext(target, [...hit.slice(0, 3), { kg: 100, reps: 3 }])?.kg).toBe(100);
    expect(suggestNext(target, [...hit.slice(0, 3), { kg: 100, reps: 4 }])?.note).toMatch(/aim for all 4 × 5/);
    expect(suggestNext(target, [])).toBeNull();
  });

  it("offers swaps within the same movement pattern", () => {
    expect(alternativesFor({ name: "Back squat", prescription: "4 × 5", pattern: "squat" })).toContain("Front squat");
    expect(alternativesFor({ name: "Tibialis raises", prescription: "2 × 20" })).toEqual([]);
  });
});
