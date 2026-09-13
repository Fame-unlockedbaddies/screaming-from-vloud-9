require('dotenv').config();
const { Client, GatewayIntentBits, Events } = require('discord.js');
const express = require('express');

// --- Keep-alive web server for Render Web Service ---
// Render expects a port to be bound within ~60s on 0.0.0.0, otherwise it will timeout.
const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
  res.send('Bot is running!');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Web server listening on 0.0.0.0:${PORT}`);
});

// --- Discord Client ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once(Events.ClientReady, (c) => {
  console.log(`Logged in as ${c.user.tag}`);
});

// Simple prefix command: !ping
client.on(Events.MessageCreate, (message) => {
  if (message.author.bot) return;
  if (message.content === '!ping') {
    message.reply('Pong!');
  }
});

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('Missing DISCORD_TOKEN in environment variables. Web server will stay up, but bot will not login.');
} else {
  client.login(token);
}
