import { addDays, type IsoDate } from "./dates";
import type { PlanInput } from "./input";
import type { Modality, NutritionPlan, Session, SessionType, Variant, Warning } from "./types";

export const KCAL_PER_KG = 7700;

export function bmr(p: { sex: "male" | "female"; age: number; heightCm: number }, weightKg: number): number {
  return 10 * weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === "female" ? -161 : 5);
}

type BurnSession = Pick<Session, "type" | "modality"> & Partial<Pick<Session, "minutes" | "rounds" | "workSec" | "restSec" | "variant">>;

/** METs per the brief; unlisted combinations are our estimates. */
export function metFor(s: { type: SessionType; modality: Modality; variant?: Variant }): number {
  switch (s.type) {
    case "bjj":
      return 10;
    case "bjj_technical":
      return 7;
    case "open_mat":
      return 8;
    case "comp_sim":
    case "competition":
      return 10.5;
    case "intervals":
      return s.modality === "assault_bike" || s.modality === "run" ? 9 : 8.5;
    case "aerobic":
      return s.modality === "swim" || s.modality === "run" ? 7 : s.modality === "walk" ? 3.5 : 5.5;
    case "strength":
      return s.variant === "atg" ? 4 : 5;
    case "mobility":
      return 4;
    case "walk":
      return 3.5;
    default:
      return 6;
  }
}

export function plannedMinutes(s: BurnSession): number {
  if (s.minutes) return s.minutes;
  if (s.rounds && s.workSec) return Math.ceil((s.rounds * s.workSec + (s.rounds - 1) * (s.restSec ?? 60)) / 60) + 15;
  switch (s.type) {
    case "bjj":
    case "open_mat":
      return 90;
    case "bjj_technical":
      return 75;
    case "walk":
      return 40;
    case "mobility":
      return 20;
    default:
      return 45;
  }
}

/** kcal above resting: (MET − 1) × kg × hours. Logged minutes replace planned ones. */
export function sessionBurn(s: BurnSession, weightKg: number, loggedMinutes?: number | null) {
  const minutes = loggedMinutes && loggedMinutes > 0 ? loggedMinutes : plannedMinutes(s);
  return { minutes, kcal: Math.round(((metFor(s) - 1) * weightKg * minutes) / 60) };
}

const FINAL_WEEK =
  "Final week: keep food and fluid normal. For any planned weight manipulation beyond this, work with a qualified sports dietitian.";

export function planNutrition(input: PlanInput, weeks: number, compDate: IsoDate): NutritionPlan {
  const current = input.profile.weightKg;
  const target = input.competition.targetWeightKg;
  const weeksToChange = Math.max(0, weeks - 1);
  const warnings: Warning[] = [];

  if (input.competition.weighIn === "same_day") {
    warnings.push({
      code: "weigh-in-same-day",
      message: "Your weigh-in is right before your first match, so you need to be on weight walking in. This plan never uses water cutting or dehydration.",
    });
  } else if (input.competition.weighIn === "unsure") {
    warnings.push({
      code: "weigh-in-unsure",
      message: "Find out when weigh-ins are. Plan to be on weight with food and fluid normal. This plan never uses water cutting.",
    });
  }
  warnings.push({ code: "final-week", message: FINAL_WEEK });

  const base = {
    startWeightKg: current,
    targetWeightKg: target,
    proteinGPerKg: input.nutrition.proteinGPerKg,
    activityFactor: input.nutrition.activityFactor,
    protectHardDays: input.nutrition.protectHardDays,
    finalWeekStart: addDays(compDate, -7),
    warnings,
  };
  const maintain: NutritionPlan = {
    ...base,
    goal: "maintain",
    weeklyRateKg: 0,
    dailyAdjustmentKcal: 0,
    requiredRatePct: null,
    feasible: true,
    reachableWeightKg: null,
  };

  const change = target == null ? 0 : target - current;
  if (Math.abs(change) < 0.5 || target == null) return maintain;

  if (weeksToChange === 0) {
    warnings.push({
      code: "no-time",
      message: `There's no time left to change weight safely. Compete at about ${current} kg, or pick a later competition.`,
    });
    return { ...maintain, goal: change < 0 ? "cut" : "gain", feasible: false, reachableWeightKg: current };
  }

  const required = Math.abs(change) / weeksToChange;
  const requiredPct = (required / current) * 100;
  const round1 = (v: number) => Math.round(v * 10) / 10;

  if (change < 0) {
    let rate = required;
    let feasible = true;
    let reachable: number | null = null;
    if (requiredPct > 1) {
      rate = current * 0.0075;
      feasible = false;
      reachable = round1(current - rate * weeksToChange);
      warnings.push({
        code: "cut-infeasible",
        message: `Reaching ${target} kg would take ${requiredPct.toFixed(1)}% of your bodyweight a week, over the 1% limit. At a safe rate you'd reach about ${reachable} kg. Consider the next division up or a later competition.`,
      });
    } else if (requiredPct > 0.75) {
      warnings.push({
        code: "cut-aggressive",
        message: `This cut needs ${requiredPct.toFixed(2)}% of your bodyweight a week, above the 0.75% that protects training quality. Expect your rounds to suffer.`,
      });
    }
    return {
      ...base,
      goal: "cut",
      weeklyRateKg: -rate,
      dailyAdjustmentKcal: -Math.round((rate * KCAL_PER_KG) / 7),
      requiredRatePct: requiredPct,
      feasible,
      reachableWeightKg: reachable,
    };
  }

  const surplus = Math.min(350, Math.max(250, Math.round((required * KCAL_PER_KG) / 7)));
  const rate = (surplus * 7) / KCAL_PER_KG;
  const reachable = round1(current + rate * weeksToChange);
  const feasible = reachable >= target - 0.25;
  if (requiredPct > 0.5) {
    warnings.push({
      code: "gain-fast",
      message: `Gaining to ${target} kg needs ${requiredPct.toFixed(2)}% of your bodyweight a week. Above 0.5% most of it is fat. Aim for 0.25% or less.`,
    });
  }
  if (!feasible) {
    warnings.push({
      code: "gain-infeasible",
      message: `At a sensible surplus you'd reach about ${reachable} kg. Consider staying in your current division or a later competition.`,
    });
  }
  return {
    ...base,
    goal: "gain",
    weeklyRateKg: rate,
    dailyAdjustmentKcal: surplus,
    requiredRatePct: requiredPct,
    feasible,
    reachableWeightKg: feasible ? null : reachable,
  };
}

