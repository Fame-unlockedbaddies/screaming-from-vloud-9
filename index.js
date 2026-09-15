require('dotenv').config();

const { Client, GatewayIntentBits, Events, REST, Routes, PermissionsBitField, ChannelType } = require('discord.js');
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
    hasToken: !!process.env.DISCORD_TOKEN,
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
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers
  ]
});

// Register slash commands
client.once(Events.ClientReady, async (c) => {
  botStatus = `online as ${c.user.tag}`;
  console.log(`Logged in as ${c.user.tag}`);

  const clientId = process.env.CLIENT_ID;
  if (clientId) {
    const commands = [
      { name: 'ping', description: 'Replies with Pong!' },
      { name: 'give-role', description: 'Give a role to a member', options: [
        { name: 'member', type: 6, description: 'Member to give role to', required: true },
        { name: 'role', type: 8, description: 'Role to give', required: true }
      ]},
      { name: 'self-role', description: 'Give yourself a role' }
    ];

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN.replace(/^Bot\s+/i, ''));
    try {
      await rest.put(Routes.applicationCommands(clientId), { body: commands });
      console.log('Slash commands registered!');
    } catch (err) {
      console.error('Failed to register commands:', err);
    }
  }
});

// Slash command handler
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'ping') {
    await interaction.reply('Pong!');
  }

  if (interaction.commandName === 'give-role') {
    const member = interaction.options.getMember('member');
    const role = interaction.options.getRole('role');
    if (!member.roles.cache.has(role.id)) {
      await member.roles.add(role);
      await interaction.reply({ content: `✅ Gave <@&${role.id}> to ${member.user.tag}`, ephemeral: true });
    } else {
      await interaction.reply({ content: '❌ That member already has this role!', ephemeral: true });
    }
  }

  if (interaction.commandName === 'self-role') {
    const role = interaction.options.getRole('role');
    await interaction.member.roles.add(role);
    await interaction.reply({ content: `✅ Added role <@&${role.id}> to you!`, ephemeral: true });
  }
});

// Reaction role system (click on message to give role)
client.on(Events.MessageReactionAdd, async (reaction, user) => {
  if (user.bot) return;
  if (!reaction.message.guild) return;

  const member = await reaction.message.guild.members.fetch(user.id);
  const role = reaction.message.guild.roles.cache.get(reaction.emoji.id);
  if (role) {
    await member.roles.add(role);
  }
});

client.on(Events.MessageReactionRemove, async (reaction, user) => {
  if (user.bot) return;
  if (!reaction.message.guild) return;

  const member = await reaction.message.guild.members.fetch(user.id);
  const role = reaction.message.guild.roles.cache.get(reaction.emoji.id);
  if (role) {
    await member.roles.remove(role);
  }
});

// Ping command
client.on(Events.MessageCreate, (message) => {
  if (message.author.bot) return;
  if (message.content === '!ping') {
    message.reply('Pong!');
  }
});

const token = process.env.DISCORD_TOKEN.replace(/^Bot\s+/i, '');
console.log(`Token check: ${token ? '✅ Set' : '❌ Missing'}`);

if (!token) {
  botStatus = 'missing token';
  console.error('Missing DISCORD_TOKEN!');
} else {
  client.login(token).catch(err => {
    botStatus = 'login failed';
    loginError = err.message;
    console.error('Login failed:', err.message);
  });
}

client.on(Events.Error, console.error);
client.on(Events.ShardError, console.error);

process.on('unhandledRejection', e => console.error('Unhandled:', e));
process.on('uncaughtException', e => console.error('Uncaught:', e));
