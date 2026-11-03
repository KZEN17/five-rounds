// GET  /api/login -> { totp }                       whether a 6-digit code is required
// POST /api/login { passcode, code? } -> { ok }     sets the session cookie
// 5 wrong attempts from one IP locks it out for 15 minutes.
import { createHmac, timingSafeEqual } from "node:crypto";

const LIMIT = 5;
const WINDOW = 15 * 60;

export default async function handler(req, res) {
    res.setHeader("cache-control", "no-store");

    try {
        return await route(req, res);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Login failed on the server: " + (err && err.message ? err.message : String(err)) });
    }
}

async function route(req, res) {
    const totpOn = Boolean(process.env.TOTP_SECRET);
    if (req.method === "GET") {
        // Setup status for the login page. Reports variable names only, never values.
        const redisOk = redisConfigured();
        let redisReachable = false;
        if (redisOk) { try { redisReachable = (await redis(["PING"])) === "PONG"; } catch (e) { console.error(e); } }
        return res.status(200).json({
            totp: totpOn,
            setup: { appKey: Boolean(process.env.APP_KEY), redis: redisOk, redisReachable, redisVars: redisOk ? [] : redisEnvNames() },
        });
    }
    if (req.method !== "POST") {
        res.setHeader("allow", "GET, POST");
        return res.status(405).json({ error: "Use POST." });
    }
    if (!process.env.APP_KEY) return res.status(503).json({ error: "APP_KEY is not set in Vercel." });
    if (!redisConfigured()) return res.status(503).json({ error: "Connect Upstash Redis in Vercel first." });

    try {
        return await attempt(req, res, totpOn);
    } catch (err) {
        console.error(err);
        return res.status(502).json({ error: "Redis didn't answer: " + (err && err.message ? err.message : String(err)) });
    }
}

async function attempt(req, res, totpOn) {
    const ip = String(req.headers["x-forwarded-for"] || "unknown").split(",")[0].trim();
    const bucket = `five-rounds:login:${ip}`;
    const attempts = Number(await redis(["GET", bucket])) || 0;
    if (attempts >= LIMIT) {
        const ttl = Number(await redis(["TTL", bucket])) || WINDOW;
        return res.status(429).json({ error: `Too many attempts. Try again in ${Math.ceil(ttl / 60)} min.` });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const ok = same(body.passcode, process.env.APP_KEY) && (!totpOn || totpValid(body.code, process.env.TOTP_SECRET));

    if (!ok) {
        const n = await redis(["INCR", bucket]);
        if (Number(n) === 1) await redis(["EXPIRE", bucket, String(WINDOW)]);
        const left = LIMIT - Number(n);
        return res.status(401).json({ error: left > 0 ? `That didn't match. ${left} ${left === 1 ? "try" : "tries"} left.` : "Locked for 15 minutes." });
    }

    await redis(["DEL", bucket]);
    res.setHeader("set-cookie", sessionCookie(createSession()));
    return res.status(200).json({ ok: true });
}

// ---- shared helpers (kept in this file so there is nothing else to import) ----
const COOKIE = "fr_session";
const MAX_AGE = 60 * 60 * 24 * 60; // 60 days

const secret = () => process.env.SESSION_SECRET || process.env.APP_KEY;
const sign = (payload) => createHmac("sha256", secret()).update(payload).digest("base64url");

function createSession() {
    const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
    const payload = `v1.${exp}`;
    return `${payload}.${sign(payload)}`;
}

function sessionCookie(value, maxAge = MAX_AGE) {
    return `${COOKIE}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`;
}

function hasSession(req) {
    if (!secret()) return false;
    const raw = String(req.headers.cookie || "")
        .split(";").map((p) => p.trim()).find((p) => p.startsWith(`${COOKIE}=`));
    const token = raw ? raw.slice(COOKIE.length + 1) : "";
    const [ver, exp, sig] = token.split(".");
    if (ver !== "v1" || !exp || !sig || Number(exp) * 1000 < Date.now()) return false;
    const a = Buffer.from(sig), b = Buffer.from(sign(`${ver}.${exp}`));
    return a.length === b.length && timingSafeEqual(a, b);
}

function same(given, expected) {
    const a = Buffer.from(String(given || "")), b = Buffer.from(String(expected || ""));
    return b.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

// RFC 6238 time-based one-time code, 30 s steps, 6 digits, accepts ±1 step of clock drift.
function totpValid(code, base32Secret, now = Date.now()) {
    if (!/^\d{6}$/.test(String(code || ""))) return false;
    const key = base32Decode(base32Secret);
    const step = Math.floor(now / 1000 / 30);
    for (const drift of [-1, 0, 1]) {
        if (same(code, totp(key, step + drift))) return true;
    }
    return false;
}

function totp(key, counter) {
    const buf = Buffer.alloc(8);
    buf.writeBigUInt64BE(BigInt(counter));
    const h = createHmac("sha1", key).update(buf).digest();
    const o = h[h.length - 1] & 0xf;
    const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
    return String(n % 1_000_000).padStart(6, "0");
}

function base32Decode(s) {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    const clean = String(s).toUpperCase().replace(/[^A-Z2-7]/g, "");
    let bits = 0, value = 0;
    const out = [];
    for (const ch of clean) {
        value = (value << 5) | alphabet.indexOf(ch);
        bits += 5;
        if (bits >= 8) { out.push((value >>> (bits - 8)) & 0xff); bits -= 8; }
    }
    return Buffer.from(out);
}

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

function redisConfig() {
    return { url: findEnv(URL_NAMES), token: findEnv(TOKEN_NAMES) };
}

function redisConfigured() {
    const { url, token } = redisConfig();
    return Boolean(url && token);
}

// Names only (never values), to help diagnose setup.
function redisEnvNames() {
    return Object.keys(process.env).filter((n) => /KV_|REDIS|UPSTASH/.test(n)).sort();
}

async function redis(command) {
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
// ---- end helpers ----