console.log('>>> BOOT <<<');

require('dotenv').config();

const { Client, GatewayIntentBits, Events, REST, Routes, SlashCommandBuilder, ActivityType } = require('discord.js');
const express = require('express');

// Render environment variables
const TOKEN = (process.env.token || process.env.TOKEN || '').trim();
const CLIENT_ID = (process.env.client_id || process.env.CLIENT_ID || '').trim();

console.log('TOKEN present:', !!TOKEN, '| CLIENT_ID present:', !!CLIENT_ID);

// ---- Web server (Render needs a listening port) ----
const app = express();
app.get('/', (req, res) => res.send('Bot online!'));
app.get('/health', (req, res) => res.send('ok'));
const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, '0.0.0.0', () => console.log('WEB ON ' + PORT));

// ---- Discord client ----
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

// ---- Slash commands ----
const commands = [
  new SlashCommandBuilder().setName('ping').setDescription('Replies with Pong!'),
  new SlashCommandBuilder().setName('help').setDescription('Shows available commands'),
].map((c) => c.toJSON());

client.once(Events.ClientReady, async (c) => {
  console.log('========================================');
  console.log('LOGGED IN AS:', c.user.username, '(' + c.user.tag + ')');
  console.log('BOT ID:', c.user.id);
  console.log('GUILDS:', c.guilds.cache.size);
  console.log('========================================');

  c.user.setActivity('online', { type: ActivityType.Playing });

  const appId = CLIENT_ID || c.user.id;
  try {
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    await rest.put(Routes.applicationCommands(appId), { body: commands });
    console.log('Slash commands registered for application', appId);
  } catch (e) {
    console.error('Failed to register slash commands:', e && e.message ? e.message : e);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  try {
    if (interaction.commandName === 'ping') {
      await interaction.reply(`Pong! ${client.ws.ping}ms`);
    } else if (interaction.commandName === 'help') {
      await interaction.reply('Available commands: /ping, /help');
    }
  } catch (e) {
    console.error('Interaction error:', e && e.message ? e.message : e);
  }
});

client.on('error', (e) => console.error('CLIENT ERROR:', e && e.message ? e.message : e));
client.on('warn', (m) => console.warn('CLIENT WARN:', m));
process.on('unhandledRejection', (e) => console.error('UNHANDLED REJECTION:', e && e.message ? e.message : e));
process.on('uncaughtException', (e) => console.error('UNCAUGHT EXCEPTION:', e && e.message ? e.message : e));

if (!TOKEN) {
  console.error('NO TOKEN FOUND - set the "token" env var on Render.');
} else {
  console.log('Logging in now...');
  client.login(TOKEN)
    .then(() => console.log('client.login() resolved. Bot is online.'))
    .catch((e) => console.error('LOGIN FAILED:', e && e.message ? e.message : e, '| code:', e && e.code));
}
