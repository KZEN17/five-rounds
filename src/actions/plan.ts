"use server";

import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { UserError, userAction, type ActionContext } from "@/lib/actions";
import { activePlan, latestInput, sessionsFor, toParams } from "@/lib/db/plan-store";
import { planSessions, sessionLogs, weekMarks } from "@/lib/db/schema";
import { contextFor, sessionTemplate, type Session, type SessionType } from "@/lib/engine";

const SESSION_TYPES = [
  "bjj",
  "bjj_technical",
  "open_mat",
  "comp_sim",
  "intervals",
  "aerobic",
  "strength",
  "mobility",
  "walk",
  "competition",
  "custom",
] as const satisfies readonly SessionType[];
const isoDate = z.iso.date();
const timeOfDay = z.enum(["morning", "midday", "evening"]).nullable();

function refresh() {
  revalidatePath("/plan");
  revalidatePath("/today");
  revalidatePath("/fuel");
}

async function ownSession(ctx: ActionContext, id: string) {
  const [row] = await ctx.db.select(planSessions, and(eq(planSessions.id, id), isNull(planSessions.deletedAt))).limit(1);
  if (!row) throw new UserError("That session no longer exists. Refresh the page.");
  return row;
}

async function template(ctx: ActionContext, type: SessionType, date: string): Promise<Session> {
  const [plan, input] = await Promise.all([activePlan(ctx.db), latestInput(ctx.db)]);
  if (!plan || !input) throw new UserError("Set up your plan first.");
  return sessionTemplate(type, contextFor(plan.output, input.data, date));
}

/** Marks every session of a day done (or not). */
export const setDayDone = userAction(z.object({ date: isoDate, done: z.boolean() }), async ({ date, done }, ctx) => {
  const sessions = await ctx.db.select(planSessions, and(eq(planSessions.date, date), isNull(planSessions.deletedAt)));
  for (const s of sessions) {
    await ctx.db
      .insert(sessionLogs, { sessionId: s.id, date, done })
      .onConflictDoUpdate({ target: sessionLogs.sessionId, set: { done } });
  }
  refresh();
  return null;
});

export const setWeekDone = userAction(z.object({ weekStart: isoDate, done: z.boolean() }), async ({ weekStart, done }, ctx) => {
  await ctx.db
    .insert(weekMarks, { weekStart, done })
    .onConflictDoUpdate({ target: [weekMarks.userId, weekMarks.weekStart], set: { done } });
  refresh();
  return null;
});

export const swapSession = userAction(
  z.object({ sessionId: z.uuid(), type: z.enum(SESSION_TYPES) }),
  async ({ sessionId, type }, ctx) => {
    const row = await ownSession(ctx, sessionId);
    const next = await template(ctx, type, row.date);
    await ctx.db.update(
      planSessions,
      { type: next.type, title: next.title, params: toParams(next), source: "user" },
      eq(planSessions.id, sessionId),
    );
    refresh();
    return null;
  },
);

export const setTimeOfDay = userAction(z.object({ sessionId: z.uuid(), timeOfDay }), async ({ sessionId, timeOfDay }, ctx) => {
  await ownSession(ctx, sessionId);
  await ctx.db.update(planSessions, { timeOfDay, source: "user" }, eq(planSessions.id, sessionId));
  refresh();
  return null;
});

export const setSessionParams = userAction(
  z.object({
    sessionId: z.uuid(),
    minutes: z.number().int().min(5).max(300).optional(),
    rounds: z.number().int().min(1).max(12).optional(),
    title: z.string().trim().min(1).max(80).optional(),
  }),
  async ({ sessionId, minutes, rounds, title }, ctx) => {
    const row = await ownSession(ctx, sessionId);
    const params = { ...row.params };
    let nextTitle = row.title;
    if (minutes != null) {
      params.minutes = minutes;
      nextTitle = nextTitle.replace(/\d+ min$/, `${minutes} min`);
    }
    if (rounds != null) {
      params.rounds = rounds;
      nextTitle = nextTitle.replace(/\d+ ×/, `${rounds} ×`);
    }
    if (title != null && row.type === "custom") nextTitle = title;
    await ctx.db.update(planSessions, { params, title: nextTitle, source: "user" }, eq(planSessions.id, sessionId));
    refresh();
    return null;
  },
);

