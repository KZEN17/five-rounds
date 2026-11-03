import { sessionCookie } from "./_lib/session.js";

export default function handler(req, res) {
    res.setHeader("cache-control", "no-store");
    if (req.method !== "POST") {
        res.setHeader("allow", "POST");
        return res.status(405).json({ error: "Use POST." });
    }
    res.setHeader("set-cookie", sessionCookie("", 0));
    return res.status(200).json({ ok: true });
}