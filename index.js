require('dotenv').config();
const { Client, GatewayIntentBits, Events, REST, Routes } = require('discord.js');
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

client.once(Events.ClientReady, async (c) => {
  console.log(`Logged in as ${c.user.tag}`);

  // Register slash commands using CLIENT_ID
  const clientId = process.env.CLIENT_ID;
  if (clientId) {
    const commands = [
      {
        name: 'ping',
        description: 'Replies with Pong!'
      }
    ];

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
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

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('Missing DISCORD_TOKEN in environment variables. Web server will stay up, but bot will not login.');
} else {
  client.login(token);
}
