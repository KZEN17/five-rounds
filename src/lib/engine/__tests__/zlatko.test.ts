import { describe, expect, it } from "vitest";
import { ZLATKO_TODAY, zlatko } from "../__fixtures__/inputs";
import { generatePlan } from "../generate";
import type { Plan } from "../types";

const plan = generatePlan(zlatko, ZLATKO_TODAY);
const day = (p: Plan, week: number, weekday: number) => p.weeks[week]!.days[weekday]!;
const types = (p: Plan, week: number, weekday: number) => day(p, week, weekday).sessions.map((s) => s.type);

// The original app's hand-written arrays: BIKE, SIM, ROW.
const LEGACY_BIKE = [[30, 30], [35, 30], [35, 35], [40, 35], [40, 40], [45, 40], [45, 45], [30, 30]];
const LEGACY_SATURDAY = [
  ["comp_sim", 3],
  ["intervals", 3],
  ["comp_sim", 4],
  ["intervals", 4],
  ["comp_sim", 4],
  ["intervals", 5],
  ["comp_sim", 5],
  ["intervals", 3],
] as const;

describe("Zlatko's inputs reproduce the legacy 8-week plan", () => {
  it("is 8 weeks: 3 general, 3 specific, 1 peak, 1 taper, no deload", () => {
    expect(plan.weeks.map((w) => w.phase)).toEqual([
      "general", "general", "general", "specific", "specific", "specific", "peak", "taper",
    ]);
    expect(plan.weeks.some((w) => w.deload)).toBe(false);
    expect(plan.shortCamp).toBe(true);
  });

  it("puts hard BJJ on Mon/Wed/Fri every week", () => {
    for (let w = 0; w < 8; w++) for (const d of [0, 2, 4]) expect(types(plan, w, d)).toEqual(["bjj"]);
  });

  it("has Tue/Thu bike at the legacy minutes, 30 → 45, back to 30 in week 8", () => {
    const bikes = plan.weeks.map((_, w) =>
      [1, 3].map((d) => day(plan, w, d).sessions.find((s) => s.type === "aerobic" && s.modality === "bike")?.minutes),
    );
    expect(bikes).toEqual(LEGACY_BIKE);
  });

  it("alternates Saturday comp sim and rowing at 3 → 5 rounds × 5:00 / 1:00, 3 in week 8", () => {
    const saturday = plan.weeks.map((_, w) => {
      const hard = day(plan, w, 5).sessions.find((s) => s.type === "comp_sim" || s.type === "intervals")!;
      expect(hard.workSec).toBe(300);
      expect(hard.restSec).toBe(60);
      if (hard.type === "intervals") expect(hard.modality).toBe("rower");
      return [hard.type, hard.rounds];
    });
    expect(saturday).toEqual(LEGACY_SATURDAY);
  });

  it("keeps ATG with the Tue/Thu bike, and Sunday as ATG + recovery walk", () => {
    for (let w = 0; w < 8; w++) {
      for (const d of [1, 3]) expect(day(plan, w, d).sessions.some((s) => s.variant === "atg")).toBe(true);
      expect(types(plan, w, 6)).toEqual(["mobility", "walk"]);
      expect(day(plan, w, 6).rest).toBe(true);
    }
  });

  it("makes week 8 lighter than week 7", () => {
    const load = (w: number) =>
      plan.weeks[w]!.days.flatMap((d) => d.sessions)
        .filter((s) => s.type === "aerobic" || s.type === "comp_sim" || s.type === "intervals")
        .reduce((sum, s) => sum + (s.minutes ?? 0), 0);
    expect(load(7)).toBeLessThan(load(6) * 0.7);
  });

  it("matches the stored snapshot", () => {
    const summary = plan.weeks.map((w) => ({
      week: w.index,
      phase: w.phase,
      days: w.days.map((d) => d.sessions.map((s) => s.title).join(" + ") || "—"),
    }));
    expect(summary).toMatchSnapshot();
  });
});
