import { PGlite } from "@electric-sql/pglite";
import { Pool } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import * as schema from "./schema";

export type Schema = typeof schema;
/** The shape both drivers share. App code only ever sees this type. */
export type Database = PgDatabase<PgQueryResultHKT, Schema>;

/**
 * `DATABASE_URL` is a Postgres URL (Neon) or `pglite://<dir>` for a local
 * in-process database. `pglite://memory` keeps it in memory.
 */
export function createDb(url: string): Database {
  if (url.startsWith("pglite:")) {
    const dir = pgliteDir(url);
    return drizzlePglite(new PGlite(dir === "memory" ? undefined : dir), { schema });
  }
  return drizzleNeon(new Pool({ connectionString: url }), { schema });
}

export function pgliteDir(url: string): string {
  return url.replace(/^pglite:(\/\/)?/, "") || "memory";
}

// One instance per server process. Next dev reloads modules, so keep it on globalThis.
const holder = globalThis as unknown as { __fiveRoundsDb?: Database };

export function getDb(): Database {
  if (!holder.__fiveRoundsDb) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set. See .env.example.");
    holder.__fiveRoundsDb = createDb(url);
  }
  return holder.__fiveRoundsDb;
}
