import type { IsoDate } from "./dates";

export type Phase = "base" | "general" | "specific" | "peak" | "taper";

export type SessionType =
  | "bjj"
  | "bjj_technical"
  | "open_mat"
  | "comp_sim"
  | "intervals"
  | "aerobic"
  | "strength"
  | "mobility"
  | "walk"
  | "competition"
  | "custom";

export type Modality = "mat" | "bike" | "rower" | "assault_bike" | "run" | "swim" | "walk" | "gym" | "none";
export type Intensity = "easy" | "moderate" | "hard";
export type TimeOfDay = "morning" | "midday" | "evening";

/** Finer kind inside a type: ATG strength, threshold intervals, a taper primer. */
export type Variant = "atg" | "threshold" | "primer";

export type Exercise = { name: string; prescription: string; notes?: string };

export type Session = {
  type: SessionType;
  title: string;
  minutes?: number;
  rounds?: number;
  workSec?: number;
  restSec?: number;
  intensity: Intensity;
  modality: Modality;
  purpose: string;
  notes: string;
  variant?: Variant;
  exercises?: Exercise[];
  timeOfDay?: TimeOfDay;
};

export type PlanDay = { date: IsoDate; weekday: number; sessions: Session[]; rest: boolean };

export type PlanWeek = { index: number; start: IsoDate; phase: Phase; deload: boolean; days: PlanDay[] };

export type Warning = { code: string; message: string };

export type NutritionPlan = {
  goal: "cut" | "gain" | "maintain";
  startWeightKg: number;
  targetWeightKg: number | null;
  /** Planned change per week, signed (negative = losing). */
  weeklyRateKg: number;
  /** Planned calories vs maintenance per day, signed, for every week except the final one. */
  dailyAdjustmentKcal: number;
  /** Rate needed to make weight, as % of bodyweight per week. */
  requiredRatePct: number | null;
  feasible: boolean;
  reachableWeightKg: number | null;
  proteinGPerKg: number;
  activityFactor: number;
  protectHardDays: boolean;
  /** From this date on, eat at maintenance. */
  finalWeekStart: IsoDate;
  warnings: Warning[];
};

export type Plan = {
  engineVersion: 1;
  generatedOn: IsoDate;
  start: IsoDate;
  compDate: IsoDate;
  shortCamp: boolean;
  rounds: { start: number; target: number; workSec: number; restSec: number };
  weeks: PlanWeek[];
  nutrition: NutritionPlan;
  warnings: Warning[];
};

export const HARD_CONDITIONING: readonly SessionType[] = ["comp_sim", "intervals"];
