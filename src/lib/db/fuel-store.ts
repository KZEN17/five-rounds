import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import {
  addDays,
  dayTarget,
  daysBetween,
  mondayOf,
  weekAdjustments,
  weightOutlook,
  type IsoDate,
  type PlanInput,
  type WeightOutlook,
} from "@/lib/engine";
import { listCompetitions, toCalendarComp } from "./competition-store";
import { sessionsBetween } from "./plan-store";
import { foodLogs, foods, meals, weights } from "./schema";
import type { ScopedDb } from "./scoped";

export type FoodOption = { id: string; name: string; kcal: number; p: number; c: number; f: number; category: string; needsReview: boolean; mine: boolean };

const round1 = (v: number) => Math.round(v * 10) / 10;

/** Weight on a date: the latest weigh-in up to then, else the answers' weight. */
export async function weightOn(db: ScopedDb, date: IsoDate, fallback: number): Promise<number> {
  const [row] = await db.select(weights, lte(weights.date, date)).orderBy(desc(weights.date)).limit(1);
  return row?.kg ?? fallback;
}

/**
 * Weigh-ins up to a date: the last 60 days with a 7-day moving average, the trend
 * weight (latest average), and the actual weekly rate once there are 10+ days of data.
 */
export async function weightTrend(db: ScopedDb, date: IsoDate, fallbackKg: number) {
  const [rows, kg] = await Promise.all([
    db.select(weights, and(gte(weights.date, addDays(date, -60)), lte(weights.date, date))).orderBy(asc(weights.date)),
    weightOn(db, date, fallbackKg),
  ]);
  const series = rows.map((w) => {
    const window = rows.filter((x) => {
      const ago = daysBetween(x.date, w.date);
      return ago >= 0 && ago < 7;
    });
    return { date: w.date, kg: w.kg, avg: round1(window.reduce((s, x) => s + x.kg, 0) / window.length) };
  });
  // Actual rate: least-squares slope over the last 28 days of weigh-ins, once they span 10+ days.
  const recent = rows.filter((w) => daysBetween(w.date, date) < 28);
  const span = recent.length ? daysBetween(recent[0]!.date, recent.at(-1)!.date) : 0;
  let actualRate: number | null = null;
  if (span >= 10) {
    const xs = recent.map((w) => daysBetween(recent[0]!.date, w.date));
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
    const my = recent.reduce((a, w) => a + w.kg, 0) / recent.length;
    const cov = xs.reduce((a, x, i) => a + (x - mx) * (recent[i]!.kg - my), 0);
    const varX = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
    actualRate = (cov / varX) * 7;
  }
  // A recent average smooths day-to-day swings; an old one is stale, so use the latest weigh-in then.
  const last = series.at(-1);
  const trendKg = last && daysBetween(last.date, date) <= 7 ? last.avg : kg;
  return { kg, trendKg, series, actualRate, onDate: rows.find((w) => w.date === date)?.kg ?? null };
}

/** Weight against the competition calendar, as of a date. */
export async function outlookFor(db: ScopedDb, date: IsoDate, fallbackKg: number) {
  const [trend, calendar] = await Promise.all([weightTrend(db, date, fallbackKg), listCompetitions(db)]);
  const outlook = weightOutlook({ date, trendKg: trend.trendKg, actualRateKg: trend.actualRate, comps: calendar.map(toCalendarComp) });
  return { trend, calendar, outlook };
}

/** Today's share of the outlook's adjustment, spread over its week (protect hard days). */
function adjustmentFor(outlook: WeightOutlook, date: IsoDate, hardByDate: Map<IsoDate, boolean>, protect: boolean): number {
  const end = outlook.finalWeekStart;
  if (outlook.dailyAdjustmentKcal === 0 || !end || date >= end) return 0;
  const monday = mondayOf(date);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
    .filter((d) => d < end)
    .map((d) => ({ date: d, hard: hardByDate.get(d) ?? false }));
  return weekAdjustments(days, outlook.dailyAdjustmentKcal, protect)[date] ?? 0;
}

/** The day's calorie target, what was eaten, and the weight outlook: the core of Fuel and of reports. */
export async function dayNumbers(db: ScopedDb, date: IsoDate, input: PlanInput) {
  const monday = mondayOf(date);
  const [weekRows, logs, { trend, calendar, outlook }] = await Promise.all([
    sessionsBetween(db, monday, addDays(monday, 6)),
    db.select(foodLogs, eq(foodLogs.date, date)).orderBy(asc(foodLogs.createdAt)),
    outlookFor(db, date, input.profile.weightKg),
  ]);
  const live = weekRows.filter((r) => !r.session.deletedAt);
  const hardByDate = new Map<IsoDate, boolean>();
  for (const r of live) if (r.session.params.intensity === "hard") hardByDate.set(r.session.date, true);
  const today = live.filter((r) => r.session.date === date);

  const target = dayTarget({
    profile: input.profile,
    weightKg: trend.kg,
    activityFactor: input.nutrition.activityFactor,
    proteinGPerKg: input.nutrition.proteinGPerKg,
    sessions: today.map((r) => ({ ...r.session.params, type: r.session.type, title: r.session.title, loggedMinutes: r.log?.minutes ?? null })),
    adjustmentKcal: adjustmentFor(outlook, date, hardByDate, input.nutrition.protectHardDays),
  });
  const eaten = logs.reduce(
    (a, x) => ({ kcal: a.kcal + x.kcal, p: a.p + (x.p ?? 0), c: a.c + (x.c ?? 0), f: a.f + (x.f ?? 0) }),
    { kcal: 0, p: 0, c: 0, f: 0 },
  );
  return { target, eaten, logs, trend, calendar, outlook };
}

/** Everything the Fuel screen shows for one date. */
export async function fuelDay(db: ScopedDb, date: IsoDate, input: PlanInput) {
  const [{ target, eaten, logs, trend, calendar, outlook }, recentLogs, savedMeals, foodRows] = await Promise.all([
    dayNumbers(db, date, input),
    db.select(foodLogs).orderBy(desc(foodLogs.createdAt)).limit(200),
    db.select(meals).orderBy(asc(meals.name)),
    db.foods.visible().orderBy(asc(foods.name)),
  ]);
  const kg = trend.kg;

  const seen = new Set<string>();
  const recent = recentLogs
    .filter((x) => {
      const key = x.name.trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 10)
    .map((x) => ({ name: x.name, kcal: x.kcal, p: x.p, c: x.c, f: x.f, ingredients: x.ingredients }));

  return {
    target,
    eaten,
    logs,
    recent,
    meals: savedMeals,
    foods: foodRows.map(
      (f): FoodOption => ({ id: f.id, name: f.name, kcal: f.kcal, p: f.p, c: f.c, f: f.f, category: f.category, needsReview: f.needsReview, mine: f.ownerId != null }),
    ),
    weight: {
      kg,
      onDate: trend.onDate,
      series: trend.series,
      actualRate: trend.actualRate,
      targetRate: outlook.weeklyRateKg,
    },
    outlook,
    competitions: calendar,
    finalWeek: outlook.inFinalWeek,
  };
}
