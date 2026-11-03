// GET  /api/state  -> { state }        the saved app data (or null)
// PUT  /api/state  { state } -> { ok }  replace the saved app data
// Needs a signed-in session (see api/login.js). Data lives in Upstash Redis.
import { hasSession } from "./_lib/session.js";
import { redis, redisConfigured } from "./_lib/redis.js";

const KEY = "five-rounds:state";
const MAX_BYTES = 900_000;

export default async function handler(req, res) {
  res.setHeader("cache-control", "no-store");
  if (!hasSession(req)) return res.status(401).json({ error: "Sign in first." });
  if (!redisConfigured()) return res.status(503).json({ error: "Connect Upstash Redis in Vercel first." });

  try {
    if (req.method === "GET") {
      const raw = await redis(["GET", KEY]);
      return res.status(200).json({ state: raw ? JSON.parse(raw) : null });
    }

    if (req.method === "PUT") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      if (!body.state || typeof body.state !== "object" || Array.isArray(body.state)) {
        return res.status(400).json({ error: "Expected { state: {...} }." });
      }
      const raw = JSON.stringify(body.state);
      if (Buffer.byteLength(raw) > MAX_BYTES) return res.status(413).json({ error: "Data is too large." });
      const prev = await redis(["GET", KEY]);
      if (prev) await redis(["SET", `${KEY}:previous`, prev]); // one-step undo
      await redis(["SET", KEY, raw]);
      return res.status(200).json({ ok: true });
    }

    res.setHeader("allow", "GET, PUT");
    return res.status(405).json({ error: "Use GET or PUT." });
  } catch (err) {
    console.error(err);
    return res.status(502).json({ error: "Could not reach storage." });
  }
}