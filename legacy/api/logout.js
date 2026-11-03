export default function handler(req, res) {
    res.setHeader("cache-control", "no-store");
    if (req.method !== "POST") {
        res.setHeader("allow", "POST");
        return res.status(405).json({ error: "Use POST." });
    }
    res.setHeader("set-cookie", "fr_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict");
    return res.status(200).json({ ok: true });
}