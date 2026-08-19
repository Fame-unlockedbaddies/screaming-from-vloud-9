/**
 * index.js – Tiny Node/Express server that:
 *  1. Receives a POST from Roblox (the RAP payload)
 *  2. Forwards the same payload to a Discord channel (bot or webhook)
 *  3. Responds to Roblox so it knows the request succeeded
 *
 * Set environment variables before running:
 *   DISCORD_BOT_TOKEN  – your bot's token (optional)
 *   DISCORD_CHANNEL_ID – the numeric channel ID to post in (required if using bot)
 *   DISCORD_WEBHOOK_URL – full webhook URL (optional, if you don't want a bot)
 *
 * If both bot token and webhook are supplied, the bot method takes precedence.
 */

require('dotenv').config(); // optional – if you use a .env file
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
app.use(bodyParser.json()); // parse JSON bodies from Roblox

const PORT = process.env.PORT || 3000;

// -------------------------------------------------------------------
// Route: Roblox posts here →  POST /rap-handler
// -------------------------------------------------------------------
app.post('/rap-handler', async (req, res) => {
  const { weapon, rap, timestamp } = req.body; // payload from Roblox

  // ---- Build the Discord message text ----
  const discordMsg = `🪙 **${weapon}** RAP: **${rap}** (at <t:${timestamp}:R>)`;

  // ---- Try to send via Discord BOT (if token provided) ----
  if (process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_CHANNEL_ID) {
    try {
      await axios.post(
        `https://discord.com/api/v10/channels/${process.env.DISCORD_CHANNEL_ID}/messages`,
        { content: discordMsg },
        {
          headers: {
            Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
            'Content-Type': 'application/json',
          },
        }
      );
      console.log('✅ Sent RAP to Discord (bot).');
    } catch (err) {
      console.error('❌ Discord bot error:', err.response?.data || err.message);
    }
  }
  // ---- Fallback to WEBHOOK (if no bot token but webhook URL provided) ----
  else if (process.env.DISCORD_WEBHOOK_URL) {
    try {
      await axios.post(process.env.DISCORD_WEBHOOK_URL, { content: discordMsg });
      console.log('✅ Sent RAP to Discord (webhook).');
    } catch (err) {
      console.error('❌ Discord webhook error:', err.message);
    }
  }
  else {
    console.warn('⚠️ No Discord credentials configured – payload not sent.');
  }

  // ---- Respond to Roblox so the script knows it succeeded ----
  res.json({ ok: true, receivedAt: new Date().toISOString() });
});

// -------------------------------------------------------------------
// Start the server
// -------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
  console.log(
    'Set either DISCORD_BOT_TOKEN + DISCORD_CHANNEL_ID or DISCORD_WEBHOOK_URL in your environment.'
  );
});
