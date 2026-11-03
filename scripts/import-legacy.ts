// Brings the owner's data from the legacy app into the v2 tables.
//
//   npm run import:legacy -- --dry-run              read Redis key five-rounds:state, print counts, write nothing
//   npm run import:legacy                           import for real (safe to run again: it upserts)
//   npm run import:legacy -- --file backup.json     use the old app's Backup → Copy backup text instead of Redis
//
// Needs DATABASE_URL and OWNER_EMAIL (and the Upstash vars when reading Redis), from the
// environment or .env.local. The owner must have signed in to the new app once.
import { readFileSync } from "node:fs";
import * as nextEnv from "@next/env";
import { eq } from "drizzle-orm";
import { getDb } from "../src/lib/db/client";
import { importLegacy } from "../src/lib/db/data-store";
import { user } from "../src/lib/db/schema";
import { scoped } from "../src/lib/db/scoped";
import { isLegacyState, type LegacyState } from "../src/lib/legacy/map";
import { normalizeEmail } from "../src/lib/signup-policy";
import { upstashConfig } from "../src/lib/upstash-env";

// @next/env is CommonJS: under Node's ESM loader its exports sit on `default`.
const { loadEnvConfig } = "default" in nextEnv ? (nextEnv as unknown as { default: typeof nextEnv }).default : nextEnv;
loadEnvConfig(process.cwd());
const KEY = "five-rounds:state";
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const fileArg = args.indexOf("--file");
const file = fileArg >= 0 ? args[fileArg + 1] : undefined;

async function readState(): Promise<LegacyState> {
  let raw: unknown;
  if (file) {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } else {
    const cfg = upstashConfig();
    if (!cfg) throw new Error("No Upstash credentials found (KV_REST_API_URL / KV_REST_API_TOKEN or any prefixed variant).");
    const res = await fetch(cfg.url, {
      method: "POST",
      headers: { authorization: `Bearer ${cfg.token}`, "content-type": "application/json" },
      body: JSON.stringify(["GET", KEY]),
    });
    const json = (await res.json()) as { result?: string | null; error?: string };
    if (!res.ok || json.error) throw new Error(`Redis error: ${json.error ?? res.status}`);
    if (!json.result) throw new Error(`Redis key ${KEY} is empty.`);
    raw = JSON.parse(json.result);
  }
  if (!isLegacyState(raw)) throw new Error("That isn't the legacy app's data (expected { start, logs, … }).");
  return raw;
}

async function main() {
  const ownerEmail = process.env.OWNER_EMAIL;
  if (!ownerEmail) throw new Error("Set OWNER_EMAIL to the owner's sign-in email.");
  const state = await readState();
  const db = getDb();
  const [owner] = await db.select({ id: user.id }).from(user).where(eq(user.email, normalizeEmail(ownerEmail)));
  if (!owner) throw new Error(`No account for ${ownerEmail} yet. Sign in to the new app once, then run this again.`);

  console.log(`${dryRun ? "Dry run: would import" : "Importing"} for ${ownerEmail} (source: ${file ?? `Redis ${KEY}`}, plan start ${state.start})`);
  const counts = await importLegacy(scoped(db, owner.id), state, { dryRun });
  console.table(counts);
  console.log(dryRun ? "Nothing was written." : "Done. Running it again updates the same rows; nothing is duplicated.");
}

main().then(
  () => process.exit(0),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
