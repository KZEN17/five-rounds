import { addDays, daysBetween, type IsoDate } from "./dates";
import { KCAL_PER_KG } from "./nutrition";
import type { Warning } from "./types";

/** Aim this far under a division limit, for day-to-day swings in scale weight. */
export const LIMIT_BUFFER_KG = 0.5;

export type CalendarComp = {
  id: string;
  name: string;
  date: IsoDate;
  weighIn: "same_day" | "day_before" | "unsure";
  limitKg: number | null;
  isMain: boolean;
};

export type CompStatus = "no_limit" | "on_weight" | "on_track" | "behind" | "needs_data" | "infeasible" | "final_week";

export type CompOutlook = {
  id: string;
  name: string;
  date: IsoDate;
  weighInDate: IsoDate;
  daysToWeighIn: number;
  limitKg: number | null;
  aimKg: number | null;
  /** How far above the aim you are now (0 when on weight). */
  overKg: number;
  /** kg per week needed from today, counting only the weeks before the final week. */
  requiredRateKg: number;
  requiredPct: number;
  /** Where you'd land at the safe rate, when the limit can't be reached safely. */
  reachableKg: number | null;
  status: CompStatus;
  message: string;
};

export type WeightOutlook = {
  comps: CompOutlook[];
  /** The competition setting today's calorie target, if any. */
  drivingId: string | null;
  /** Planned kg change per week (negative = losing). */
  weeklyRateKg: number;
  /** Calories vs maintenance per day (negative = deficit), before protect-hard-days spreading. */
  dailyAdjustmentKcal: number;
  /** Days from this date on are maintenance (the 7 days before the driving weigh-in). */
  finalWeekStart: IsoDate | null;
  inFinalWeek: boolean;
  warnings: Warning[];
};

const round1 = (v: number) => Math.round(v * 10) / 10;
const SAFE_PCT = 0.75;
const MAX_PCT = 1;

export function weighInDate(c: Pick<CalendarComp, "date" | "weighIn">): IsoDate {
  return c.weighIn === "day_before" ? addDays(c.date, -1) : c.date;
}

/**
 * Weight against every upcoming competition limit, and the calorie adjustment that gets
 * you there. A limit is a ceiling: at or under it you eat at maintenance. With several
 * competitions, the one needing the fastest rate sets the deficit. The 7 days before
 * the nearest weigh-in you're over for are always maintenance, never a crash cut.
 */
export function weightOutlook(input: {
  date: IsoDate;
  trendKg: number;
  actualRateKg: number | null;
  comps: readonly CalendarComp[];
}): WeightOutlook {
  const { date, trendKg } = input;
  const warnings: Warning[] = [];
  const upcoming = input.comps
    .filter((c) => daysBetween(date, weighInDate(c)) >= 0)
    .sort((a, b) => weighInDate(a).localeCompare(weighInDate(b)));

  const comps: CompOutlook[] = upcoming.map((c) => {
    const wd = weighInDate(c);
    const days = daysBetween(date, wd);
    const base = { id: c.id, name: c.name, date: c.date, weighInDate: wd, daysToWeighIn: days, limitKg: c.limitKg };
    if (c.limitKg == null) {
      return { ...base, aimKg: null, overKg: 0, requiredRateKg: 0, requiredPct: 0, reachableKg: null, status: "no_limit", message: "No weight limit." };
    }
    const aim = round1(c.limitKg - LIMIT_BUFFER_KG);
    const over = round1(Math.max(0, trendKg - aim));
    if (over === 0) {
      return { ...base, aimKg: aim, overKg: 0, requiredRateKg: 0, requiredPct: 0, reachableKg: null, status: "on_weight", message: `On weight: ${trendKg} kg against a ${c.limitKg} kg limit.` };
    }
    const weeks = Math.max(0, days - 7) / 7;
    if (weeks === 0) {
      return {
        ...base,
        aimKg: aim,
        overKg: over,
        requiredRateKg: Infinity,
        requiredPct: Infinity,
        reachableKg: trendKg,
        status: "final_week",
        message: `${over} kg over with ${days} days to go. Don't crash diet or cut water now: keep food and fluid normal, and consider the next division up.`,
      };
    }
    const rate = over / weeks;
    const pct = (rate / trendKg) * 100;
    if (pct > MAX_PCT) {
      const reachable = round1(trendKg - trendKg * (SAFE_PCT / 100) * weeks);
      return {
        ...base,
        aimKg: aim,
        overKg: over,
        requiredRateKg: rate,
        requiredPct: pct,
        reachableKg: reachable,
        status: "infeasible",
        message: `Needs ${pct.toFixed(1)}% of your bodyweight a week, over the 1% limit. At a safe rate you'd weigh about ${reachable} kg. Consider the next division up or a later competition.`,
      };
    }
    const actual = input.actualRateKg;
    const status: CompStatus = actual == null ? "needs_data" : -actual >= rate * 0.8 ? "on_track" : "behind";
    const pace = `${rate.toFixed(2)} kg/week to reach ${aim} kg`;
    const message =
      status === "needs_data"
        ? `${over} kg to lose: ${pace}. Weigh in most mornings to track it.`
        : status === "on_track"
          ? `On track: losing ${(-actual!).toFixed(2)} kg/week, need ${pace}.`
          : `Behind: ${actual! <= 0 ? `losing ${(-actual!).toFixed(2)}` : `gaining ${actual!.toFixed(2)}`} kg/week, need ${pace}.`;
    if (pct > SAFE_PCT) {
      warnings.push({ code: `aggressive:${c.id}`, message: `${c.name || "Competition"}: this cut needs ${pct.toFixed(2)}% of your bodyweight a week, above the 0.75% that protects training quality.` });
    }
    return { ...base, aimKg: aim, overKg: over, requiredRateKg: rate, requiredPct: pct, reachableKg: null, status, message };
  });

  // The nearest weigh-in you're over for decides whether today is a final-week (maintenance) day.
  const nearestOver = comps.find((c) => c.overKg > 0);
  const inFinalWeek = Boolean(nearestOver && nearestOver.daysToWeighIn <= 7);
  for (const c of comps) {
    if (c.status === "infeasible") warnings.push({ code: `infeasible:${c.id}`, message: `${c.name || "Competition"}: ${c.message}` });
    if (c.status === "final_week") warnings.push({ code: `final:${c.id}`, message: `${c.name || "Competition"}: ${c.message}` });
  }

  // The fastest required rate binds; capped by the safe band.
  const cutting = comps.filter((c) => c.overKg > 0 && c.status !== "final_week");
  const driving = cutting.reduce<CompOutlook | null>((a, c) => (!a || c.requiredRateKg > a.requiredRateKg ? c : a), null);
  if (inFinalWeek || !driving) {
    return {
      comps,
      drivingId: inFinalWeek ? (nearestOver?.id ?? null) : null,
      weeklyRateKg: 0,
      dailyAdjustmentKcal: 0,
      finalWeekStart: nearestOver ? addDays(nearestOver.weighInDate, -7) : null,
      inFinalWeek,
      warnings,
    };
  }
  const rate = driving.status === "infeasible" ? trendKg * (SAFE_PCT / 100) : driving.requiredRateKg;
  return {
    comps,
    drivingId: driving.id,
    weeklyRateKg: -rate,
    dailyAdjustmentKcal: -Math.round((rate * KCAL_PER_KG) / 7),
    finalWeekStart: addDays(driving.weighInDate, -7),
    inFinalWeek: false,
    warnings,
  };
}
