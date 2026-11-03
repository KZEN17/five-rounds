// GET  /api/state  -> { state }        the saved app data (or null)
// PUT  /api/state  { state } -> { ok }  replace the saved app data
// Needs a signed-in session (see api/login.js). Data lives in Upstash Redis.
import { createHmac, timingSafeEqual } from "node:crypto";

const KEY = "five-rounds:state";
const MAX_BYTES = 900_000;

export default async function handler(req, res) {
  res.setHeader("cache-control", "no-store");
  try { if (!hasSession(req)) return res.status(401).json({ error: "Sign in first." }); }
  catch (err) { console.error(err); return res.status(500).json({ error: "Session check failed: " + err.message }); }
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
    return res.status(502).json({ error: "Could not reach storage: " + (err && err.message ? err.message : String(err)) });
  }
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