import { appBaseUrl } from "@/lib/auth";
import { runReportJob } from "@/lib/db/report-job";
import { reportEmailSenderFromEnv } from "@/lib/mail";
import { pushSenderFromEnv } from "@/lib/push";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Daily reports, pushes and Monday emails. Vercel Cron calls this with
 * `Authorization: Bearer $CRON_SECRET`; anything else is refused, and so is
 * every request when CRON_SECRET isn't set.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const summary = await runReportJob({ now: new Date(), sendPush: pushSenderFromEnv(), sendEmail: reportEmailSenderFromEnv(appBaseUrl()) });
  return Response.json(summary, { headers: { "cache-control": "no-store" } });
}
