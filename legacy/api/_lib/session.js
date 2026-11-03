import { createHmac, timingSafeEqual } from "node:crypto";

export const COOKIE = "fr_session";
export const MAX_AGE = 60 * 60 * 24 * 60; // 60 days

const secret = () => process.env.SESSION_SECRET || process.env.APP_KEY;
const sign = (payload) => createHmac("sha256", secret()).update(payload).digest("base64url");

export function createSession() {
    const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
    const payload = `v1.${exp}`;
    return `${payload}.${sign(payload)}`;
}

export function sessionCookie(value, maxAge = MAX_AGE) {
    return `${COOKIE}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`;
}

export function hasSession(req) {
    if (!secret()) return false;
    const raw = String(req.headers.cookie || "")
        .split(";").map((p) => p.trim()).find((p) => p.startsWith(`${COOKIE}=`));
    const token = raw ? raw.slice(COOKIE.length + 1) : "";
    const [ver, exp, sig] = token.split(".");
    if (ver !== "v1" || !exp || !sig || Number(exp) * 1000 < Date.now()) return false;
    const a = Buffer.from(sig), b = Buffer.from(sign(`${ver}.${exp}`));
    return a.length === b.length && timingSafeEqual(a, b);
}

export function same(given, expected) {
    const a = Buffer.from(String(given || "")), b = Buffer.from(String(expected || ""));
    return b.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

// RFC 6238 time-based one-time code, 30 s steps, 6 digits, accepts ±1 step of clock drift.
export function totpValid(code, base32Secret, now = Date.now()) {
    if (!/^\d{6}$/.test(String(code || ""))) return false;
    const key = base32Decode(base32Secret);
    const step = Math.floor(now / 1000 / 30);
    for (const drift of [-1, 0, 1]) {
        if (same(code, totp(key, step + drift))) return true;
    }
    return false;
}

export function totp(key, counter) {
    const buf = Buffer.alloc(8);
    buf.writeBigUInt64BE(BigInt(counter));
    const h = createHmac("sha1", key).update(buf).digest();
    const o = h[h.length - 1] & 0xf;
    const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
    return String(n % 1_000_000).padStart(6, "0");
}

export function base32Decode(s) {
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