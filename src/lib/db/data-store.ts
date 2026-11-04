import { and, eq, sql } from "drizzle-orm";
import { mapLegacy, countRows, type LegacyState } from "@/lib/legacy/map";
import { saveProfile } from "./profile";
import {
  competitions,
  foodLogs,
  foods,
  meals,
  planInputs,
  plans,
  planSessions,
  profiles,
  readiness,
  readinessAdjustments,
  sessionLogs,
  weekMarks,
  weights,
} from "./schema";
import { RAW, type ScopedDb } from "./scoped";

export const EXPORT_FORMAT = "five-rounds/v2";

/** Every row the user owns, as one JSON document. */
export async function exportAll(db: ScopedDb, email: string) {
  const [profile, competition, inputs, planRows, sessions, logs, marks, ready, adjustments, weightRows, privateFoods, mealRows, foodRows] =
    await Promise.all([
      db.select(profiles),
      db.select(competitions),
      db.select(planInputs),
      db.select(plans),
      db.select(planSessions),
      db.select(sessionLogs),
      db.select(weekMarks),
      db.select(readiness),
      db.select(readinessAdjustments),
      db.select(weights),
      db.foods.visible(sql`${foods.ownerId} is not null`),
      db.select(meals),
      db.select(foodLogs),
    ]);
  return {
    format: EXPORT_FORMAT,
    exportedAt: new Date().toISOString(),
    account: { email },
    data: {
      profile: profile[0] ?? null,
      competitions: competition,
      planInputs: inputs,
      plans: planRows,
      planSessions: sessions,
      sessionLogs: logs,
      weekMarks: marks,
      readiness: ready,
      readinessAdjustments: adjustments,
      weights: weightRows,
      foods: privateFoods,
      meals: mealRows,
      foodLogs: foodRows,
    },
  };
}

export type ExportDoc = Awaited<ReturnType<typeof exportAll>>;

/** Strips owner and timestamp columns so rows can be re-inserted for the current user. */
function strip<T extends Record<string, unknown>>(row: T): Omit<T, "userId" | "ownerId" | "createdAt" | "updatedAt"> {
  const { userId: _u, ownerId: _o, createdAt: _c, updatedAt: _up, ...rest } = row as Record<string, unknown>;
  return rest as Omit<T, "userId" | "ownerId" | "createdAt" | "updatedAt">;
}

/**
 * Replaces all of this user's data with an export. Ids are re-issued (and references
 * remapped) so an export can also be loaded into a different account.
 */
export async function importV2(db: ScopedDb, doc: ExportDoc) {
  const d = doc.data;
  const id = () => crypto.randomUUID();
  const inputIds = new Map(d.planInputs.map((r) => [r.id, id()]));
  const planIds = new Map(d.plans.map((r) => [r.id, id()]));
  const sessionIds = new Map(d.planSessions.map((r) => [r.id, id()]));
  await db.transaction(async (tx) => {
    for (const t of [readinessAdjustments, sessionLogs, planSessions, plans, planInputs, weekMarks, readiness, weights, meals, foodLogs]) {
      await tx.delete(t);
    }
    await tx[RAW].delete(foods).where(eq(foods.ownerId, tx.userId));
    if (d.profile) {
      const { userId: _u, createdAt: _c, updatedAt: _t, ...p } = d.profile;
      await saveProfile(tx, p);
    }
    await tx.delete(competitions);
    // Exports from before the calendar carried a single `competition`: it was the main one.
    const legacyOne = (d as { competition?: (typeof d.competitions)[number] | null }).competition;
    const calendar = d.competitions ?? (legacyOne ? [{ ...legacyOne, isMain: true }] : []);
    for (const row of calendar) {
      const { id: _id, userId: _u, createdAt: _c, updatedAt: _t, ...c } = row;
      await tx.insert(competitions, { ...c, isMain: Boolean(c.isMain) });
    }
    const many = async <T>(rows: T[], fn: (chunk: T[]) => Promise<unknown>) => {
      for (let i = 0; i < rows.length; i += 200) await fn(rows.slice(i, i + 200));
    };
    await many(d.planInputs, (c) => tx.insert(planInputs, c.map((r) => ({ ...strip(r), id: inputIds.get(r.id)! }))));
    await many(d.plans, (c) => tx.insert(plans, c.map((r) => ({ ...strip(r), id: planIds.get(r.id)!, inputId: inputIds.get(r.inputId)!, generatedAt: new Date(r.generatedAt) }))));
    await many(d.planSessions, (c) =>
      tx.insert(
        planSessions,
        c.map((r) => ({ ...strip(r), id: sessionIds.get(r.id)!, planId: r.planId ? (planIds.get(r.planId) ?? null) : null, deletedAt: r.deletedAt ? new Date(r.deletedAt) : null })),
      ),
    );
    await many(d.sessionLogs, (c) => tx.insert(sessionLogs, c.map((r) => ({ ...strip(r), id: id(), sessionId: r.sessionId ? (sessionIds.get(r.sessionId) ?? null) : null }))));
    await many(d.weekMarks, (c) => tx.insert(weekMarks, c.map(strip)));
    await many(d.readiness, (c) => tx.insert(readiness, c.map(strip)));
    await many(d.readinessAdjustments, (c) =>
      tx.insert(readinessAdjustments, c.map((r) => ({ ...strip(r), id: id(), sessionId: r.sessionId ? (sessionIds.get(r.sessionId) ?? null) : null }))),
    );
    await many(d.weights, (c) => tx.insert(weights, c.map(strip)));
    for (const f of d.foods) await tx.foods.insert({ name: f.name, kcal: f.kcal, p: f.p, c: f.c, f: f.f, category: f.category, needsReview: f.needsReview });
    await many(d.meals, (c) => tx.insert(meals, c.map((r) => ({ ...strip(r), id: id() }))));
    await many(d.foodLogs, (c) => tx.insert(foodLogs, c.map((r) => ({ ...strip(r), id: id() }))));
  });
  return { sessions: d.planSessions.length, logs: d.sessionLogs.length, foodLogs: d.foodLogs.length, weights: d.weights.length };
}

