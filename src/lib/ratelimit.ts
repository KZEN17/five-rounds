import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { upstashConfig } from "@/lib/upstash-env";

/** Limits per kind: [requests, window]. */
const LIMITS = {
  "signin-email": [5, "15 m"],
  "signin-ip": [20, "15 m"],
  generate: [10, "1 h"],
  write: [120, "1 m"],
} as const;
export type LimitKind = keyof typeof LIMITS;

let limiters: Record<LimitKind, Ratelimit> | null | undefined;

function get(): Record<LimitKind, Ratelimit> | null {
  if (limiters !== undefined) return limiters;
  const cfg = upstashConfig();
  if (!cfg) return (limiters = null); // no Redis (local dev, tests): no limits
  const redis = new Redis({ url: cfg.url, token: cfg.token });
  limiters = Object.fromEntries(
    Object.entries(LIMITS).map(([kind, [n, window]]) => [
      kind,
      new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(n, window), prefix: `five-rounds:rl:${kind}` }),
    ]),
  ) as Record<LimitKind, Ratelimit>;
  return limiters;
}

/** True when the request may go ahead. Fails open if Redis is unreachable. */
export async function allow(kind: LimitKind, key: string): Promise<boolean> {
  const l = get();
  if (!l) return true;
  try {
    return (await l[kind].limit(key)).success;
  } catch (error) {
    console.error("Rate limiter unavailable", error);
    return true;
  }
}

export function clientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
}