export const addSession = userAction(
  z.object({ date: isoDate, type: z.enum(SESSION_TYPES), timeOfDay }),
  async ({ date, type, timeOfDay }, ctx) => {
    const next = await template(ctx, type, date);
    const existing = await ctx.db.select(planSessions, eq(planSessions.date, date));
    const order = existing.reduce((m, s) => Math.max(m, s.order), -1) + 1;
    const plan = await activePlan(ctx.db);
    await ctx.db.insert(planSessions, {
      planId: plan?.id ?? null,
      date,
      order,
      type: next.type,
      title: next.title,
      params: toParams(next),
      timeOfDay,
      source: "user",
    });
    refresh();
    return null;
  },
);

export const removeSession = userAction(z.object({ sessionId: z.uuid() }), async ({ sessionId }, ctx) => {
  await ownSession(ctx, sessionId);
  await ctx.db.update(planSessions, { deletedAt: new Date() }, eq(planSessions.id, sessionId));
  refresh();
  return null;
});

/** Puts the day back the way the plan made it. Logged sessions stay; logs are never deleted. */
export const resetDay = userAction(z.object({ date: isoDate }), async ({ date }, ctx) => {
  const plan = await activePlan(ctx.db);
  if (!plan) throw new UserError("Set up your plan first.");
  const onDay = (...more: Parameters<typeof and>) => and(eq(planSessions.date, date), ...more);
  const live = await ctx.db.select(planSessions, onDay(isNull(planSessions.deletedAt)));
  const logged = new Set((await ctx.db.select(sessionLogs, eq(sessionLogs.date, date))).map((l) => l.sessionId));
  const keep = live.filter((s) => logged.has(s.id));
  for (const s of live) {
    if (!logged.has(s.id)) await ctx.db.update(planSessions, { deletedAt: new Date() }, eq(planSessions.id, s.id));
  }
  // Removed rows stop counting as edits of this plan; kept (logged) ones count as the plan again.
  await ctx.db.update(planSessions, { planId: null }, onDay(isNotNull(planSessions.deletedAt), eq(planSessions.planId, plan.id)));
  for (const s of keep) await ctx.db.update(planSessions, { source: "generated", planId: plan.id }, eq(planSessions.id, s.id));
  const keptTypes = new Set(keep.map((s) => s.type));
  const rows = sessionsFor(plan.output, date)
    .map((s, order) => ({ s, order }))
    .filter(({ s }) => !keptTypes.has(s.type))
    .map(({ s, order }) => ({
      planId: plan.id,
      date,
      order,
      type: s.type,
      title: s.title,
      params: toParams(s),
      timeOfDay: s.timeOfDay ?? null,
      source: "generated" as const,
    }));
  if (rows.length) await ctx.db.insert(planSessions, rows);
  refresh();
  return null;
});

const num = z.number().finite().nullable();
export const saveLog = userAction(
  z.object({
    sessionId: z.uuid(),
    done: z.boolean(),
    minutes: z.number().int().min(0).max(600).nullable(),
    avgHr: z.number().int().min(30).max(240).nullable(),
    maxHr: z.number().int().min(30).max(240).nullable(),
    rpe: z.number().min(0).max(10).nullable(),
    hardRounds: z.number().int().min(0).max(60).nullable(),
    outputUnit: z.enum(["m", "cal"]).nullable(),
    rounds: z
      .array(z.object({ rpe: num, gas: z.enum(["Attacking", "Holding on", "Survival"]).nullable(), endHr: num, recHr: num, output: num }))
      .max(12)
      .nullable(),
    exercises: z
      .array(z.object({ name: z.string().max(80), done: z.boolean(), detail: z.string().max(80).optional() }))
      .max(30)
      .nullable(),
    notes: z.string().max(2000).nullable(),
  }),
  async ({ sessionId, ...log }, ctx) => {
    const row = await ownSession(ctx, sessionId);
    await ctx.db
      .insert(sessionLogs, { sessionId, date: row.date, ...log })
      .onConflictDoUpdate({ target: sessionLogs.sessionId, set: log });
    refresh();
    return null;
  },
);
