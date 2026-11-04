"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { UserError, userAction, type ActionContext } from "@/lib/actions";
import { inputFromRow, listCompetitions, setMainCompetition, type CompetitionRow } from "@/lib/db/competition-store";
import { latestInput, saveAndGenerate } from "@/lib/db/plan-store";
import { competitions } from "@/lib/db/schema";
import { daysBetween, planInputSchema } from "@/lib/engine";
import { allow } from "@/lib/ratelimit";

const competition = z.object({
  name: z.string().trim().min(1, "Give it a name.").max(120),
  date: z.iso.date(),
  gi: z.enum(["gi", "nogi"]),
  weighIn: z.enum(["same_day", "day_before", "unsure"]),
  limitKg: z.number().min(35).max(250).nullable(),
  matchMinutes: z.number().min(2).max(15),
  matches: z.number().int().min(1).max(10),
  restMinutes: z.number().min(0).max(240),
});
type CompetitionInput = z.infer<typeof competition>;

const fields = (v: CompetitionInput) => ({
  name: v.name,
  date: v.date,
  gi: v.gi,
  weighInTiming: v.weighIn,
  targetWeightKg: v.limitKg,
  matchLenSec: Math.round(v.matchMinutes * 60),
  matches: v.matches,
  restMin: v.restMinutes,
  isTest: false,
});

function refresh() {
  for (const p of ["/competitions", "/fuel", "/plan", "/today"]) revalidatePath(p);
}

async function own(ctx: ActionContext, id: string): Promise<CompetitionRow> {
  const [row] = await ctx.db.select(competitions, eq(competitions.id, id)).limit(1);
  if (!row) throw new UserError("That competition no longer exists. Refresh the page.");
  return row;
}

/** Rebuilds the training plan for the main competition. Logged and past sessions stay. */
async function rebuildFor(ctx: ActionContext, row: CompetitionRow) {
  if (daysBetween(ctx.today, row.date) < 1) throw new UserError("The main competition has to be after today.");
  if (!(await allow("generate", ctx.user.id))) throw new UserError("You've rebuilt the plan a lot in the last hour. Try again later.");
  const latest = await latestInput(ctx.db);
  if (!latest) throw new UserError("Set up your plan first.");
  const input = planInputSchema.parse({ ...latest.data, competition: inputFromRow(row) });
  await saveAndGenerate(ctx.db, input, ctx.today, ctx.timezone);
}

export const addCompetition = userAction(competition, async (v, ctx) => {
  if (v.date < ctx.today) throw new UserError("Pick a date from today on.");
  const existing = await listCompetitions(ctx.db);
  await ctx.db.insert(competitions, { ...fields(v), isMain: !existing.some((c) => c.isMain) });
  refresh();
  return null;
});

export const updateCompetition = userAction(competition.extend({ id: z.uuid() }), async ({ id, ...v }, ctx) => {
  const row = await own(ctx, id);
  const next = { ...row, ...fields(v) };
  // Changing the main competition changes the plan; validate before writing anything.
  if (row.isMain) await rebuildFor(ctx, next);
  else await ctx.db.update(competitions, fields(v), eq(competitions.id, id));
  refresh();
  return row.isMain ? "rebuilt" : "saved";
});

export const deleteCompetition = userAction(z.object({ id: z.uuid() }), async ({ id }, ctx) => {
  const row = await own(ctx, id);
  if (row.isMain) throw new UserError("This is your main competition. Make another one main first.");
  await ctx.db.delete(competitions, eq(competitions.id, id));
  refresh();
  return null;
});

/** Makes this the competition the training plan peaks for, and rebuilds the plan. */
export const makeMainCompetition = userAction(z.object({ id: z.uuid() }), async ({ id }, ctx) => {
  const row = await own(ctx, id);
  if (row.isMain) return null;
  if (daysBetween(ctx.today, row.date) < 1) throw new UserError("Pick an upcoming competition.");
  await setMainCompetition(ctx.db, id);
  await rebuildFor(ctx, { ...row, isMain: true });
  refresh();
  return null;
});
