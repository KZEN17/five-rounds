import type { PlanInput } from "../input";

const noInjuries = { knee: false, lowerBack: false, neck: false, shoulder: false, ankle: false, other: false, notes: "" };

/**
 * Zlatko's legacy setup: hard BJJ Mon/Wed/Fri, open mat Saturday, bike + rower,
 * ATG twice a week, 3 hard rounds before survival, 4 matches × 5:00.
 * Plan starts Monday 2026-01-05; the competition is the Monday after week 8.
 */
export const ZLATKO_TODAY = new Date("2026-01-05T00:00:00Z");
export const zlatko: PlanInput = {
  version: 1,
  profile: { age: 35, sex: "male", heightCm: 180, weightKg: 82, belt: "purple", yearsTraining: 6, injuries: noInjuries },
  competition: {
    kind: "competition",
    name: "Spring Open",
    date: "2026-03-02",
    gi: "gi",
    weighIn: "same_day",
    targetWeightKg: 79,
    matchMinutes: 5,
    matches: 4,
    restMinutes: 20,
  },
  fitness: { baselineRounds: 3, restingHr: 52, sleepHours: 7.5, hrv: null, row2kSeconds: null, bike20AvgHr: null },
  availability: {
    bjj: [
      { day: 0, intensity: "hard" },
      { day: 2, intensity: "hard" },
      { day: 4, intensity: "hard" },
    ],
    openMatDay: 5,
    extraSessions: 3,
    extraMinutes: 45,
    preferredTime: "any",
  },
  equipment: ["bike", "rower"],
  strength: { style: "atg", daysPerWeek: 2, sessionMinutes: 45, customExercises: [] },
  nutrition: { activityFactor: 1.2, proteinGPerKg: 2, protectHardDays: true, dietaryNotes: "" },
};

/** Same athlete, competition `weeks` weeks out (the Monday after the last week). */
export function withWeeks(weeks: number, base: PlanInput = zlatko): PlanInput {
  const comp = new Date(ZLATKO_TODAY.getTime() + weeks * 7 * 86_400_000).toISOString().slice(0, 10);
  return { ...base, competition: { ...base.competition, date: comp } };
}

export function withInjuries(injuries: Partial<PlanInput["profile"]["injuries"]>, equipment: PlanInput["equipment"]): PlanInput {
  return {
    ...zlatko,
    equipment,
    profile: { ...zlatko.profile, injuries: { ...noInjuries, ...injuries } },
  };
}
