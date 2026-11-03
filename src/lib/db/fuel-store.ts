import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import {
  addDays,
  dayTarget,
  daysBetween,
  mondayOf,
  weekAdjustments,
  type IsoDate,
  type Plan,
  type PlanInput,
} from "@/lib/engine";
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

/** The planned calories vs maintenance for a date, spread over its week (protect hard days). */
function adjustmentFor(plan: Plan | undefined, date: IsoDate, hardByDate: Map<IsoDate, boolean>): number {
  const n = plan?.nutrition;
  if (!plan || !n || n.goal === "maintain" || date < plan.start || date >= n.finalWeekStart) return 0;
  const monday = mondayOf(date);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
    .filter((d) => d >= plan.start && d < n.finalWeekStart)
    .map((d) => ({ date: d, hard: hardByDate.get(d) ?? false }));
  return weekAdjustments(days, n.dailyAdjustmentKcal, n.protectHardDays)[date] ?? 0;
}

/** Everything the Fuel screen shows for one date. */
export async function fuelDay(db: ScopedDb, date: IsoDate, input: PlanInput, plan: Plan | undefined) {
  const monday = mondayOf(date);
  const [weekRows, logs, recentLogs, savedMeals, foodRows, weightRows, kg] = await Promise.all([
    sessionsBetween(db, monday, addDays(monday, 6)),
    db.select(foodLogs, eq(foodLogs.date, date)).orderBy(asc(foodLogs.createdAt)),
    db.select(foodLogs).orderBy(desc(foodLogs.createdAt)).limit(200),
    db.select(meals).orderBy(asc(meals.name)),
    db.foods.visible().orderBy(asc(foods.name)),
    db.select(weights, and(gte(weights.date, addDays(date, -60)), lte(weights.date, date))).orderBy(asc(weights.date)),
    weightOn(db, date, input.profile.weightKg),
  ]);

  const live = weekRows.filter((r) => !r.session.deletedAt);
  const hardByDate = new Map<IsoDate, boolean>();
  for (const r of live) if (r.session.params.intensity === "hard") hardByDate.set(r.session.date, true);
  const today = live.filter((r) => r.session.date === date);

  const target = dayTarget({
    profile: input.profile,
    weightKg: kg,
    activityFactor: input.nutrition.activityFactor,
    proteinGPerKg: input.nutrition.proteinGPerKg,
    sessions: today.map((r) => ({ ...r.session.params, type: r.session.type, title: r.session.title, loggedMinutes: r.log?.minutes ?? null })),
    adjustmentKcal: adjustmentFor(plan, date, hardByDate),
  });

  const eaten = logs.reduce(
    (a, x) => ({ kcal: a.kcal + x.kcal, p: a.p + (x.p ?? 0), c: a.c + (x.c ?? 0), f: a.f + (x.f ?? 0) }),
    { kcal: 0, p: 0, c: 0, f: 0 },
  );

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

  // 7-day moving average over the weigh-ins in each trailing week.
  const series = weightRows.map((w) => {
    const window = weightRows.filter((x) => {
      const ago = daysBetween(x.date, w.date);
      return ago >= 0 && ago < 7;
    });
    return { date: w.date, kg: w.kg, avg: round1(window.reduce((s, x) => s + x.kg, 0) / window.length) };
  });
  // Actual rate: least-squares slope over the last 28 days of weigh-ins, once they span 10+ days.
  const recentWeights = weightRows.filter((w) => daysBetween(w.date, date) < 28);
  const span = recentWeights.length ? daysBetween(recentWeights[0]!.date, recentWeights.at(-1)!.date) : 0;
  let actualRate: number | null = null;
  if (span >= 10) {
    const xs = recentWeights.map((w) => daysBetween(recentWeights[0]!.date, w.date));
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
    const my = recentWeights.reduce((a, w) => a + w.kg, 0) / recentWeights.length;
    const cov = xs.reduce((a, x, i) => a + (x - mx) * (recentWeights[i]!.kg - my), 0);
    const varX = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
    actualRate = (cov / varX) * 7;
  }

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
      onDate: weightRows.find((w) => w.date === date)?.kg ?? null,
      series,
      actualRate,
      targetRate: plan?.nutrition.weeklyRateKg ?? 0,
    },
    finalWeek: plan ? date >= plan.nutrition.finalWeekStart && date <= plan.compDate : false,
  };
}