/**
 * Brings a legacy backup in. Idempotent: rows carry external ids (or natural keys)
 * and are upserted, so running it twice changes nothing.
 */
export async function importLegacy(db: ScopedDb, state: LegacyState, opts: { dryRun?: boolean } = {}) {
  const rows = mapLegacy(state);
  const counts = countRows(rows);
  if (opts.dryRun) return counts;
  await db.transaction(async (tx) => {
    const sessionIds = new Map<string, string>();
    for (const s of rows.sessions) {
      const values = { planId: null, date: s.date, order: s.order, type: s.type, title: s.title, params: s.params, timeOfDay: s.timeOfDay, source: s.source };
      const [row] = await tx
        .insert(planSessions, { ...values, externalId: s.externalId })
        .onConflictDoUpdate({ target: [planSessions.userId, planSessions.externalId], set: values })
        .returning({ id: planSessions.id });
      sessionIds.set(s.externalId, row!.id);
    }
    for (const { sessionExternalId, externalId, ...l } of rows.logs) {
      const sessionId = sessionExternalId ? (sessionIds.get(sessionExternalId) ?? null) : null;
      await tx
        .insert(sessionLogs, { ...l, sessionId, externalId })
        .onConflictDoUpdate({ target: [sessionLogs.userId, sessionLogs.externalId], set: { ...l, sessionId } });
    }
    for (const m of rows.weekMarks) {
      await tx.insert(weekMarks, m).onConflictDoUpdate({ target: [weekMarks.userId, weekMarks.weekStart], set: { done: m.done } });
    }
    for (const r of rows.readiness) {
      const { date, ...rest } = r;
      await tx.insert(readiness, r).onConflictDoUpdate({ target: [readiness.userId, readiness.date], set: rest });
    }
    for (const w of rows.weights) {
      await tx.insert(weights, w).onConflictDoUpdate({ target: [weights.userId, weights.date], set: { kg: w.kg } });
    }
    for (const f of rows.foodLogs) {
      const { externalId: _key, ...rest } = f;
      await tx.insert(foodLogs, f).onConflictDoUpdate({ target: [foodLogs.userId, foodLogs.externalId], set: rest });
    }
    for (const f of rows.privateFoods) {
      const exists = await tx.foods.visible(and(eq(foods.ownerId, tx.userId), sql`lower(${foods.name}) = lower(${f.name})`));
      if (!exists.length) await tx.foods.insert({ ...f, category: "Mine" });
    }
    for (const m of rows.meals) {
      const [existing] = await tx.select(meals, sql`lower(${meals.name}) = lower(${m.name})`).limit(1);
      if (existing) await tx.update(meals, m, eq(meals.id, existing.id));
      else await tx.insert(meals, m);
    }
    const p = Object.fromEntries(Object.entries(rows.profile).filter(([, v]) => v != null));
    if (Object.keys(p).length) await saveProfile(tx, p);
  });
  return counts;
}
