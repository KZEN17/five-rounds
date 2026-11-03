import { eq } from "drizzle-orm";
import type { z } from "zod";
import type { IsoDate } from "@/lib/engine";
import { profiles } from "@/lib/db/schema";
import type { ScopedDb } from "@/lib/db/scoped";
import { requireUser } from "@/lib/session";
import { todayIn } from "@/lib/time";

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

export type ActionContext = {
  user: Awaited<ReturnType<typeof requireUser>>["user"];
  db: ScopedDb;
  today: IsoDate;
  timezone: string;
};

/** Thrown inside an action to show the message to the user as-is. */
export class UserError extends Error {}

/**
 * Every Server Action goes through here: zod-validated input, a signed-in user,
 * a database handle locked to that user, and errors that never leak internals.
 */
export function userAction<S extends z.ZodType, T>(schema: S, handler: (input: z.output<S>, ctx: ActionContext) => Promise<T>) {
  return async (raw: z.input<S>): Promise<ActionResult<T>> => {
    const parsed = schema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "That input isn't valid." };
    const { user, db } = await requireUser();
    const [profile] = await db.select(profiles).limit(1);
    const timezone = profile?.timezone ?? "UTC";
    try {
      return { ok: true, data: await handler(parsed.data, { user, db, today: todayIn(timezone), timezone }) };
    } catch (error) {
      if (error instanceof UserError) return { ok: false, error: error.message };
      // Next's redirect()/notFound() work by throwing; let them through.
      if (error && typeof error === "object" && "digest" in error) throw error;
      console.error(error);
      return { ok: false, error: "Something went wrong. Try again." };
    }
  };
}

export async function userTimezone(db: ScopedDb): Promise<string> {
  const [profile] = await db.select(profiles, eq(profiles.userId, db.userId)).limit(1);
  return profile?.timezone ?? "UTC";
}
