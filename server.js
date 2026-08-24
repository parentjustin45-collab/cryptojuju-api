const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const BITUNIX_HOST = "fapi.bitunix.com";

app.get("/", (req, res) => {
  res.json({
    name: "CryptoJuju API",
    status: "online",
    version: "1.1.0",
    bitunixProxy: "online"
  });
});

// V1.1.0 — Bitunix REST proxy for CryptoJuju Charts.
// Security: only HTTPS requests to fapi.bitunix.com are accepted.
app.get("/api/bitunix/proxy", async (req, res) => {
  try {
    const raw = String(req.query.url || "");
    if (!raw) return res.status(400).json({ error: "Missing url" });

    let target;
    try {
      target = new URL(raw);
    } catch {
      return res.status(400).json({ error: "Invalid url" });
    }

    if (target.protocol !== "https:" || target.hostname !== BITUNIX_HOST) {
      return res.status(403).json({ error: "Bitunix host only" });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);

    const upstream = await fetch(target.toString(), {
      method: "GET",
      headers: {
        "accept": "application/json",
        "user-agent": "CryptoJuju-API/1.1"
      },
      signal: controller.signal
    });
    clearTimeout(timer);

    const body = await upstream.text();
    res.status(upstream.status);
    res.set("content-type", upstream.headers.get("content-type") || "application/json");
    res.set("cache-control", "public, max-age=2");
    res.send(body);
  } catch (err) {
    const timeout = err && err.name === "AbortError";
    res.status(timeout ? 504 : 502).json({
      error: timeout ? "Bitunix timeout" : "Bitunix upstream error",
      detail: String(err && err.message ? err.message : err)
    });
  }
});

app.listen(PORT, () => {
  console.log(`CryptoJuju API v1.1.0 running on port ${PORT}`);
});
