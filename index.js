require('dotenv').config();

const { Client, GatewayIntentBits, Events, REST, Routes, PermissionsBitField, ChannelType, WebhookClient } = require('discord.js');
const express = require('express');

// --- Keep-alive for Render ---
const app = express();
const PORT = process.env.PORT || 10000;

let botStatus = 'starting';
let loginError = null;

app.get('/', (req, res) => {
  res.send(`Bot is running! Status: ${botStatus}${loginError ? ' - Error: ' + loginError : ''}`);
});
app.get('/status', (req, res) => {
  res.json({ web: 'up', bot: botStatus, error: loginError, uptime: process.uptime() });
});

app.listen(PORT, '0.0.0.0', () => console.log(`Web server on 0.0.0.0:${PORT}`));

// --- Discord Client ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions
  ]
});

// Slash command: /rawr
client.once(Events.ClientReady, async (c) => {
  botStatus = `online as ${c.user.tag}`;
  console.log(`Logged in as ${c.user.tag}`);

  const clientId = process.env.CLIENT_ID;
  if (clientId) {
    const commands = [
      {
        name: 'rawr',
        description: 'Sends a message in chat (even if locked)',
        options: [
          { name: 'message', type: 3, description: 'What the bot should say', required: true }
        ]
      }
    ];

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN.replace(/^Bot\s+/i, ''));
    try {
      await rest.put(Routes.applicationCommands(clientId), { body: commands });
      console.log('Slash command /rawr registered!');
    } catch (err) {
      console.error('Failed to register /rawr:', err);
    }
  }
});

// Handle /rawr command
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== 'rawr') return;

  const messageContent = interaction.options.getString('message');
  const webhookClient = new WebhookClient({ url: 'https://discord.com/api/webhooks/YOUR_WEBHOOK_HERE' }); // <--- CHANGE THIS LATER

  try {
    await webhookClient.send({
      content: `@everyone ${messageContent}`,
      username: interaction.user.username,
      avatarURL: interaction.user.displayAvatarURL({ dynamic: true })
    });
    await interaction.reply({ content: `✅ Sent: ${messageContent}`, ephemeral: true });
  } catch (err) {
    await interaction.reply({ content: '❌ Could not send message. Check the webhook in the next message.', ephemeral: true });
  }
});

const token = process.env.DISCORD_TOKEN.replace(/^Bot\s+/i, '');
console.log(`Token: ✅ Set`);

client.login(token).catch(err => {
  botStatus = 'login failed';
  loginError = err.message;
  console.error('Login failed:', err);
});

client.on(Events.Error, console.error);
client.on(Events.ShardError, console.error);

process.on('unhandledRejection', e => console.error('Unhandled:', e));
process.on('uncaughtException', e => console.error('Uncaught:', e));
