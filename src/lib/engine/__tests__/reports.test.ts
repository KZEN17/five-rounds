import { describe, expect, it } from "vitest";
import { dailyReport, pushText, weeklyReport, type DayFacts, type PaceFacts, type WeekFacts } from "../reports";

const day = (over: Partial<DayFacts> = {}): DayFacts => ({
  date: "2026-01-06",
  planned: 3,
  done: 3,
  hardRounds: 5,
  avgRpe: 7,
  missed: [],
  food: { logged: true, kcal: 2560, target: 2600, protein: 165, proteinTarget: 164 },
  weighedIn: true,
  daysSinceWeighIn: 0,
  readinessFlags: [],
  nextPlan: ["Comp sim 4 × 5:00"],
  ...over,
});
const pace = (requiredRateKg: number, status: NonNullable<PaceFacts>["status"] = "on_track"): PaceFacts => ({
  compId: "c1",
  compName: "Club open",
  status,
  requiredRateKg,
  trendKg: 81,
  aimKg: 78.5,
  daysToWeighIn: 40,
});

describe("dailyReport", () => {
  it("praises a great day with the specifics", () => {
    const r = dailyReport(day(), pace(0.45), 0.45);
    expect(r.tone).toBe("great");
    expect(r.headline).toBe("Yesterday was a great day.");
    expect(r.highlights).toEqual(expect.arrayContaining(["All 3 sessions done, 5 hard rounds at RPE 7.", "Calories on target: 2,560 of 2,600 kcal.", "Protein hit: 165/164 g."]));
    expect(r.concerns).toEqual([]);
    expect(r.nextStep).toBe("Today: Comp sim 4 × 5:00.");
  });

  it("says plainly when a day slipped, and that the target is getting further", () => {
    const r = dailyReport(
      day({ done: 0, missed: ["Hard BJJ", "Bike 30 min"], food: { logged: true, kcal: 3100, target: 2600, protein: 120, proteinTarget: 164 }, weighedIn: false, daysSinceWeighIn: 5 }),
      pace(0.62),
      0.45,
    );
    expect(r.tone).toBe("off");
    expect(r.headline).toBe("Yesterday slipped.");
    expect(r.concerns.join(" ")).toMatch(/None of the 3 planned sessions/);
    expect(r.concerns.join(" ")).toMatch(/500 kcal over target/);
    expect(r.concerns.join(" ")).toMatch(/No weigh-in for 5 days/);
    expect(r.concerns.join(" ")).toMatch(/getting further away: you now need 0\.62 kg\/week .* up from 0\.45/);
    expect(r.nextStep).toMatch(/One good day turns the trend around/);
  });

  it("calls out getting closer, and stays quiet without a baseline", () => {
    expect(dailyReport(day(), pace(0.4), 0.5).highlights.join(" ")).toMatch(/getting closer/);
    const first = dailyReport(day(), pace(0.9), null);
    expect(first.concerns.join(" ")).not.toMatch(/further/);
  });

  it("treats a rest day kindly and nudges missing food logs", () => {
    expect(dailyReport(day({ planned: 0, done: 0, hardRounds: 0, avgRpe: null }), null, null).tone).toBe("rest");
    const noFood = dailyReport(day({ food: { logged: false, kcal: 0, target: 2600, protein: 0, proteinTarget: 164 } }), null, null);
    expect(noFood.concerns.join(" ")).toMatch(/No food logged/);
    expect(noFood.nextStep).toMatch(/Log your food/);
  });

  it("makes a short push text", () => {
    const t = pushText(dailyReport(day(), null, null));
    expect(t.title).toBe("Yesterday was a great day.");
    expect(t.body.length).toBeLessThanOrEqual(220);
  });
});

const week = (over: Partial<WeekFacts> = {}): WeekFacts => ({
  start: "2026-01-05",
  end: "2026-01-11",
  planned: 12,
  done: 11,
  hardPlanned: 4,
  hardDone: 4,
  daysFoodLogged: 7,
  daysOnTarget: 6,
  daysOver: 1,
  proteinDays: 6,
  weighIns: 6,
  trendStart: 82,
  trendEnd: 81.5,
  simFinalRpe: { first: 9, last: 8 },
  flaggedDays: 0,
  nextWeekPlanned: 12,
  nextWeekHard: 4,
  ...over,
});

describe("weeklyReport", () => {
  it("celebrates a strong week", () => {
    const r = weeklyReport(week(), pace(0.5), 0.5);
    expect(r.tone).toBe("great");
    expect(r.headline).toBe("Last week was great progress.");
    expect(r.highlights.join(" ")).toMatch(/11\/12 sessions done \(92%\)/);
    expect(r.highlights.join(" ")).toMatch(/Trend weight -0\.5 kg: right on pace for Club open/);
    expect(r.highlights.join(" ")).toMatch(/RPE 9 to 8/);
  });

  it("is honest about a weak week, and copes with missing data", () => {
    const r = weeklyReport(
      week({ done: 5, daysFoodLogged: 2, weighIns: 0, trendStart: null, trendEnd: null, simFinalRpe: null, flaggedDays: 3 }),
      pace(0.7),
      0.5,
    );
    expect(r.tone).toBe("off");
    expect(r.concerns.join(" ")).toMatch(/Food logged on only 2 of 7 days/);
    expect(r.concerns.join(" ")).toMatch(/Only 0 weigh-ins/);
    expect(r.concerns.join(" ")).toMatch(/getting further away/);
    expect(r.nextStep).toMatch(/Start with today's session/);
  });

  it("flags weight going the wrong way", () => {
    const r = weeklyReport(week({ trendStart: 81, trendEnd: 81.6 }), pace(0.5), null);
    expect(r.concerns.join(" ")).toMatch(/went up 0\.6 kg/);
  });
});
