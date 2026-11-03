import { describe, expect, it } from "vitest";
import { ZLATKO_TODAY, withInjuries, withWeeks, zlatko } from "../__fixtures__/inputs";
import { pickModality } from "../conditioning";
import { generatePlan } from "../generate";
import type { PlanInput } from "../input";
import { splitPhases } from "../phases";
import type { Plan, Session } from "../types";

const isHardCond = (s: Session) => s.type === "comp_sim" || s.type === "intervals";
const isHard = (s: Session) => s.intensity === "hard";

describe("phase splits", () => {
  const count = (weeks: number) => {
    const { phases, deload } = splitPhases(weeks);
    const n = (p: string) => phases.filter((x) => x === p).length;
    return { base: n("base"), general: n("general"), specific: n("specific"), peak: n("peak"), taper: n("taper"), deloads: deload.flatMap((d, i) => (d ? [i + 1] : [])) };
  };
  it.each([
    [3, { base: 0, general: 0, specific: 1, peak: 1, taper: 1, deloads: [] }],
    [6, { base: 0, general: 2, specific: 2, peak: 1, taper: 1, deloads: [] }],
    [8, { base: 0, general: 3, specific: 3, peak: 1, taper: 1, deloads: [] }],
    [12, { base: 0, general: 5, specific: 4, peak: 2, taper: 1, deloads: [4, 8] }],
    [20, { base: 4, general: 6, specific: 6, peak: 3, taper: 1, deloads: [4, 8, 12, 16] }],
  ])("%i weeks", (weeks, expected) => {
    expect(count(weeks)).toEqual(expected);
    expect(splitPhases(weeks).phases).toHaveLength(weeks);
  });

  it("builds a sharpen + taper plan under 3 weeks, with a warning", () => {
    expect(splitPhases(2).phases).toEqual(["specific", "taper"]);
    const plan = generatePlan(withWeeks(2), ZLATKO_TODAY);
    expect(plan.warnings.map((w) => w.code)).toContain("short-plan");
  });

  it("uses a 10-day taper from 10 weeks", () => {
    expect(splitPhases(9).taperDays).toBe(7);
    expect(splitPhases(10).taperDays).toBe(10);
  });
});

// A spread of schedules to check the weekly rules against.
const SCHEDULES: PlanInput["availability"]["bjj"][] = [
  [{ day: 0, intensity: "hard" }, { day: 2, intensity: "hard" }, { day: 4, intensity: "hard" }],
  [{ day: 1, intensity: "hard" }, { day: 3, intensity: "technical" }],
  [{ day: 0, intensity: "technical" }, { day: 1, intensity: "hard" }, { day: 2, intensity: "technical" }, { day: 3, intensity: "hard" }],
  [{ day: 0, intensity: "hard" }, { day: 1, intensity: "hard" }, { day: 2, intensity: "hard" }, { day: 3, intensity: "hard" }, { day: 4, intensity: "hard" }],
  [],
];
const plans: [string, Plan, PlanInput][] = [];
for (const [i, bjj] of SCHEDULES.entries()) {
  for (const weeks of [6, 12, 20]) {
    for (const extraSessions of [1, 2, 4]) {
      const input: PlanInput = {
        ...withWeeks(weeks),
        availability: { ...zlatko.availability, bjj, extraSessions, openMatDay: i === 4 ? null : 5 },
      };
      plans.push([`schedule ${i}, ${weeks} weeks, ${extraSessions} extras`, generatePlan(input, ZLATKO_TODAY), input]);
    }
  }
}

