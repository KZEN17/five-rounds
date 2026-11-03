import { getAuth } from "@/lib/auth";
import { allow, clientIp } from "@/lib/ratelimit";
import { normalizeEmail } from "@/lib/signup-policy";

const tooMany = (message: string) =>
  Response.json({ message, code: "TOO_MANY_REQUESTS" }, { status: 429, headers: { "cache-control": "no-store" } });

export const GET = (request: Request) => getAuth().handler(request);

/** Sign-in emails are limited per address and per IP before Better Auth sees the request. */
export async function POST(request: Request) {
  if (new URL(request.url).pathname.endsWith("/sign-in/magic-link")) {
    const body = (await request.clone().json().catch(() => ({}))) as { email?: unknown };
    const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
    if (!(await allow("signin-ip", clientIp(request.headers)))) return tooMany("Too many sign-in attempts from here. Try again in 15 minutes.");
    if (email && !(await allow("signin-email", email))) return tooMany("Too many links sent to this email. Check your inbox, or try again in 15 minutes.");
  }
  return getAuth().handler(request);
}
