const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ============================================================
// CryptoJuju API
// ============================================================

app.get("/", (req, res) => {
  res.json({
    name: "CryptoJuju API",
    status: "online",
    version: "1.0.0"
  });
});

// Test simple
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    message: "CryptoJuju API fonctionne 🚀",
    timestamp: new Date().toISOString()
  });
});

// ============================================================
// Bitunix proxy - Klines / chandelles
// ============================================================

app.get("/api/bitunix/klines", async (req, res) => {
  try {
    const {
      symbol = "BTCUSDT",
      interval = "1h",
      limit = "500",
      startTime,
      endTime
    } = req.query;

    const params = new URLSearchParams({
      symbol,
      interval,
      limit
    });

    if (startTime) params.append("startTime", startTime);
    if (endTime) params.append("endTime", endTime);

    const url =
      `https://fapi.bitunix.com/api/v1/futures/market/kline?${params.toString()}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `Bitunix HTTP ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();

    res.json({
      ok: true,
      source: "Bitunix",
      symbol,
      interval,
      data
    });

  } catch (error) {

    console.error("Bitunix error:", error);

    res.status(500).json({
      ok: false,
      source: "Bitunix",
      error: error.message
    });
  }
});

// ============================================================
// Start server
// ============================================================

app.listen(PORT, () => {
  console.log(`CryptoJuju API running on port ${PORT}`);
});
