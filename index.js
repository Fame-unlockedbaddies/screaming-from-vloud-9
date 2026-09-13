require('dotenv').config();
const { Client, GatewayIntentBits, Events, REST, Routes } = require('discord.js');
const express = require('express');

// --- Keep-alive web server for Render Web Service ---
// Render expects a port to be bound within ~60s on 0.0.0.0, otherwise it will timeout.
const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
  res.send(`Bot is running! Status: ${botStatus}${loginError ? ' - Error: ' + loginError : ''}`);
});

app.get('/status', (req, res) => {
  res.json({
    web: 'up',
    bot: botStatus,
    error: loginError,
    hasToken: !!((process.env.DISCORD_TOKEN || '').trim()),
    hasClientId: !!process.env.CLIENT_ID,
    uptime: process.uptime()
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Web server listening on 0.0.0.0:${PORT}`);
});

// --- Discord Client ---
let botStatus = 'starting';
let loginError = null;
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once(Events.ClientReady, async (c) => {
  botStatus = `online as ${c.user.tag}`;
  console.log(`Logged in as ${c.user.tag}`);

  // Register slash commands using CLIENT_ID
  const clientId = (process.env.CLIENT_ID || '').trim();
  if (clientId) {
    const commands = [
      {
        name: 'ping',
        description: 'Replies with Pong!'
      }
    ];

    const rest = global._rest || new REST({ version: '10' }).setToken((process.env.DISCORD_TOKEN || '').trim().replace(/^Bot\s+/i, ''));
    try {
      console.log('Registering slash commands...');
      await rest.put(Routes.applicationCommands(clientId), { body: commands });
      console.log('Slash commands registered.');
    } catch (err) {
      console.error('Failed to register slash commands:', err);
    }
  } else {
    console.log('CLIENT_ID not set, skipping slash command registration.');
  }
});

// Slash command handler
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName === 'ping') {
    await interaction.reply('Pong!');
  }
});

// Simple prefix command: !ping (kept as backup)
client.on(Events.MessageCreate, (message) => {
  if (message.author.bot) return;
  if (message.content === '!ping') {
    message.reply('Pong!');
  }
});

const token = (process.env.DISCORD_TOKEN || '').trim().replace(/^Bot\s+/i, '');
console.log(`ENV check - DISCORD_TOKEN: ${token ? 'set (' + token.length + ' chars)' : 'MISSING'}, CLIENT_ID: ${(process.env.CLIENT_ID || '').trim() || 'MISSING'}, PORT: ${PORT}`);
if (!token) {
  botStatus = 'missing token';
  console.error('Missing DISCORD_TOKEN in environment variables. Web server will stay up, but bot will not login.');
} else {
  const rest = new REST({ version: '10' }).setToken(token);
  // store for ready handler to reuse
  global._rest = rest;
  botStatus = 'logging in...';
  client.login(token).then(() => {
    console.log('Login call succeeded, waiting for ready event...');
  }).catch((err) => {
    botStatus = 'login failed';
    loginError = err.message;
    console.error('LOGIN FAILED:', err.message);
    console.error('Fix: Reset token in Discord Dev Portal > Bot > Reset Token, update DISCORD_TOKEN on Render, redeploy.');
  });
}

client.on(Events.Error, console.error);
client.on(Events.ShardError, console.error);
process.on('unhandledRejection', (e) => console.error('UnhandledRejection:', e));
process.on('uncaughtException', (e) => console.error('UncaughtException:', e));
