import { and, asc, desc, eq, gte, isNull, lte, notExists } from "drizzle-orm";
import { generatePlan, type IsoDate, type Plan, type PlanInput, type Session } from "@/lib/engine";
import { calendarDate } from "@/lib/time";
import { fieldsFromInput, saveMainCompetition } from "./competition-store";
import { planInputs, plans, planSessions, profiles, sessionLogs, weights, type SessionParams } from "./schema";
import { RAW, type ScopedDb } from "./scoped";

export type SessionRow = typeof planSessions.$inferSelect;
export type LogRow = typeof sessionLogs.$inferSelect;

export function toParams(s: Session): SessionParams {
  const { type: _type, title: _title, timeOfDay: _time, ...params } = s;
  return params;
}

export function toSession(row: Pick<SessionRow, "type" | "title" | "params" | "timeOfDay">): Session {
  return { ...row.params, type: row.type, title: row.title, ...(row.timeOfDay ? { timeOfDay: row.timeOfDay } : {}) };
}

export async function latestInput(db: ScopedDb) {
  const [row] = await db.select(planInputs).orderBy(desc(planInputs.version)).limit(1);
  return row;
}

export async function activePlan(db: ScopedDb) {
  const [row] = await db.select(plans, eq(plans.active, true)).limit(1);
  return row;
}

/** The plan's sessions for one date, ready to insert. */
export function sessionsFor(plan: Plan, date: IsoDate): Session[] {
  for (const w of plan.weeks) for (const d of w.days) if (d.date === date) return d.sessions;
  return [];
}

/**
 * Saves the answers as a new version, generates a plan from them and lays it out.
 * Regenerating never touches past days or anything already logged; the rest of the
 * future is replaced by the new plan.
 */
export async function saveAndGenerate(db: ScopedDb, input: PlanInput, today: IsoDate, timezone: string) {
  return db.transaction(async (tx) => {
    const prev = await latestInput(tx);
    const version = (prev?.version ?? 0) + 1;
    const [saved] = await tx.insert(planInputs, { version, data: input }).returning({ id: planInputs.id });
    const p = input.profile;
    const c = input.competition;
    const profile = {
      age: p.age,
      sex: p.sex,
      heightCm: p.heightCm,
      belt: p.belt,
      yearsTraining: p.yearsTraining,
      injuries: p.injuries,
      timezone,
    };
    const raw = tx[RAW];
    await raw.insert(profiles).values({ ...profile, userId: tx.userId }).onConflictDoUpdate({ target: profiles.userId, set: profile });
    await saveMainCompetition(tx, fieldsFromInput(c));
    // Today's weight from the answers, unless there's already a weigh-in.
    await raw.insert(weights).values({ userId: tx.userId, date: today, kg: p.weightKg }).onConflictDoNothing();

    const plan = generatePlan(input, calendarDate(today));
    await tx.update(plans, { active: false }, eq(plans.active, true));
    const [created] = await tx
      .insert(plans, { inputId: saved!.id, version, startDate: plan.start, compDate: plan.compDate, active: true, output: plan })
      .returning({ id: plans.id });

    // Replace the future, keeping anything with a log.
    const unlogged = notExists(raw.select({ id: sessionLogs.id }).from(sessionLogs).where(eq(sessionLogs.sessionId, planSessions.id)));
    await tx.update(planSessions, { deletedAt: new Date() }, and(gte(planSessions.date, today), isNull(planSessions.deletedAt), unlogged));
    const kept = await tx.select(planSessions, and(gte(planSessions.date, today), isNull(planSessions.deletedAt)));
    const keptDates = new Set(kept.map((s) => s.date));

    const rows = plan.weeks.flatMap((w) =>
      w.days
        .filter((d) => d.date >= today && !keptDates.has(d.date))
        .flatMap((d) =>
          d.sessions.map((s, order) => ({
            planId: created!.id,
            date: d.date,
            order,
            type: s.type,
            title: s.title,
            params: toParams(s),
            timeOfDay: s.timeOfDay ?? null,
            source: "generated" as const,
          })),
        ),
    );
    if (rows.length) await tx.insert(planSessions, rows);
    return plan;
  });
}

/** Every session (live and removed) with its log between two dates, in one query. */
export async function sessionsBetween(db: ScopedDb, from: IsoDate, to: IsoDate) {
  return db[RAW]
    .select({ session: planSessions, log: sessionLogs })
    .from(planSessions)
    .leftJoin(sessionLogs, and(eq(sessionLogs.sessionId, planSessions.id), eq(sessionLogs.userId, db.userId)))
    .where(db.owns(planSessions, gte(planSessions.date, from), lte(planSessions.date, to)))
    .orderBy(asc(planSessions.date), asc(planSessions.order), asc(planSessions.createdAt));
}

/** Logs without a planned session (e.g. imported), between two dates. */
export async function logsBetween(db: ScopedDb, from: IsoDate, to: IsoDate) {
  return db.select(sessionLogs, and(gte(sessionLogs.date, from), lte(sessionLogs.date, to)));
}
