import { sql } from "drizzle-orm";
import { getDb } from "./client";

/** Can we reach the database, and has it been migrated? Never returns connection details. */
export async function checkDatabase(): Promise<string> {
  if (!process.env.DATABASE_URL) return "missing DATABASE_URL";
  try {
    await getDb().execute(sql`select 1 from "user" limit 1`);
    return "ok";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/relation .* does not exist/i.test(message)) return "connected, but not migrated (run npm run db:migrate)";
    // Strip anything that looks like a connection string before reporting.
    return `error: ${message.replace(/postgres(ql)?:\/\/\S+/gi, "<url>").slice(0, 200)}`;
  }
}
