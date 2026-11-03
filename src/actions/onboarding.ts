"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { UserError, userAction } from "@/lib/actions";
import { saveAndGenerate } from "@/lib/db/plan-store";
import { deleteAccount, markOnboarded } from "@/lib/db/users";
import { daysBetween, planInputSchema } from "@/lib/engine";
import { requireUser } from "@/lib/session";
import { isTimeZone, todayIn } from "@/lib/time";

const submitSchema = z.object({
  input: planInputSchema,
  timezone: z.string().refine(isTimeZone, "Unknown time zone."),
});

/** Saves the answers, generates the plan (or a new version of it) and lays it out. */
export const submitOnboarding = userAction(submitSchema, async ({ input, timezone }, { user, db }) => {
  const today = todayIn(timezone);
  if (daysBetween(today, input.competition.date) < 1) throw new UserError("Pick a competition date after today.");
  await saveAndGenerate(db, input, today, timezone);
  await markOnboarded(user.id);
  revalidatePath("/", "layout");
  return null;
});

/** Five Rounds is for adults: an under-18 answer removes the account. */
export async function rejectUnderage(): Promise<void> {
  const { user } = await requireUser();
  await deleteAccount(user.id);
  redirect("/?under18=1");
}
