import { and, desc, eq, gte, isNull, lt, lte } from "drizzle-orm";
import {
  addDays,
  dailyReport,
  daysBetween,
  readinessFlags,
  weeklyReport,
  type IsoDate,
  type PaceFacts,
  type PlanInput,
  type Report,
  type WeightOutlook,
} from "@/lib/engine";
import { roundStats } from "@/lib/session-meta";
import { dayNumbers } from "./fuel-store";
import { sessionsBetween } from "./plan-store";
import { readiness, reports, weights } from "./schema";
import type { ScopedDb } from "./scoped";

export type ReportRow = typeof reports.$inferSelect;

/** The competition setting the calories (or the nearest one with a limit), as report facts. */
export function paceFrom(outlook: WeightOutlook, trendKg: number): PaceFacts {
  const c = outlook.comps.find((x) => x.id === outlook.drivingId) ?? outlook.comps.find((x) => x.limitKg != null);
  if (!c) return null;
  return { compId: c.id, compName: c.name, status: c.status, requiredRateKg: c.requiredRateKg, trendKg, aimKg: c.aimKg, daysToWeighIn: c.daysToWeighIn };
}

/** The required pace in the most recent earlier report for the same competition: the baseline for "closer / further". */
async function previousRequired(db: ScopedDb, kind: Report["kind"], before: IsoDate, compId: string | undefined) {
  if (!compId) return null;
  const rows = await db.select(reports, and(eq(reports.kind, kind), lt(reports.periodStart, before))).orderBy(desc(reports.periodStart)).limit(14);
  const hit = rows.find((r) => r.payload.pace?.compId === compId);
  const v = hit?.payload.pace?.requiredRateKg;
  return v != null && Number.isFinite(v) ? v : null;
}

async function flaggedOn(db: ScopedDb, date: IsoDate) {
  const entries = await db.select(readiness, and(gte(readiness.date, addDays(date, -7)), lte(readiness.date, date)));
  return readinessFlags(entries.find((e) => e.date === date), entries, date).flags.map((f) => f.message);
}

/** Facts for one day, or null when there's nothing to report (no plan and nothing logged). */
export async function dayFacts(db: ScopedDb, date: IsoDate, input: PlanInput) {
  const [rows, numbers, lastWeight, flags] = await Promise.all([
    sessionsBetween(db, date, addDays(date, 1)),
    dayNumbers(db, date, input),
    db.select(weights, lte(weights.date, date)).orderBy(desc(weights.date)).limit(1),
    flaggedOn(db, date),
  ]);
  const live = rows.filter((r) => !r.session.deletedAt);
  const onDay = live.filter((r) => r.session.date === date);
  const done = onDay.filter((r) => r.log?.done);
  const rpes = done.flatMap((r) => (r.log?.rpe != null ? [r.log.rpe] : []));
  const weighedIn = lastWeight[0]?.date === date;
  if (onDay.length === 0 && numbers.logs.length === 0 && !weighedIn) return null;
  return {
    facts: {
      date,
      planned: onDay.length,
      done: done.length,
      hardRounds: done.reduce((n, r) => n + (r.log?.hardRounds ?? 0), 0),
      avgRpe: rpes.length ? Math.round((rpes.reduce((a, b) => a + b, 0) / rpes.length) * 10) / 10 : null,
      missed: onDay.filter((r) => !r.log?.done).map((r) => r.session.title),
      food: {
        logged: numbers.logs.length > 0,
        kcal: numbers.eaten.kcal,
        target: numbers.target.target,
        protein: numbers.eaten.p,
        proteinTarget: numbers.target.proteinG,
      },
      weighedIn,
      daysSinceWeighIn: lastWeight[0] ? daysBetween(lastWeight[0].date, date) : null,
      readinessFlags: flags,
      nextPlan: live.filter((r) => r.session.date === addDays(date, 1)).map((r) => r.session.title),
    },
    pace: paceFrom(numbers.outlook, numbers.trend.trendKg),
  };
}

