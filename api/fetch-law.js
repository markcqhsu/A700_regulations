// Server-side CORS proxy for law-source lookups. Runs on Vercel (not in the
// browser), so it isn't subject to the CORS restriction it exists to work
// around. Restricted to gov.tw hosts since this endpoint is publicly
// reachable and would otherwise be an open proxy for arbitrary URLs.
const ALLOWED_HOST_RE = /(^|\.)gov\.tw$/i;

async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const url = req.query.url;
  if (!url || typeof url !== "string") {
    res.status(400).json({ error: "Missing url parameter" });
    return;
  }

  let target;
  try {
    target = new URL(url);
  } catch (e) {
    res.status(400).json({ error: "Invalid url" });
    return;
  }

  if (target.protocol !== "https:" && target.protocol !== "http:") {
    res.status(400).json({ error: "Unsupported protocol" });
    return;
  }
  if (!ALLOWED_HOST_RE.test(target.hostname)) {
    res.status(403).json({ error: "Host not allowed" });
    return;
  }

  try {
    const upstream = await fetch(target.toString(), {
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    const text = await upstream.text();
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(upstream.status).send(text);
  } catch (err) {
    res.status(502).json({
      error: "Upstream fetch failed",
      message: err.message,
      cause: err.cause ? String(err.cause) : undefined
    });
  }
}

module.exports = handler;
module.exports.config = { regions: ["hnd1"] };
