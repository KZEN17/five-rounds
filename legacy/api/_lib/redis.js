// Finds the Upstash REST credentials whatever prefix Vercel gave them:
// KV_REST_API_URL, UPSTASH_REDIS_REST_URL, STORAGE_KV_REST_API_URL, MYDB_KV_REST_API_URL, ...
function findEnv(patterns) {
    for (const p of patterns) {
        const exact = process.env[p.source.replace(/[\^$]/g, "")];
        if (exact) return exact;
    }
    for (const [name, value] of Object.entries(process.env)) {
        if (value && patterns.some((p) => p.test(name))) return value;
    }
    return "";
}

const URL_NAMES = [/^KV_REST_API_URL$/, /^UPSTASH_REDIS_REST_URL$/, /KV_REST_API_URL$/, /REDIS_REST_URL$/, /REDIS_REST_API_URL$/];
const TOKEN_NAMES = [/^KV_REST_API_TOKEN$/, /^UPSTASH_REDIS_REST_TOKEN$/, /KV_REST_API_TOKEN$/, /REDIS_REST_TOKEN$/, /REDIS_REST_API_TOKEN$/];

export function redisConfig() {
    return { url: findEnv(URL_NAMES), token: findEnv(TOKEN_NAMES) };
}

export function redisConfigured() {
    const { url, token } = redisConfig();
    return Boolean(url && token);
}

// Names only (never values), to help diagnose setup.
export function redisEnvNames() {
    return Object.keys(process.env).filter((n) => /KV_|REDIS|UPSTASH/.test(n)).sort();
}

export async function redis(command) {
    const { url, token } = redisConfig();
    const res = await fetch(url, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify(command),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.error) throw new Error(json.error || `Redis ${res.status}`);
    return json.result;
}