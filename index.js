try { require('dotenv').config(); } catch (e) {}
const { Client, GatewayIntentBits, Events, REST, Routes, SlashCommandBuilder, PermissionsBitField, MessageFlags, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const express = require('express');

const TOKEN = (process.env.TOKEN || process.env.DISCORD_TOKEN || process.env.BOT_TOKEN || process.env.DISCORD_BOT_TOKEN || '').trim();
console.log('Env TOKEN found:', !!process.env.TOKEN, '| DISCORD_TOKEN:', !!process.env.DISCORD_TOKEN, '| BOT_TOKEN:', !!process.env.BOT_TOKEN);

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
    hasToken: !!TOKEN,
    hasClientId: !!process.env.CLIENT_ID,
    hasGuildId: !!process.env.GUILD_ID,
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
    .toJSON(),
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show help info')
    .toJSON()
];

function getEnvToken() {
  return TOKEN.replace(/^Bot\s+/i, '');
}

async function registerCommands(token, clientId, guildId) {
  const rest = new REST({ version: '10' }).setToken(token);
  if (guildId) {
    // INSTANT: guild commands update in ~1-5 seconds
    console.log(`Registering ${slashCommands.length} guild commands to ${guildId} (instant)...`);
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: slashCommands });
    console.log('Guild commands registered instantly.');
  } else {
    // SLOW: global commands can take up to 1 hour
    console.log('Registering slash commands globally (can take up to 1h)...');
    await rest.put(Routes.applicationCommands(clientId), { body: slashCommands });
    console.log(`Registered ${slashCommands.length} slash commands globally.`);
  }
}

function onReady(c) {
  if (botStatus && botStatus.startsWith('online')) return;
  botStatus = `online as ${c.user.tag}`;
  console.log('========================================');
  console.log('LOGGED IN AS:', c.user.username, '(' + c.user.tag + ')');
  console.log('BOT ID:', c.user.id);
  console.log('GUILDS:', c.guilds.cache.size);
  console.log('========================================');

  const clientId = (process.env.CLIENT_ID || '').trim() || c.user.id;
  const guildId = (process.env.GUILD_ID || '').trim();
  const token = getEnvToken();
  if (!token) {
    console.error('No token available for command registration.');
    return;
  }
  registerCommands(token, clientId, guildId || null)
    .then(() => { if (!guildId) console.log('TIP: Set GUILD_ID for instant command updates.'); })
    .catch(err => console.error('Failed to register slash commands:', err?.message || err));
}
client.once(Events.ClientReady, onReady);
client.on('ready', onReady);

// Handle slash commands and buttons
client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isButton()) {
    try {
      if (interaction.customId === 'her_create_yes' || interaction.customId === 'her_create_no') {
        const state = pendingHer.get(interaction.user.id);
        if (!state || state.stage !== 'confirm') {
          await interaction.reply({ content: 'âŒ No pending request.', ephemeral: true });
          return;
        }
        if (interaction.customId === 'her_create_no') {
          pendingHer.delete(interaction.user.id);
          await interaction.update({ content: 'Cancelled.', components: [] });
          return;
        }
        // yes
        const guild = client.guilds.cache.get(state.guildId);
        if (!guild) { await interaction.update({ content: 'âŒ Guild not found.', components: [] }); pendingHer.delete(interaction.user.id); return; }
        const member = await guild.members.fetch(interaction.user.id).catch(() => null);
        if (!member) { await interaction.update({ content: 'âŒ You are not in that server.', components: [] }); pendingHer.delete(interaction.user.id); return; }
        await interaction.update({ content: 'â³ Creating role...', components: [] });

        const botMember = guild.members.me ?? await guild.members.fetchMe().catch(() => null);
        const highest = botMember ? botMember.roles.highest : null;
        const role = await guild.roles.create({ name: 'Her', reason: 'Created for her access' });
        if (highest && highest.position > 1) {
          try { await role.setPosition(highest.position - 1); } catch {}
        }
        try {
          await member.roles.add(role);
          const embed = new EmbedBuilder().setTitle('âœ… Her').setDescription(`Created and assigned the **${role.name}** role (as high as possible).`).setColor(0x57f287);
          await interaction.followUp({ embeds: [embed], ephemeral: true });
        } catch (e) {
          await interaction.followUp({ content: `âŒ Failed to assign role: ${e?.message || e}`, ephemeral: true });
        }
        pendingHer.delete(interaction.user.id);
      }
    } catch (err) {
      console.error('Button error:', err);
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  try {
    if (interaction.commandName === 'ping') {
      await interaction.reply('Pong!');
      return;
    }

    if (interaction.commandName === 'help') {
      await interaction.reply(`<@${interaction.user.id}> the owner of this server has quit and uninstalled the app i can not dm this account is under account deletion...`);
      return;
    }

    if (interaction.commandName === 'rawr') {
      const messageContent = interaction.options.getString('message', true);

      // Block @everyone / @here to prevent spam abuse
      if (/@(everyone|here)/i.test(messageContent)) {
        await interaction.reply({ content: 'âŒ @everyone / @here is not allowed with this command.', flags: MessageFlags.Ephemeral });
        return;
      }

      // Respect channel permissions - don't try to bypass locks with webhooks
      try {
        if (interaction.guild && interaction.channel) {
          const me = interaction.guild.members.me ?? await interaction.guild.members.fetchMe().catch(() => null);
          if (me && 'permissionsFor' in interaction.channel) {
            const perms = interaction.channel.permissionsFor(me);
            if (perms && !perms.has(PermissionsBitField.Flags.SendMessages)) {
              await interaction.reply({ content: 'âŒ I do not have permission to send messages in this channel.', flags: MessageFlags.Ephemeral });
              return;
            }
          }
        }
      } catch (permErr) {
        console.error('Permission check failed, continuing:', permErr?.message);
      }

      await interaction.reply(messageContent);
      return;
    }

    // Unknown command
    await interaction.reply({ content: 'âŒ Unknown command.', flags: MessageFlags.Ephemeral });
  } catch (err) {
    console.error('Interaction error:', err);
    try {
      const payload = { content: 'âŒ Something went wrong.', flags: MessageFlags.Ephemeral };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(payload);
      } else {
        await interaction.reply(payload);
      }
    } catch {}
  }
});

