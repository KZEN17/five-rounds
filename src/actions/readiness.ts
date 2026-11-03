"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { userAction } from "@/lib/actions";
import { latestInput } from "@/lib/db/plan-store";
import { applySuggestions, ignoreSuggestions } from "@/lib/db/readiness-store";
import { readiness } from "@/lib/db/schema";

const score = z.number().int().min(1).max(5).nullable();

export const saveReadiness = userAction(
  z.object({
    sleepH: z.number().min(0).max(16).nullable(),
    rhr: z.number().int().min(25).max(150).nullable(),
    hrv: z.number().min(1).max(300).nullable(),
    soreness: score,
    mood: score,
  }),
  async (values, { db, today }) => {
    await db
      .insert(readiness, { date: today, ...values })
      .onConflictDoUpdate({ target: [readiness.userId, readiness.date], set: values });
    revalidatePath("/today");
    return null;
  },
);

export const applyReadinessSwaps = userAction(z.object({}), async (_input, { db, today }) => {
  const input = await latestInput(db);
  const applied = await applySuggestions(db, today, input?.data);
  revalidatePath("/today");
  revalidatePath("/plan");
  return applied.length;
});

export const ignoreReadinessSwaps = userAction(z.object({}), async (_input, { db, today }) => {
  await ignoreSuggestions(db, today);
  revalidatePath("/today");
  return null;
});
