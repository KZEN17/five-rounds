import { profiles } from "./schema";
import { RAW, type ScopedDb } from "./scoped";

type ProfileFields = Partial<Omit<typeof profiles.$inferInsert, "userId" | "createdAt" | "updatedAt">>;

/** Creates or updates the signed-in user's profile row. */
export async function saveProfile(db: ScopedDb, values: ProfileFields) {
  await db[RAW].insert(profiles).values({ ...values, userId: db.userId }).onConflictDoUpdate({ target: profiles.userId, set: values });
}

export async function getProfile(db: ScopedDb) {
  const [row] = await db.select(profiles).limit(1);
  return row;
}