/**
 * Spreads a week's adjustment over its days. With "protect hard days", a cut's deficit is
 * halved on hard days and the rest moved to easy days, so the weekly total doesn't change.
 */
export function weekAdjustments(
  days: readonly { date: IsoDate; hard: boolean }[],
  dailyKcal: number,
  protect: boolean,
): Record<IsoDate, number> {
  const out: Record<IsoDate, number> = {};
  const total = dailyKcal * days.length;
  const hard = days.filter((d) => d.hard);
  const easy = days.filter((d) => !d.hard);
  if (!protect || dailyKcal >= 0 || hard.length === 0 || easy.length === 0) {
    for (const d of days) out[d.date] = dailyKcal;
    return out;
  }
  const onHard = Math.round(dailyKcal / 2);
  for (const d of hard) out[d.date] = onHard;
  const easyTotal = total - onHard * hard.length;
  const each = Math.trunc(easyTotal / easy.length);
  let rest = easyTotal - each * easy.length;
  for (const d of easy) {
    const step = rest === 0 ? 0 : Math.sign(rest);
    out[d.date] = each + step;
    rest -= step;
  }
  return out;
}

export type DayTargetInput = {
  profile: { sex: "male" | "female"; age: number; heightCm: number };
  weightKg: number;
  activityFactor: number;
  proteinGPerKg: number;
  sessions: (BurnSession & { title: string; intensity: Session["intensity"]; loggedMinutes?: number | null })[];
  adjustmentKcal: number;
};

export type DayTarget = {
  bmr: number;
  base: number;
  burns: { title: string; minutes: number; kcal: number }[];
  training: number;
  maintenance: number;
  adjustment: number;
  target: number;
  floorApplied: boolean;
  hard: boolean;
  proteinG: number;
  fatG: number;
  carbsG: number;
  warnings: Warning[];
};

/** The day's calorie target and macros, with every step shown. */
export function dayTarget(x: DayTargetInput): DayTarget {
  const kg = x.weightKg;
  const b = bmr(x.profile, kg);
  const base = b * x.activityFactor;
  const burns = x.sessions.map((s) => ({ title: s.title, ...sessionBurn(s, kg, s.loggedMinutes) }));
  const training = burns.reduce((sum, s) => sum + s.kcal, 0);
  const maintenance = Math.round(base + training);
  const hard = x.sessions.some((s) => s.intensity === "hard");
  const warnings: Warning[] = [];

  let target = maintenance + Math.round(x.adjustmentKcal);
  const floorApplied = target < b;
  if (floorApplied) {
    target = Math.round(b);
    warnings.push({ code: "bmr-floor", message: "Today's target is held at your BMR. Eating less than that costs training quality." });
  }

  const proteinG = Math.round(x.proteinGPerKg * kg);
  let fatG = Math.round(0.8 * kg);
  const carbs = () => Math.round((target - proteinG * 4 - fatG * 9) / 4);
  let carbsG = carbs();
  if (hard && carbsG < 3 * kg) {
    // Take the deficit from fat first, down to the 0.6 g/kg floor.
    const fatFloor = Math.round(0.6 * kg);
    const cut = Math.min(fatG - fatFloor, Math.ceil(((3 * kg - carbsG) * 4) / 9));
    if (cut > 0) fatG -= cut;
    carbsG = carbs();
    if (carbsG < 3 * kg) {
      warnings.push({
        code: "carb-floor",
        message: `Carbs are only ${(Math.max(0, carbsG) / kg).toFixed(1)} g/kg on a hard day. Aim for at least 3 g/kg so the deficit doesn't come out of your training.`,
      });
    }
  }
  carbsG = Math.max(0, carbsG);

  return {
    bmr: Math.round(b),
    base: Math.round(base),
    burns,
    training,
    maintenance,
    adjustment: target - maintenance,
    target,
    floorApplied,
    hard,
    proteinG,
    fatG,
    carbsG,
    warnings,
  };
}
