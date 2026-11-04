import { asc, eq } from "drizzle-orm";
import type { CalendarComp, PlanInput } from "@/lib/engine";
import { competitions } from "./schema";
import type { ScopedDb } from "./scoped";

export type CompetitionRow = typeof competitions.$inferSelect;
export type CompetitionFields = Omit<typeof competitions.$inferInsert, "id" | "userId" | "isMain" | "createdAt" | "updatedAt">;

export function fieldsFromInput(c: PlanInput["competition"]): CompetitionFields {
  return {
    name: c.name,
    date: c.date,
    gi: c.gi,
    weighInTiming: c.weighIn,
    targetWeightKg: c.targetWeightKg,
    matchLenSec: Math.round(c.matchMinutes * 60),
    matches: c.matches,
    restMin: c.restMinutes,
    isTest: c.kind === "test",
  };
}

/** The plan answers' competition section, from a calendar row. */
export function inputFromRow(row: CompetitionRow): PlanInput["competition"] {
  return {
    kind: row.isTest ? "test" : "competition",
    name: row.name,
    date: row.date,
    gi: row.gi,
    weighIn: row.weighInTiming,
    targetWeightKg: row.targetWeightKg,
    matchMinutes: row.matchLenSec / 60,
    matches: row.matches,
    restMinutes: row.restMin,
  };
}

export function toCalendarComp(row: CompetitionRow): CalendarComp {
  return { id: row.id, name: row.name, date: row.date, weighIn: row.weighInTiming, limitKg: row.targetWeightKg, isMain: row.isMain };
}

export async function listCompetitions(db: ScopedDb): Promise<CompetitionRow[]> {
  return db.select(competitions).orderBy(asc(competitions.date), asc(competitions.createdAt));
}

/** Updates the main competition (the one the plan peaks for), or adds it as main. */
export async function saveMainCompetition(db: ScopedDb, fields: CompetitionFields) {
  const [main] = await db.select(competitions, eq(competitions.isMain, true)).limit(1);
  if (main) await db.update(competitions, fields, eq(competitions.id, main.id));
  else await db.insert(competitions, { ...fields, isMain: true });
}

/** Makes one competition the main one. The partial unique index allows only one per user. */
export async function setMainCompetition(db: ScopedDb, id: string) {
  await db.transaction(async (tx) => {
    await tx.update(competitions, { isMain: false }, eq(competitions.isMain, true));
    await tx.update(competitions, { isMain: true }, eq(competitions.id, id));
  });
}
