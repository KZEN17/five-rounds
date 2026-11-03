import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

// Load .env / .env.local the same way Next does.
loadEnvConfig(process.cwd());

const url = process.env.DATABASE_URL ?? "pglite://.pglite";
const pglite = url.startsWith("pglite:");

// Say which database we're about to touch (host only, never credentials).
console.error(`drizzle: ${pglite ? `PGlite at ${url.replace(/^pglite:(\/\/)?/, "")}` : `Postgres at ${new URL(url).host}`}`);

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  ...(pglite
    ? { driver: "pglite", dbCredentials: { url: url.replace(/^pglite:(\/\/)?/, "") } }
    : { dbCredentials: { url } }),
});
