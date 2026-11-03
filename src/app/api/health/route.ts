import { appBaseUrl } from "@/lib/auth";
import { checkDatabase } from "@/lib/db/health";
import { upstashConfig } from "@/lib/upstash-env";

export const dynamic = "force-dynamic";

/** Setup status for this deployment: which settings it sees (yes/no, never values) and whether the database works. */
export async function GET() {
  const env = process.env;
  const settings = {
    DATABASE_URL: Boolean(env.DATABASE_URL),
    AUTH_SECRET: Boolean(env.AUTH_SECRET),
    AUTH_RESEND_KEY: Boolean(env.AUTH_RESEND_KEY),
    EMAIL_FROM: Boolean(env.EMAIL_FROM),
    OWNER_EMAIL: Boolean(env.OWNER_EMAIL),
    SIGNUP_MODE: env.SIGNUP_MODE === "invite" ? "invite" : "open",
    GOOGLE: Boolean(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET),
    UPSTASH: Boolean(upstashConfig()),
  };
  const database = await checkDatabase();
  const missing = Object.entries(settings)
    .filter(([name, ok]) => ok === false && ["DATABASE_URL", "AUTH_SECRET", "AUTH_RESEND_KEY", "EMAIL_FROM"].includes(name))
    .map(([name]) => name);
  return Response.json(
    { ok: missing.length === 0 && database === "ok", environment: env.VERCEL_ENV ?? "local", appUrl: appBaseUrl(), settings, database, missing },
    { headers: { "cache-control": "no-store" } },
  );
}
