// GET  /api/state  -> { state }        the saved app data (or null)
// PUT  /api/state  { state } -> { ok }  replace the saved app data
// Both need the header x-app-key to match the APP_KEY environment variable.
// Data lives in Upstash Redis (Vercel → Storage → Upstash for Redis).
import { timingSafeEqual } from "node:crypto";

const KEY = "five-rounds:state";
const MAX_BYTES = 900_000;

function keyMatches(given, expected) {
  const a = Buffer.from(String(given || ""));
  const b = Buffer.from(String(expected));
  return a.length === b.length && timingSafeEqual(a, b);
}

async function redis(command) {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  const res = await fetch(url, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(command),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) throw new Error(json.error || `Redis ${res.status}`);
  return json.result;
}

export default async function handler(req, res) {
  res.setHeader("cache-control", "no-store");

  const configured =
    (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL) &&
    (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN) &&
    process.env.APP_KEY;
  if (!configured) {
    return res.status(503).json({ error: "Storage is not set up. Add Upstash Redis and APP_KEY in Vercel." });
  }
  if (!keyMatches(req.headers["x-app-key"], process.env.APP_KEY)) {
    return res.status(401).json({ error: "Wrong passcode." });
  }

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
      if (Buffer.byteLength(raw) > MAX_BYTES) {
        return res.status(413).json({ error: "Data is too large." });
      }
      // Keep the previous copy as a one-step undo.
      const prev = await redis(["GET", KEY]);
      if (prev) await redis(["SET", `${KEY}:previous`, prev]);
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