/** Facts for the week starting `start` (a Monday). */
export async function weekFacts(db: ScopedDb, start: IsoDate, input: PlanInput) {
  const end = addDays(start, 6);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const [rows, history, perDay, weighIns, flags, before, after] = await Promise.all([
    sessionsBetween(db, start, addDays(end, 7)),
    sessionsBetween(db, addDays(start, -42), end),
    Promise.all(days.map((d) => dayNumbers(db, d, input))),
    db.select(weights, and(gte(weights.date, start), lte(weights.date, end))),
    Promise.all(days.map((d) => flaggedOn(db, d))),
    dayNumbers(db, addDays(start, -1), input),
    dayNumbers(db, end, input),
  ]);
  const live = rows.filter((r) => !r.session.deletedAt);
  const inWeek = live.filter((r) => r.session.date <= end);
  const nextWeek = live.filter((r) => r.session.date > end);
  const hard = inWeek.filter((r) => r.session.params.intensity === "hard");
  const logged = perDay.filter((d) => d.logs.length > 0);
  const pct = (d: (typeof perDay)[number]) => (d.target.target ? (d.eaten.kcal - d.target.target) / d.target.target : 0);
  const sims = history
    .filter((r) => !r.session.deletedAt && r.session.type === "comp_sim" && r.log)
    .map((r) => ({ date: r.session.date, last: roundStats(r.log!.rounds, r.session.params.rounds ?? 0).lastRpe }))
    .filter((s): s is { date: string; last: number } => s.last != null);
  const lastSim = sims.at(-1);
  const prevSim = sims.at(-2);
  return {
    facts: {
      start,
      end,
      planned: inWeek.length,
      done: inWeek.filter((r) => r.log?.done).length,
      hardPlanned: hard.length,
      hardDone: hard.filter((r) => r.log?.done).length,
      daysFoodLogged: logged.length,
      daysOnTarget: logged.filter((d) => Math.abs(pct(d)) <= 0.08).length,
      daysOver: logged.filter((d) => pct(d) > 0.08).length,
      proteinDays: logged.filter((d) => d.eaten.p >= 0.9 * d.target.proteinG).length,
      weighIns: weighIns.length,
      trendStart: weighIns.length ? before.trend.trendKg : null,
      trendEnd: weighIns.length ? after.trend.trendKg : null,
      simFinalRpe: lastSim && prevSim && lastSim.date >= start ? { first: prevSim.last, last: lastSim.last } : null,
      flaggedDays: flags.filter((f) => f.length > 0).length,
      nextWeekPlanned: nextWeek.length,
      nextWeekHard: nextWeek.filter((r) => r.session.params.intensity === "hard").length,
    },
    pace: paceFrom(after.outlook, after.trend.trendKg),
  };
}

async function stored(db: ScopedDb, kind: Report["kind"], periodStart: IsoDate) {
  const [row] = await db.select(reports, and(eq(reports.kind, kind), eq(reports.periodStart, periodStart))).limit(1);
  return row;
}

/** Yesterday's report, generated once and kept. Null when there was nothing to report. */
export async function ensureDailyReport(db: ScopedDb, date: IsoDate, input: PlanInput): Promise<ReportRow | null> {
  const existing = await stored(db, "daily", date);
  if (existing) return existing;
  const built = await dayFacts(db, date, input);
  if (!built) return null;
  const report = dailyReport(built.facts, built.pace, await previousRequired(db, "daily", date, built.pace?.compId));
  await db.insert(reports, { kind: "daily", periodStart: date, payload: report }).onConflictDoNothing();
  return (await stored(db, "daily", date)) ?? null;
}

/** Last week's report (week starting `start`), generated once and kept. */
export async function ensureWeeklyReport(db: ScopedDb, start: IsoDate, input: PlanInput): Promise<ReportRow | null> {
  const existing = await stored(db, "weekly", start);
  if (existing) return existing;
  const built = await weekFacts(db, start, input);
  if (built.facts.planned === 0 && built.facts.daysFoodLogged === 0 && built.facts.weighIns === 0) return null;
  const report = weeklyReport(built.facts, built.pace, await previousRequired(db, "weekly", start, built.pace?.compId));
  await db.insert(reports, { kind: "weekly", periodStart: start, payload: report }).onConflictDoNothing();
  return (await stored(db, "weekly", start)) ?? null;
}

export async function listReports(db: ScopedDb, limit = 60) {
  return db.select(reports).orderBy(desc(reports.periodStart), desc(reports.kind)).limit(limit);
}

export async function markReportsRead(db: ScopedDb) {
  await db.update(reports, { readAt: new Date() }, isNull(reports.readAt));
}
