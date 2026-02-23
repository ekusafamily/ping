const express = require("express");
const axios = require("axios");
const fs = require("fs");
const bodyParser = require("body-parser");
const TelegramBot = require("node-telegram-bot-api");

const app = express();
const PORT = process.env.PORT || 3000;

// Optional Telegram alerts
const TELEGRAM_TOKEN = ""; // Add your bot token
const TELEGRAM_CHAT_ID = ""; // Add your chat ID
let bot;
if (TELEGRAM_TOKEN) {
  bot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });
}

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// In-memory sites and stats
let sites = [];
let stats = {};

// Default sites (monitored on startup)
const defaultSites = [
  "https://google.com",
  "https://kinthithe2026.onrender.com",
  "https://ultron.brianireri.online"
];

defaultSites.forEach(site => {
  if (!sites.includes(site)) {
    sites.push(site);
    stats[site] = { total: 0, failures: 0, lastStatus: "UNKNOWN", lastResponse: "N/A" };
  }
});

// Function to check a site
async function checkSite(site) {
  const start = Date.now();
  const time = new Date().toLocaleTimeString();
  stats[site].total++;

  try {
    const res = await axios.get(site, { timeout: 5000 });
    const ms = Date.now() - start;

    if (stats[site].lastStatus === "DOWN") {
      if (bot) bot.sendMessage(TELEGRAM_CHAT_ID, `🟢 RECOVERED: ${site}`);
    }

    stats[site].lastStatus = "UP";
    stats[site].lastResponse = `${ms}ms`;
    fs.appendFileSync("logs.txt", `[${time}] ${site} UP\n`);
  } catch (err) {
    stats[site].failures++;
    if (stats[site].lastStatus === "UP" || stats[site].lastStatus === "UNKNOWN") {
      if (bot) bot.sendMessage(TELEGRAM_CHAT_ID, `🚨 DOWN: ${site}`);
    }
    stats[site].lastStatus = "DOWN";
    stats[site].lastResponse = "N/A";
    fs.appendFileSync("logs.txt", `[${time}] ${site} DOWN\n`);
  }
}

// Run all sites check every 10 seconds
setInterval(() => {
  sites.forEach(site => checkSite(site));
}, 10000);

// Immediately check all sites on startup
sites.forEach(site => checkSite(site));

// Routes

// Dashboard
app.get("/", (req, res) => {
  let html = `
    <h1>Uptime Monitor Dashboard</h1>
    <form method="POST" action="/add-site">
      <input name="site" placeholder="https://example.com" required/>
      <button type="submit">Add Site</button>
    </form>
    <hr/>
  `;
  for (let site of sites) {
    const s = stats[site];
    const uptime = ((s.total - s.failures) / s.total * 100 || 0).toFixed(2);
    html += `
      <h3>${site}</h3>
      <p>Status: ${s.lastStatus || "UNKNOWN"}</p>
      <p>Last Response Time: ${s.lastResponse || "N/A"}</p>
      <p>Total Checks: ${s.total || 0}</p>
      <p>Failures: ${s.failures || 0}</p>
      <p>Uptime: ${uptime}%</p>
      <hr/>
    `;
  }
  res.send(html);
});

// Add a new site
app.post("/add-site", (req, res) => {
  const site = req.body.site.trim();
  if (site && !sites.includes(site)) {
    const url = site.startsWith("http") ? site : "https://" + site;
    sites.push(url);
    stats[url] = { total: 0, failures: 0, lastStatus: "UNKNOWN", lastResponse: "N/A" };

    // Immediately check the new site
    checkSite(url);
  }
  res.redirect("/");
});

// Optional: self-ping to keep free-tier hosts awake
setInterval(() => {
  const selfUrl = process.env.SELF_URL || `http://localhost:${PORT}`;
  axios.get(selfUrl)
    .then(() => console.log(`✅ Self-ping successful at ${new Date().toLocaleTimeString()}`))
    .catch(() => console.log(`❌ Self-ping failed at ${new Date().toLocaleTimeString()}`));
}, 5 * 60 * 1000); // every 5 minutes

// Start server
app.listen(PORT, () => {
  console.log(`🌐 Dashboard running on port ${PORT}`);
});
