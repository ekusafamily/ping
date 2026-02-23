// index.js
const axios = require("axios");
const express = require("express");
const readline = require("readline");
const fs = require("fs");

// Optional Telegram
const TelegramBot = require("node-telegram-bot-api");
const TELEGRAM_TOKEN = ""; // Add your bot token
const TELEGRAM_CHAT_ID = ""; // Add your chat ID
let bot;
if (TELEGRAM_TOKEN) {
  bot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });
}

// CLI input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question("Enter website URLs (comma separated): ", (input) => {

  const sites = input.split(",").map(s =>
    s.trim().startsWith("http") ? s.trim() : "https://" + s.trim()
  );

  console.log("\nMonitoring started every 10 seconds...\n");

  // Stats object
  const stats = {};
  sites.forEach(site => {
    stats[site] = {
      total: 0,
      failures: 0,
      lastStatus: "UNKNOWN"
    };
  });

  // Function to check a single site
  async function checkSite(site) {
    const start = Date.now();
    const time = new Date().toLocaleTimeString();

    stats[site].total++;

    try {
      const res = await axios.get(site, { timeout: 5000 });
      const ms = Date.now() - start;

      if (stats[site].lastStatus === "DOWN") {
        console.log(`🟢 RECOVERED: ${site}`);
        if (bot) bot.sendMessage(TELEGRAM_CHAT_ID, `🟢 RECOVERED: ${site}`);
      }

      stats[site].lastStatus = "UP";
      console.log(`[${time}] ${site} ✅ UP (${res.status}) - ${ms}ms`);
      fs.appendFileSync("logs.txt", `[${time}] ${site} UP\n`);

    } catch (err) {
      stats[site].failures++;

      if (stats[site].lastStatus === "UP" || stats[site].lastStatus === "UNKNOWN") {
        console.log(`🚨 DOWN: ${site}`);
        if (bot) bot.sendMessage(TELEGRAM_CHAT_ID, `🚨 DOWN: ${site}`);
      }

      stats[site].lastStatus = "DOWN";
      console.log(`[${time}] ${site} ❌ DOWN`);
      fs.appendFileSync("logs.txt", `[${time}] ${site} DOWN\n`);
    }

    // Show uptime %
    const uptime = ((stats[site].total - stats[site].failures) / stats[site].total * 100).toFixed(2);
    console.log(`Uptime: ${uptime}%\n`);
  }

  // Run every 10 seconds
  setInterval(() => {
    sites.forEach(site => checkSite(site));
  }, 10000);

  // First run immediately
  sites.forEach(site => checkSite(site));

  // Web dashboard
  const app = express();
  app.get("/", (req, res) => {
    let html = "<h1>Uptime Monitor Dashboard</h1>";
    for (let site in stats) {
      const uptime = ((stats[site].total - stats[site].failures) / stats[site].total * 100 || 0).toFixed(2);
      html += `
        <h3>${site}</h3>
        <p>Status: ${stats[site].lastStatus}</p>
        <p>Total Checks: ${stats[site].total}</p>
        <p>Failures: ${stats[site].failures}</p>
        <p>Uptime: ${uptime}%</p>
        <hr>
      `;
    }
    res.send(html);
  });

  app.listen(3000, () => {
    console.log("🌐 Dashboard running at http://localhost:3000");
  });

});
