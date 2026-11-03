"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { UserError, userAction } from "@/lib/actions";
import { foodLogs, meals, weights } from "@/lib/db/schema";

const isoDate = z.iso.date();
const macro = z.number().min(0).max(5000);
const name = z.string().trim().min(1, "Give it a name.").max(120);

const refresh = () => revalidatePath("/fuel");

export const addFoodLog = userAction(
  z.object({ date: isoDate, name, kcal: macro, p: macro.nullable(), c: macro.nullable(), f: macro.nullable(), ingredients: z.string().max(1000).nullable() }),
  async (values, { db }) => {
    await db.insert(foodLogs, values);
    refresh();
    return null;
  },
);

export const deleteFoodLog = userAction(z.object({ id: z.uuid() }), async ({ id }, { db }) => {
  await db.delete(foodLogs, eq(foodLogs.id, id));
  refresh();
  return null;
});

const mealItem = z.object({ name: z.string().max(120), kcal: macro, p: macro, c: macro, f: macro, g: z.number().min(0).max(5000) });

/** Saves the meal; a meal with the same name is updated instead of duplicated. */
export const saveMeal = userAction(
  z.object({ name, items: z.array(mealItem).min(1).max(60), portions: z.number().min(0.1).max(50) }),
  async ({ name: mealName, items, portions }, { db }) => {
    const sameName = sql`lower(${meals.name}) = lower(${mealName})`;
    const [existing] = await db.select(meals, sameName).limit(1);
    if (existing) await db.update(meals, { name: mealName, items, portions }, eq(meals.id, existing.id));
    else await db.insert(meals, { name: mealName, items, portions });
    refresh();
    return existing ? "updated" : "saved";
  },
);

export const deleteMeal = userAction(z.object({ id: z.uuid() }), async ({ id }, { db }) => {
  await db.delete(meals, eq(meals.id, id));
  refresh();
  return null;
});

/** A private ingredient from a label, per 100 g. kcal defaults to 4/4/9 from the macros. */
export const createFood = userAction(
  z.object({ name, kcal: macro.nullable(), p: macro, c: macro, f: macro }),
  async ({ name: foodName, kcal, p, c, f }, { db }) => {
    try {
      await db.foods.insert({ name: foodName, kcal: kcal ?? Math.round(p * 4 + c * 4 + f * 9), p, c, f, category: "Mine" });
    } catch {
      throw new UserError("You already have an ingredient with that name.");
    }
    refresh();
    return null;
  },
);

export const deleteFood = userAction(z.object({ id: z.uuid() }), async ({ id }, { db }) => {
  await db.foods.delete(id);
  refresh();
  return null;
});

export const saveWeight = userAction(z.object({ date: isoDate, kg: z.number().min(30).max(300).nullable() }), async ({ date, kg }, { db }) => {
  if (kg == null) await db.delete(weights, eq(weights.date, date));
  else await db.insert(weights, { date, kg }).onConflictDoUpdate({ target: [weights.userId, weights.date], set: { kg } });
  refresh();
  revalidatePath("/progress");
  return null;
});
