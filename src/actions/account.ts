"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { userAction } from "@/lib/actions";
import { saveProfile } from "@/lib/db/profile";
import { deleteAccount } from "@/lib/db/users";
import { requireUser } from "@/lib/session";

/** Permanently deletes the account and every row that belongs to it. */
export async function deleteMyAccount(confirm: string): Promise<{ error: string } | never> {
  if (confirm !== "DELETE") return { error: 'Type DELETE to confirm.' };
  const { user } = await requireUser();
  await deleteAccount(user.id);
  redirect("/");
}

export const saveDevice = userAction(
  z.object({ device: z.enum(["apple", "garmin", "none"]), z2CeilingBpm: z.number().int().min(80).max(200).nullable() }),
  async (values, { db }) => {
    await saveProfile(db, values);
    revalidatePath("/settings/devices");
    return null;
  },
);
