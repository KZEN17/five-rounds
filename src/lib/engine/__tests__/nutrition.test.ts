import { describe, expect, it } from "vitest";
import { withWeeks, zlatko } from "../__fixtures__/inputs";
import type { PlanInput } from "../input";
import { bmr, dayTarget, planNutrition, sessionBurn, weekAdjustments } from "../nutrition";

const target = (kg: number | null, weeks = 8, weightKg = 82): PlanInput => {
  const base = withWeeks(weeks);
  return {
    ...base,
    profile: { ...base.profile, weightKg },
    competition: { ...base.competition, targetWeightKg: kg },
  };
};

describe("planNutrition", () => {
  it("cut: spreads the change over every week but the last", () => {
    const n = planNutrition(target(79), 8, "2026-03-02");
    expect(n.goal).toBe("cut");
    expect(n.weeklyRateKg).toBeCloseTo(-3 / 7, 5);
    expect(n.dailyAdjustmentKcal).toBe(-Math.round(((3 / 7) * 7700) / 7));
    expect(n.feasible).toBe(true);
    expect(n.finalWeekStart).toBe("2026-02-23");
  });

  it("cut above 0.75%/week: planned, with a warning", () => {
    const n = planNutrition(target(77), 8, "2026-03-02");
    expect(n.requiredRatePct).toBeGreaterThan(0.75);
    expect(n.warnings.map((w) => w.code)).toContain("cut-aggressive");
    expect(n.feasible).toBe(true);
  });

  it("infeasible cut: refuses above 1%/week, plans the safe rate and shows the reachable weight", () => {
    const n = planNutrition(target(74), 8, "2026-03-02");
    expect(n.feasible).toBe(false);
    expect(n.weeklyRateKg).toBeCloseTo(-82 * 0.0075, 5);
    expect(n.reachableWeightKg).toBeCloseTo(82 - 82 * 0.0075 * 7, 1);
    expect(n.warnings.find((w) => w.code === "cut-infeasible")?.message).toMatch(/division up or a later competition/);
  });

  it("gain: 250–350 kcal surplus", () => {
    const slow = planNutrition(target(84, 12, 82), 12, "2026-03-30");
    expect(slow.goal).toBe("gain");
    expect(slow.dailyAdjustmentKcal).toBe(250);
    const fast = planNutrition(target(88, 8, 82), 8, "2026-03-02");
    expect(fast.dailyAdjustmentKcal).toBe(350);
    expect(fast.warnings.map((w) => w.code)).toEqual(expect.arrayContaining(["gain-fast", "gain-infeasible"]));
  });

  it("maintain: no target, or within half a kilo", () => {
    expect(planNutrition(target(null), 8, "2026-03-02").goal).toBe("maintain");
    expect(planNutrition(target(81.7), 8, "2026-03-02").dailyAdjustmentKcal).toBe(0);
  });

  it("always says plainly when weigh-in is right before the first match", () => {
    expect(planNutrition(zlatko, 8, "2026-03-02").warnings.map((w) => w.code)).toContain("weigh-in-same-day");
  });
});

describe("weekAdjustments with protect hard days", () => {
  const week = [true, false, true, false, true, true, false].map((hard, i) => ({ date: `2026-01-0${5 + i}`, hard }));

  it("halves the deficit on hard days and keeps the weekly total the same", () => {
    const out = weekAdjustments(week, -471, true);
    expect(Object.values(out).reduce((a, b) => a + b, 0)).toBe(-471 * 7);
    expect(out["2026-01-05"]).toBe(Math.round(-471 / 2));
    expect(out["2026-01-06"]!).toBeLessThan(-471);
  });

  it("is flat without protection, or for a surplus", () => {
    expect(new Set(Object.values(weekAdjustments(week, -471, false)))).toEqual(new Set([-471]));
    expect(new Set(Object.values(weekAdjustments(week, 300, true)))).toEqual(new Set([300]));
  });
});

describe("dayTarget", () => {
  const profile = { sex: "male" as const, age: 35, heightCm: 180 };
  const bjj = { title: "Hard BJJ", type: "bjj" as const, modality: "mat" as const, intensity: "hard" as const, minutes: 90 };

  it("builds BMR × activity + session burn ± adjustment, with logged minutes winning", () => {
    const t = dayTarget({ profile, weightKg: 82, activityFactor: 1.2, proteinGPerKg: 2, sessions: [{ ...bjj, loggedMinutes: 60 }], adjustmentKcal: -200 });
    expect(t.bmr).toBe(Math.round(bmr(profile, 82)));
    expect(t.burns[0]).toEqual({ title: "Hard BJJ", minutes: 60, kcal: Math.round((9 * 82 * 60) / 60) });
    expect(t.target).toBe(t.maintenance - 200);
    expect(t.proteinG).toBe(164);
  });

  it("never goes below BMR", () => {
    const t = dayTarget({ profile, weightKg: 82, activityFactor: 1.2, proteinGPerKg: 2, sessions: [], adjustmentKcal: -1500 });
    expect(t.target).toBe(t.bmr);
    expect(t.floorApplied).toBe(true);
  });

  it("on a hard day takes the deficit from fat first to protect 3 g/kg carbs", () => {
    // A small deficit: dropping fat a little is enough to keep 3 g/kg carbs.
    const mild = dayTarget({ profile, weightKg: 82, activityFactor: 1.2, proteinGPerKg: 2.2, sessions: [bjj], adjustmentKcal: -1000 });
    expect(mild.fatG).toBeLessThan(Math.round(0.8 * 82));
    expect(mild.fatG).toBeGreaterThan(Math.round(0.6 * 82));
    expect(mild.carbsG).toBeGreaterThanOrEqual(3 * 82);
    expect(mild.warnings).toEqual([]);
    // A big one: fat stops at the 0.6 g/kg floor and the shortfall is flagged.
    const big = dayTarget({ profile, weightKg: 82, activityFactor: 1.2, proteinGPerKg: 2.2, sessions: [bjj], adjustmentKcal: -1200 });
    expect(big.fatG).toBe(Math.round(0.6 * 82));
    expect(big.warnings.map((w) => w.code)).toContain("carb-floor");
  });

  it("estimates burn as (MET − 1) × kg × hours", () => {
    expect(sessionBurn({ type: "aerobic", modality: "bike", minutes: 30 }, 80).kcal).toBe(Math.round(4.5 * 80 * 0.5));
  });
});
