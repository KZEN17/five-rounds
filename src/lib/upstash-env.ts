// Finds the Upstash REST credentials whatever prefix Vercel gave them:
// KV_REST_API_URL, UPSTASH_REDIS_REST_URL, STORAGE_KV_REST_API_URL, MYDB_KV_REST_API_URL, …
// (ported from legacy/api/_lib/redis.js).

type Env = Record<string, string | undefined>;

const URL_NAMES = [/^KV_REST_API_URL$/, /^UPSTASH_REDIS_REST_URL$/, /KV_REST_API_URL$/, /REDIS_REST_URL$/, /REDIS_REST_API_URL$/];
const TOKEN_NAMES = [/^KV_REST_API_TOKEN$/, /^UPSTASH_REDIS_REST_TOKEN$/, /KV_REST_API_TOKEN$/, /REDIS_REST_TOKEN$/, /REDIS_REST_API_TOKEN$/];

function findEnv(patterns: RegExp[], env: Env): string {
  for (const p of patterns) {
    const exact = env[p.source.replace(/[\^$]/g, "")];
    if (exact) return exact;
  }
  for (const [name, value] of Object.entries(env)) {
    if (value && patterns.some((p) => p.test(name))) return value;
  }
  return "";
}

export function upstashConfig(env: Env = process.env): { url: string; token: string } | null {
  const url = findEnv(URL_NAMES, env);
  const token = findEnv(TOKEN_NAMES, env);
  return url && token ? { url, token } : null;
}
