// Runs before every request. Nothing is served until you're signed in,
// except the login page and the files a phone needs to show the app icon.
const PUBLIC = [/^\/login\.html$/, /^\/api\/login$/, /^\/manifest\.webmanifest$/, /^\/icons\//, /^\/favicon\.ico$/];

export const config = { matcher: ["/", "/:path*"] };

export default async function middleware(request) {
    const url = new URL(request.url);
    if (PUBLIC.some((re) => re.test(url.pathname))) return next();

    const secret = process.env.SESSION_SECRET || process.env.APP_KEY;
    if (secret && (await validSession(readCookie(request, "fr_session"), secret))) return next();

    if (url.pathname.startsWith("/api/")) {
        return new Response(JSON.stringify({ error: "Sign in first." }), {
            status: 401,
            headers: { "content-type": "application/json", "cache-control": "no-store" },
        });
    }
    return Response.redirect(new URL("/login.html", url), 302);
}

function next() {
    return new Response(null, { headers: { "x-middleware-next": "1" } });
}

function readCookie(request, name) {
    const header = request.headers.get("cookie") || "";
    for (const part of header.split(";")) {
        const [k, ...v] = part.trim().split("=");
        if (k === name) return v.join("=");
    }
    return "";
}

async function validSession(token, secret) {
    const [ver, exp, sig] = (token || "").split(".");
    if (ver !== "v1" || !exp || !sig || Number(exp) * 1000 < Date.now()) return false;
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${ver}.${exp}`)));
    const expected = btoa(String.fromCharCode(...mac)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    if (expected.length !== sig.length) return false;
    let diff = 0;
    for (let i = 0; i < sig.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
    return diff === 0;
}