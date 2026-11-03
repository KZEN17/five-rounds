import { and, asc, eq, gte, isNull, lte } from "drizzle-orm";
import { addDays, adjustDay, pickModality, readinessFlags, type IsoDate, type PlanInput, type Suggestion } from "@/lib/engine";
import { sessionsBetween, toParams, toSession } from "./plan-store";
import { planSessions, readiness, readinessAdjustments } from "./schema";
import type { ScopedDb } from "./scoped";

/** Today's readiness against the last 7 days, and what (if anything) to swap. */
export async function readinessFor(db: ScopedDb, today: IsoDate, input: PlanInput | undefined) {
  const [entries, todays, recent, decided] = await Promise.all([
    db.select(readiness, and(gte(readiness.date, addDays(today, -7)), lte(readiness.date, today))),
    db
      .select(planSessions, and(eq(planSessions.date, today), isNull(planSessions.deletedAt)))
      .orderBy(asc(planSessions.order), asc(planSessions.createdAt)),
    sessionsBetween(db, addDays(today, -3), addDays(today, -1)),
    db.select(readinessAdjustments, eq(readinessAdjustments.date, today)),
  ]);
  const entry = entries.find((e) => e.date === today);
  const result = readinessFlags(entry, entries, today);
  const hardDaysLast3 = new Set(
    recent.filter((r) => !r.session.deletedAt && r.session.params.intensity === "hard").map((r) => r.session.date),
  ).size;
  const easyModality = input ? pickModality("aerobic", input.equipment, input.profile.injuries).modality : "bike";
  const suggestions = adjustDay({ date: today, sessions: todays.map(toSession) }, result, { hardDaysLast3 }, { easyModality });
  return {
    entry,
    readiness: result,
    // Once the athlete has applied or ignored today's suggestion, stop offering it.
    suggestions: decided.length ? [] : suggestions,
    sessions: todays,
  };
}

/** Applies today's suggested swaps, recomputed here rather than trusted from the client, and logs each one. */
export async function applySuggestions(db: ScopedDb, today: IsoDate, input: PlanInput | undefined): Promise<Suggestion[]> {
  const { suggestions, sessions, readiness: r } = await readinessFor(db, today, input);
  const reasons = r.flags.map((f) => f.message);
  await db.transaction(async (tx) => {
    for (const s of suggestions) {
      const row = sessions[s.index];
      if (!row) continue;
      await tx.update(
        planSessions,
        { type: s.to.type, title: s.to.title, params: toParams(s.to), source: "readiness_swap" },
        eq(planSessions.id, row.id),
      );
      await tx.insert(readinessAdjustments, { date: today, sessionId: row.id, action: "applied", reasons, before: s.from, after: s.to });
    }
  });
  return suggestions;
}

export async function ignoreSuggestions(db: ScopedDb, today: IsoDate) {
  await db.insert(readinessAdjustments, { date: today, action: "ignored", reasons: [] });
}
