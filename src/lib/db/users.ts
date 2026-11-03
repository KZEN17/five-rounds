import { eq } from "drizzle-orm";
import { getDb, type Database } from "./client";
import { user } from "./schema";

// Account-level writes on the `user` table. Callers pass the signed-in user's own id.

export async function markOnboarded(userId: string, db: Database = getDb()) {
  await db.update(user).set({ onboardedAt: new Date() }).where(eq(user.id, userId));
}

/** Hard delete: every user-owned table cascades from `user`. */
export async function deleteAccount(userId: string, db: Database = getDb()) {
  await db.delete(user).where(eq(user.id, userId));
}
