require('dotenv').config();
const { Client, GatewayIntentBits, Events, REST, Routes, SlashCommandBuilder, PermissionsBitField } = require('discord.js');
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
  res.json({
    web: 'up',
    bot: botStatus,
    error: loginError,
    hasToken: !!((process.env.DISCORD_TOKEN || '').trim()),
    hasClientId: !!process.env.CLIENT_ID,
    uptime: process.uptime()
  });
});

app.listen(PORT, '0.0.0.0', () => console.log(`Web server on 0.0.0.0:${PORT}`));

// --- Discord Client ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Define application (slash) commands in one place
const slashCommands = [
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong!')
    .toJSON(),
  new SlashCommandBuilder()
    .setName('rawr')
    .setDescription('Sends a message as the bot')
    .addStringOption(opt =>
      opt.setName('message')
        .setDescription('What the bot should say')
        .setRequired(true)
        .setMaxLength(2000)
    )
    .toJSON()
];

async function registerCommands(token, clientId) {
  const rest = new REST({ version: '10' }).setToken(token);
  console.log('Registering slash commands...');
  await rest.put(Routes.applicationCommands(clientId), { body: slashCommands });
  console.log(`Registered ${slashCommands.length} slash commands globally.`);
}

client.once(Events.ClientReady, async (c) => {
  botStatus = `online as ${c.user.tag}`;
  console.log(`Logged in as ${c.user.tag}`);

  const clientId = (process.env.CLIENT_ID || '').trim() || c.user.id;
  const token = (process.env.DISCORD_TOKEN || '').trim().replace(/^Bot\s+/i, '');
  try {
    await registerCommands(token, clientId);
  } catch (err) {
    console.error('Failed to register slash commands:', err);
  }
});

// Handle slash commands
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    if (interaction.commandName === 'ping') {
      await interaction.reply('Pong!');
    }

    else if (interaction.commandName === 'rawr') {
      const messageContent = interaction.options.getString('message', true);

      // Block @everyone / @here to prevent spam abuse - requires explicit permission
      if (/@(everyone|here)/i.test(messageContent)) {
        await interaction.reply({ content: '❌ @everyone / @here is not allowed with this command.', ephemeral: true });
        return;
      }

      // Respect channel permissions - don't try to bypass locks with webhooks
      const me = interaction.guild?.members.me;
      if (interaction.channel && me) {
        const perms = interaction.channel.permissionsFor(me);
        if (perms && !perms.has(PermissionsBitField.Flags.SendMessages)) {
          await interaction.reply({ content: '❌ I do not have permission to send messages in this channel.', ephemeral: true });
          return;
        }
      }

      await interaction.reply(messageContent);
    }
  } catch (err) {
    console.error('Interaction error:', err);
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: '❌ Something went wrong.', ephemeral: true });
      } else {
        await interaction.reply({ content: '❌ Something went wrong.', ephemeral: true });
      }
    } catch {}
  }
});

// Prefix commands (!ping, !rawr ...) - backup / non-slash
const PREFIX = '!';
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift()?.toLowerCase();

  if (cmd === 'ping') {
    await message.reply('Pong!');
  }

  if (cmd === 'rawr') {
    const text = args.join(' ');
    if (!text) {
      await message.reply('Usage: `!rawr <message>`');
      return;
    }
    if (/@(everyone|here)/i.test(text)) {
      await message.reply('❌ @everyone / @here is not allowed.');
      return;
    }
    await message.channel.send(text);
  }
});

const token = (process.env.DISCORD_TOKEN || '').trim().replace(/^Bot\s+/i, '');
console.log(`Token: ${token ? '✅ Set' : '❌ MISSING'}`);

if (!token) {
  botStatus = 'missing token';
  console.error('Missing DISCORD_TOKEN in environment variables.');
} else {
  botStatus = 'logging in...';
  client.login(token).catch(err => {
    botStatus = 'login failed';
    loginError = err.message;
    console.error('Login failed:', err);
  });
}

client.on(Events.Error, console.error);
client.on(Events.ShardError, console.error);

process.on('unhandledRejection', e => console.error('Unhandled:', e));
process.on('uncaughtException', e => console.error('Uncaught:', e));
