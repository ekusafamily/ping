// server.js
const express = require("express");
const axios = require("axios");
const fs = require("fs");
const bodyParser = require("body-parser");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// In-memory storage
let sites = [];
let stats = {};

// Check a single site
async function checkSite(site) {
  const start = Date.now();
  const time = new Date().toLocaleTimeString();
  stats[site].total++;

  try {
    const res = await axios.get(site, { timeout: 8000 });
    const ms = Date.now() - start;

    stats[site].lastStatus = "UP";
    stats[site].lastResponse = `${ms}ms`;

    fs.appendFileSync("logs.txt", `[${time}] ${site} UP (${ms}ms)\n`);
  } catch (err) {
    stats[site].failures++;
    stats[site].lastStatus = "DOWN";
    stats[site].lastResponse = "N/A";

    fs.appendFileSync("logs.txt", `[${time}] ${site} DOWN\n`);
  }
}

// Run checks every 10 seconds
setInterval(() => {
  sites.forEach(site => checkSite(site));
}, 10000);

// Dashboard
app.get("/", (req, res) => {
  let cards = "";

  for (let site of sites) {
    const s = stats[site];
    const uptime = s.total
      ? (((s.total - s.failures) / s.total) * 100).toFixed(2)
      : "0.00";

    const statusClass =
      s.lastStatus === "UP"
        ? "up"
        : s.lastStatus === "DOWN"
        ? "down"
        : "unknown";

    cards += `
      <div class="card">
        <div class="url">${site}</div>
        <div class="status ${statusClass}">${s.lastStatus}</div>
        <div class="meta">Last Response: ${s.lastResponse}</div>
        <div class="meta">Checks: ${s.total}</div>
        <div class="meta">Failures: ${s.failures}</div>
        <div class="meta">Uptime: ${uptime}%</div>
      </div>
    `;
  }

  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <title>Uptime Monitor</title>
    <meta http-equiv="refresh" content="10" />
    <style>
      body {
        font-family: Arial, sans-serif;
        background: #0f172a;
        color: #e5e7eb;
        margin: 0;
        padding: 20px;
      }
      h1 { text-align: center; margin-bottom: 20px; }

      form {
        display: flex;
        justify-content: center;
        gap: 10px;
        margin-bottom: 25px;
      }

      input {
        padding: 10px;
        border-radius: 8px;
        border: none;
        width: 260px;
      }

      button {
        background: #22c55e;
        color: white;
        border: none;
        padding: 10px 15px;
        border-radius: 8px;
        cursor: pointer;
        font-weight: bold;
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 15px;
      }

      .card {
        background: #1e293b;
        border-radius: 12px;
        padding: 15px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.4);
      }

      .url { font-weight: bold; margin-bottom: 8px; word-break: break-all; }
      .status { font-weight: bold; margin-bottom: 6px; }

      .up { color: #22c55e; }
      .down { color: #ef4444; }
      .unknown { color: #facc15; }

      .meta { font-size: 14px; opacity: 0.9; }
      footer { text-align: center; margin-top: 25px; font-size: 12px; opacity: 0.6; }
    </style>
  </head>
  <body>
    <h1>🚀 Uptime Monitor</h1>

    <form method="POST" action="/add-site">
      <input name="site" placeholder="https://example.com" required />
      <button type="submit">Add Site</button>
    </form>

    <div class="grid">
      ${cards || "<p style='text-align:center'>No sites added yet.</p>"}
    </div>

    <footer>Auto-refresh every 10 seconds</footer>
  </body>
  </html>
  `;

  res.send(html);
});

// Add site
app.post("/add-site", (req, res) => {
  const raw = req.body.site.trim();
  const url = raw.startsWith("http") ? raw : `https://${raw}`;

  if (!sites.includes(url)) {
    sites.push(url);
    stats[url] = {
      total: 0,
      failures: 0,
      lastStatus: "UNKNOWN",
      lastResponse: "N/A",
    };

    // Immediate first check
    checkSite(url);
  }

  res.redirect("/");
});

// Health route (important for Render)
app.get("/health", (req, res) => res.send("OK"));

app.listen(PORT, () => {
  console.log(`🌐 Running on port ${PORT}`);
});
