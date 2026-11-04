import { describe, expect, it } from "vitest";
import { LIMIT_BUFFER_KG, weighInDate, weightOutlook, type CalendarComp } from "../outlook";

const comp = (id: string, date: string, limitKg: number | null, extra: Partial<CalendarComp> = {}): CalendarComp => ({
  id,
  name: id,
  date,
  weighIn: "same_day",
  limitKg,
  isMain: false,
  ...extra,
});
const TODAY = "2026-01-05";

describe("weightOutlook", () => {
  it("treats the limit as a ceiling: at or under it is maintenance", () => {
    const o = weightOutlook({ date: TODAY, trendKg: 78, actualRateKg: null, comps: [comp("a", "2026-03-02", 79)] });
    expect(o.comps[0]!.status).toBe("on_weight");
    expect(o.dailyAdjustmentKcal).toBe(0);
    expect(o.drivingId).toBeNull();
  });

  it("aims a buffer under the limit and spreads the cut over every week but the last", () => {
    const o = weightOutlook({ date: TODAY, trendKg: 82, actualRateKg: null, comps: [comp("a", "2026-03-02", 79)] });
    const c = o.comps[0]!;
    expect(c.aimKg).toBe(79 - LIMIT_BUFFER_KG);
    expect(c.requiredRateKg).toBeCloseTo(3.5 / 7, 5); // 56 days → 7 weeks before the final week
    expect(c.status).toBe("needs_data");
    expect(o.drivingId).toBe("a");
    expect(o.dailyAdjustmentKcal).toBe(-Math.round(((3.5 / 7) * 7700) / 7));
    expect(o.finalWeekStart).toBe("2026-02-23");
  });

  it("uses the day before for day-before weigh-ins", () => {
    expect(weighInDate({ date: "2026-03-02", weighIn: "day_before" })).toBe("2026-03-01");
  });

  it("says on track or behind from the actual weekly rate", () => {
    const comps = [comp("a", "2026-03-02", 79)];
    expect(weightOutlook({ date: TODAY, trendKg: 82, actualRateKg: -0.5, comps }).comps[0]!.status).toBe("on_track");
    expect(weightOutlook({ date: TODAY, trendKg: 82, actualRateKg: -0.1, comps }).comps[0]!.status).toBe("behind");
    expect(weightOutlook({ date: TODAY, trendKg: 82, actualRateKg: 0.2, comps }).comps[0]!.message).toMatch(/gaining/);
  });

  it("over 1%/week: plans the safe 0.75% rate and reports the reachable weight", () => {
    const o = weightOutlook({ date: TODAY, trendKg: 82, actualRateKg: null, comps: [comp("a", "2026-02-02", 77)] });
    const c = o.comps[0]!;
    expect(c.status).toBe("infeasible");
    expect(c.reachableKg).toBeGreaterThan(c.aimKg!);
    expect(o.weeklyRateKg).toBeCloseTo(-82 * 0.0075, 5);
    expect(o.warnings.map((w) => w.code)).toContain("infeasible:a");
  });

  it("with several competitions, the one needing the fastest rate sets the deficit", () => {
    const o = weightOutlook({
      date: TODAY,
      trendKg: 82,
      actualRateKg: null,
      comps: [comp("far", "2026-05-04", 76), comp("near", "2026-02-09", 80)],
    });
    // near: 2.5 kg over in 4 weeks = 0.625/wk; far: 6.5 kg in 16 weeks ≈ 0.41/wk
    expect(o.drivingId).toBe("near");
    expect(o.comps.map((c) => c.id)).toEqual(["near", "far"]);
  });

  it("final week before the nearest weigh-in is maintenance, even if a later one needs cutting", () => {
    const o = weightOutlook({
      date: TODAY,
      trendKg: 82,
      actualRateKg: null,
      comps: [comp("soon", "2026-01-10", 81), comp("later", "2026-04-06", 77)],
    });
    expect(o.inFinalWeek).toBe(true);
    expect(o.dailyAdjustmentKcal).toBe(0);
    expect(o.comps[0]!.status).toBe("final_week");
    expect(o.comps[0]!.message).toMatch(/Don't crash diet/);
  });

  it("ignores past competitions and ones without a limit", () => {
    const o = weightOutlook({
      date: TODAY,
      trendKg: 82,
      actualRateKg: null,
      comps: [comp("past", "2025-12-01", 70), comp("open", "2026-03-02", null)],
    });
    expect(o.comps.map((c) => [c.id, c.status])).toEqual([["open", "no_limit"]]);
    expect(o.dailyAdjustmentKcal).toBe(0);
  });
});
