// GET  /api/login -> { totp }                       whether a 6-digit code is required
// POST /api/login { passcode, code? } -> { ok }     sets the session cookie
// 5 wrong attempts from one IP locks it out for 15 minutes.
import { createSession, sessionCookie, same, totpValid } from "./_lib/session.js";
import { redis, redisConfigured } from "./_lib/redis.js";

const LIMIT = 5;
const WINDOW = 15 * 60;

export default async function handler(req, res) {
    res.setHeader("cache-control", "no-store");
    const totpOn = Boolean(process.env.TOTP_SECRET);

    if (req.method === "GET") return res.status(200).json({ totp: totpOn });
    if (req.method !== "POST") {
        res.setHeader("allow", "GET, POST");
        return res.status(405).json({ error: "Use POST." });
    }
    if (!process.env.APP_KEY) return res.status(503).json({ error: "APP_KEY is not set in Vercel." });
    if (!redisConfigured()) return res.status(503).json({ error: "Connect Upstash Redis in Vercel first." });

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