import { z } from "zod";
import { addDays, type IsoDate } from "./dates";

/** 0 = Monday … 6 = Sunday. */
export const weekday = z.number().int().min(0).max(6);

export const BELTS = ["white", "blue", "purple", "brown", "black"] as const;
export const EQUIPMENT = [
  "bike",
  "rower",
  "assault_bike",
  "treadmill",
  "outdoor_run",
  "pool",
  "barbell",
  "kettlebell",
  "bands",
  "none",
] as const;
export const STRENGTH_STYLES = ["atg", "barbell", "kettlebell", "bodyweight", "custom"] as const;
export const ACTIVITY_FACTORS = [1.2, 1.375, 1.5] as const;

export const injuriesInput = z.object({
  knee: z.boolean(),
  lowerBack: z.boolean(),
  neck: z.boolean(),
  shoulder: z.boolean(),
  ankle: z.boolean(),
  other: z.boolean(),
  notes: z.string().trim().max(500),
});

export const profileInput = z.object({
  age: z.number().int().min(18, "Five Rounds is for adults (18+).").max(100),
  sex: z.enum(["male", "female"]),
  heightCm: z.number().min(120).max(230),
  weightKg: z.number().min(35).max(250),
  belt: z.enum(BELTS),
  yearsTraining: z.number().min(0).max(60),
  injuries: injuriesInput,
});

export const competitionInput = z.object({
  kind: z.enum(["competition", "test"]),
  name: z.string().trim().max(120),
  date: z.iso.date(),
  gi: z.enum(["gi", "nogi"]),
  weighIn: z.enum(["same_day", "day_before", "unsure"]),
  targetWeightKg: z.number().min(35).max(250).nullable(),
  matchMinutes: z.number().min(2).max(15),
  matches: z.number().int().min(1).max(10),
  restMinutes: z.number().min(0).max(240),
});

export const fitnessInput = z.object({
  baselineRounds: z.number().int().min(1).max(8),
  restingHr: z.number().int().min(30).max(120).nullable(),
  sleepHours: z.number().min(3).max(12).nullable(),
  hrv: z.number().min(5).max(250).nullable(),
  row2kSeconds: z.number().int().min(300).max(900).nullable(),
  bike20AvgHr: z.number().int().min(80).max(210).nullable(),
});

export const availabilityInput = z.object({
  bjj: z
    .array(z.object({ day: weekday, intensity: z.enum(["hard", "technical"]) }))
    .max(7)
    .refine((list) => new Set(list.map((c) => c.day)).size === list.length, "One class per day."),
  openMatDay: weekday.nullable(),
  extraSessions: z.number().int().min(1).max(4),
  extraMinutes: z.number().int().min(15).max(120),
  preferredTime: z.enum(["morning", "midday", "evening", "any"]),
});

export const strengthInput = z.object({
  style: z.enum(STRENGTH_STYLES),
  daysPerWeek: z.number().int().min(0).max(3),
  sessionMinutes: z.number().int().min(15).max(120),
  customExercises: z.array(z.string().trim().min(1).max(80)).max(20),
});

export const nutritionInput = z.object({
  activityFactor: z.union(ACTIVITY_FACTORS.map((f) => z.literal(f))),
  proteinGPerKg: z.number().min(1.6).max(2.2),
  protectHardDays: z.boolean(),
  dietaryNotes: z.string().trim().max(500),
});

export const planInputSchema = z.object({
  version: z.literal(1),
  profile: profileInput,
  competition: competitionInput,
  fitness: fitnessInput,
  availability: availabilityInput,
  equipment: z.array(z.enum(EQUIPMENT)),
  strength: strengthInput,
  nutrition: nutritionInput,
});

export type PlanInput = z.infer<typeof planInputSchema>;
export type Injuries = z.infer<typeof injuriesInput>;
export type Equipment = (typeof EQUIPMENT)[number];
export type StrengthStyle = (typeof STRENGTH_STYLES)[number];

/** Sensible starting answers for the onboarding wizard. */
export function defaultPlanInput(today: IsoDate): PlanInput {
  return {
    version: 1,
    profile: {
      age: 30,
      sex: "male",
      heightCm: 178,
      weightKg: 80,
      belt: "blue",
      yearsTraining: 3,
      injuries: { knee: false, lowerBack: false, neck: false, shoulder: false, ankle: false, other: false, notes: "" },
    },
    competition: {
      kind: "competition",
      name: "",
      date: addDays(today, 56),
      gi: "gi",
      weighIn: "same_day",
      targetWeightKg: null,
      matchMinutes: 5,
      matches: 4,
      restMinutes: 20,
    },
    fitness: { baselineRounds: 3, restingHr: null, sleepHours: null, hrv: null, row2kSeconds: null, bike20AvgHr: null },
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
    equipment: ["bike"],
    strength: { style: "bodyweight", daysPerWeek: 2, sessionMinutes: 45, customExercises: [] },
    nutrition: { activityFactor: 1.2, proteinGPerKg: 2, protectHardDays: true, dietaryNotes: "" },
  };
}