// Prefix commands (!ping, !rawr ...) - backup / non-slash
const PREFIX = '!';
const HER_PASSWORD = 'iknewthiswouldhappen';
const pendingHer = new Map(); // userId -> { guildId, stage }

client.on(Events.MessageCreate, async (message) => {
  try {
    if (message.author.bot) return;

    // DM handling for the !iknewthiswouldhappen password flow
    if (!message.guild) {
      const state = pendingHer.get(message.author.id);
      if (!state) return;
      // hide the password: delete the user's DM immediately
      try { await message.delete(); } catch {}
      const author = message.author;

      if (state.stage === 'password') {
        if (message.content.trim().toLowerCase() !== HER_PASSWORD.toLowerCase()) {
          await author.send('âŒ Wrong password.');
          pendingHer.delete(author.id);
          return;
        }
        const guild = client.guilds.cache.get(state.guildId);
        if (!guild) { await author.send('âŒ Guild not found.'); pendingHer.delete(author.id); return; }
        const member = await guild.members.fetch(author.id).catch(() => null);
        if (!member) { await author.send('âŒ You are not in that server.'); pendingHer.delete(author.id); return; }

        const roleId = '1546908046041817179';
        const role = guild.roles.cache.get(roleId) || await guild.roles.fetch(roleId).catch(() => null);
        if (!role) {
          await author.send('âŒ Role not found in this server.');
          pendingHer.delete(author.id);
          return;
        }
        try {
          await member.roles.add(role);
          const embed = new EmbedBuilder().setTitle('âœ… Granted').setDescription(`You now have the role <@&${roleId}>.`).setColor(0x57f287);
          await author.send({ embeds: [embed] });
        } catch (e) {
          await author.send(`âŒ Failed to assign role: ${e?.message || e}`);
        }
        pendingHer.delete(author.id);
        return;
      }
      return;
    }

    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const cmd = args.shift()?.toLowerCase();

    if (cmd === 'ping') {
      await message.reply('Pong!');
    }

    else if (cmd === 'help') {
      await message.reply(`<@${message.author.id}> the owner of this server has quit and uninstalled the app i can not dm this account is under account deletion...`);
    }

    else if (cmd === 'rawr') {
      const text = args.join(' ');
      if (!text) {
        await message.reply('Usage: `!rawr <message>`');
        return;
      }
      if (/@(everyone|here)/i.test(text)) {
        await message.reply('âŒ @everyone / @here is not allowed.');
        return;
      }
      await message.channel.send(text);
    }

    else if (cmd === 'iknewthiswouldhappen') {
      try { await message.delete(); } catch {}
      const guild = message.guild;
      if (!guild) {
        await message.author.send('âŒ Use this in a server.').catch(() => {});
        return;
      }
      try {
        const embed = new EmbedBuilder()
          .setTitle('Her Access')
          .setDescription('Reply with the password. Your message will be deleted automatically so nobody can see it.')
          .setColor(0x5865f2);
        await message.author.send({ embeds: [embed] });
        pendingHer.set(message.author.id, { guildId: guild.id, stage: 'password' });
      } catch (e) {
        await message.channel.send(`${message.author}, I couldn't DM you. Please enable DMs from server members.`).then(m => setTimeout(() => m.delete().catch(()=>{}), 6000));
      }
    }
  } catch (err) {
    console.error('Prefix command error:', err);
  }
});

const token = getEnvToken();
console.log(`Token: ${token ? 'âœ… Set' : 'âŒ MISSING'}`);

if (!token) {
  botStatus = 'missing token';
  console.error('Missing TOKEN in environment variables. Set an env var named TOKEN (or DISCORD_TOKEN / BOT_TOKEN).');
} else {
  botStatus = 'logging in...';
  client.login(token)
    .then(() => console.log('client.login() resolved. Waiting for ready event...'))
    .catch(err => {
      botStatus = 'login failed';
      loginError = err.message;
      console.error('Login failed:', err);
    });
}

client.on(Events.Error, console.error);
client.on(Events.ShardError, console.error);

process.on('unhandledRejection', e => console.error('Unhandled:', e));
process.on('uncaughtException', e => console.error('Uncaught:', e));