describe.each(plans)("weekly rules: %s", (_name, plan, input) => {
  const hardBjj = new Set(input.availability.bjj.filter((c) => c.intensity === "hard").map((c) => c.day));

  it("has at most 2 hard conditioning sessions a week, and 1 in the taper", () => {
    for (const w of plan.weeks) {
      const n = w.days.flatMap((d) => d.sessions).filter(isHardCond).length;
      expect(n).toBeLessThanOrEqual(w.phase === "taper" ? 1 : 2);
    }
  });

  it("never puts hard conditioning the day before a hard BJJ day", () => {
    for (const w of plan.weeks) {
      for (const d of w.days) {
        if (d.sessions.some(isHardCond)) expect(hardBjj.has((d.weekday + 1) % 7)).toBe(false);
      }
    }
  });

  it("never adds hard conditioning that makes 3 hard days in a row", () => {
    // The athlete's own classes may already be back to back; the plan must not add to that.
    const days = plan.weeks.flatMap((w) => w.days);
    days.forEach((d, i) => {
      if (!d.sessions.some(isHardCond)) return;
      for (let a = Math.max(0, i - 2); a <= i && a + 2 < days.length; a++) {
        const run = [days[a]!, days[a + 1]!, days[a + 2]!].filter((x) => x.sessions.some(isHard)).length;
        expect(run, d.date).toBeLessThan(3);
      }
    });
  });

  it("keeps the extra-session cap", () => {
    for (const w of plan.weeks) {
      const extras = w.days.flatMap((d) => d.sessions).filter((s) => s.type === "aerobic" || isHardCond(s)).length;
      expect(extras).toBeLessThanOrEqual(input.availability.extraSessions);
    }
  });

  it("does no heavy strength in the last 7 days", () => {
    const last = plan.weeks.at(-1)!;
    const heavy = last.days.flatMap((d) => d.sessions).filter((s) => s.type === "strength" && s.variant !== "primer");
    expect(heavy).toEqual([]);
  });
});

describe("taper", () => {
  const volume = (plan: Plan, w: number) =>
    plan.weeks[w]!.days.flatMap((d) => d.sessions)
      .filter((s) => s.type === "aerobic" || isHardCond(s))
      .reduce((sum, s) => sum + (s.minutes ?? 0), 0);

  it("cuts conditioning volume by 40–60% against peak in a 12-week plan", () => {
    const plan = generatePlan(withWeeks(12), ZLATKO_TODAY);
    const peak = Math.max(...plan.weeks.flatMap((w, i) => (w.phase === "peak" ? [volume(plan, i)] : [])));
    const taper = volume(plan, 11);
    expect(taper / peak).toBeGreaterThanOrEqual(0.4);
    expect(taper / peak).toBeLessThanOrEqual(0.6);
  });

  it("deloads every 4th week in longer plans", () => {
    const plan = generatePlan(withWeeks(12), ZLATKO_TODAY);
    expect(volume(plan, 3)).toBeLessThan(volume(plan, 2));
    expect(plan.weeks[3]!.deload).toBe(true);
  });
});

describe("injury filters", () => {
  it("knee or ankle: bike or rower instead of running and the assault bike", () => {
    expect(pickModality("intervals", ["treadmill", "assault_bike", "bike"], withInjuries({ knee: true }, []).profile.injuries).modality).toBe("bike");
    expect(pickModality("aerobic", ["outdoor_run", "rower"], withInjuries({ ankle: true }, []).profile.injuries).modality).toBe("rower");
  });

  it("lower back: the bike instead of the rower", () => {
    const plan = generatePlan(withInjuries({ lowerBack: true }, ["bike", "rower"]), ZLATKO_TODAY);
    const intervals = plan.weeks.flatMap((w) => w.days.flatMap((d) => d.sessions)).filter((s) => s.type === "intervals");
    expect(intervals.length).toBeGreaterThan(0);
    expect(intervals.every((s) => s.modality === "bike")).toBe(true);
  });

  it("shoulder: no rower or assault-bike intervals when there's a bike", () => {
    const { injuries } = withInjuries({ shoulder: true }, []).profile;
    expect(pickModality("intervals", ["rower", "assault_bike", "bike"], injuries).modality).toBe("bike");
  });

  it("warns when the only machine is a risky one", () => {
    const plan = generatePlan(withInjuries({ knee: true }, ["treadmill"]), ZLATKO_TODAY);
    expect(plan.warnings.map((w) => w.code)).toContain("injury-modality");
  });
});
