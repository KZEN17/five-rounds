import { and, desc, isNotNull, lte } from "drizzle-orm";
import { addDays, bestSet, type IsoDate, type SetLog } from "@/lib/engine";
import { sessionLogs } from "./schema";
import type { ScopedDb } from "./scoped";

export type LiftEntry = { date: IsoDate; sets: SetLog[] };

/** Every logged set, by exercise name, newest first (one query). */
export async function liftHistory(db: ScopedDb, until?: IsoDate): Promise<Map<string, LiftEntry[]>> {
  const rows = await db
    .select(sessionLogs, and(isNotNull(sessionLogs.exercises), until ? lte(sessionLogs.date, until) : undefined))
    .orderBy(desc(sessionLogs.date))
    .limit(400);
  const out = new Map<string, LiftEntry[]>();
  for (const r of rows) {
    for (const x of r.exercises ?? []) {
      const sets = (x.sets ?? []).filter((s) => s.reps != null && s.reps > 0);
      if (!sets.length) continue;
      out.set(x.name, [...(out.get(x.name) ?? []), { date: r.date, sets }]);
    }
  }
  return out;
}

/** The most recent time each exercise was done before `date`. */
export function lastBefore(history: Map<string, LiftEntry[]>, names: readonly string[], date: IsoDate): Record<string, LiftEntry> {
  const out: Record<string, LiftEntry> = {};
  for (const name of names) {
    const hit = history.get(name)?.find((e) => e.date < date);
    if (hit) out[name] = hit;
  }
  return out;
}

/** Lifts that beat their previous best estimated max on `date`, as "Back squat 100 kg × 5". */
export function newBestsOn(history: Map<string, LiftEntry[]>, date: IsoDate): string[] {
  const out: string[] = [];
  for (const [name, entries] of history) {
    const today = entries.filter((e) => e.date === date).flatMap((e) => e.sets);
    const before = entries.filter((e) => e.date < date).flatMap((e) => e.sets);
    const now = bestSet(today);
    const prev = bestSet(before);
    if (now && prev && now.e1rm > prev.e1rm) out.push(`${name} ${now.kg} kg × ${now.reps}`);
  }
  return out;
}

/** Per lift: best set ever, the latest session's best, and how often it's been done. */
export async function liftSummary(db: ScopedDb, until: IsoDate) {
  const history = await liftHistory(db, until);
  return [...history.entries()]
    .map(([name, entries]) => {
      const best = bestSet(entries.flatMap((e) => e.sets));
      const latest = entries[0]!;
      const last = bestSet(latest.sets);
      const monthAgo = entries.find((e) => e.date <= addDays(until, -28));
      const then = monthAgo ? bestSet(monthAgo.sets) : null;
      return { name, sessions: entries.length, best, last, lastDate: latest.date, change: last && then ? Math.round((last.e1rm - then.e1rm) * 10) / 10 : null };
    })
    .filter((l) => l.best)
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 10);
}
