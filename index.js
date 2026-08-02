const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  Events,
  REST,
  Routes,
  PermissionFlagsBits,
  ApplicationCommandOptionType,
  ActivityType
} = require('discord.js');
const express = require('express');
const fs = require('fs');
require('dotenv').config();

// Web server for Render
const app = express();
app.get('/', (req, res) => res.send('Bot is online'));
app.listen(process.env.PORT || 3000, () => {
  console.log(`Listening on port ${process.env.PORT || 3000}`);
});

// Create client with intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildChannels
  ]
});

// Data storage
const dataPath = './data.json';
let data = {
  prefixes: {},
  welcome: {}
};
if (fs.existsSync(dataPath)) {
  data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
}
function saveData() {
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
}
function getPrefix(guildId) {
  return data.prefixes[guildId] || ',';
}

// --- Anti-nuke variables ---
const deletedChannels = new Map(); // Map<guildId, array of deletions>
const deleteThreshold = 3; // number of channels to trigger
const deleteTimeWindow = 60000; // ms
const channelInfoCache = new Map(); // For channel restoration

// --- Event: Channel delete ---
client.on('channelDelete', async (channel) => {
  if (!channel.guild) return;
  const guildId = channel.guild.id;

  // Fetch audit log to identify user who deleted
  let executorId = null;
  try {
    const logs = await channel.guild.fetchAuditLogs({ limit: 1, type: 'CHANNEL_DELETE' });
    const entry = logs.entries.first();
    if (entry) executorId = entry.executor.id;
  } catch (err) {
    console.error('Failed to fetch audit logs:', err);
  }

  // Save info for restoration
  if (channel.type === 0) { // Text
    channelInfoCache.set(channel.id, {
      name: channel.name,
      type: channel.type,
      parentId: channel.parentId,
      position: channel.position,
      topic: channel.topic,
      nsfw: channel.nsfw,
      permissionOverwrites: channel.permissionOverwrites.cache.map(po => ({
        id: po.id,
        allow: po.allow.bitfield,
        deny: po.deny.bitfield
      }))
    });
  } else if (channel.type === 2) { // Voice
    channelInfoCache.set(channel.id, {
      name: channel.name,
      type: channel.type,
      parentId: channel.parentId,
      position: channel.position,
      userLimit: channel.userLimit,
      bitrate: channel.bitrate,
      permissionOverwrites: channel.permissionOverwrites.cache.map(po => ({
        id: po.id,
        allow: po.allow.bitfield,
        deny: po.deny.bitfield
      }))
    });
  } else {
    channelInfoCache.set(channel.id, { id: channel.id });
  }

  // Track deletion for anti-nuke
  if (!deletedChannels.has(guildId)) deletedChannels.set(guildId, []);
  const deletions = deletedChannels.get(guildId);
  deletions.push({ channelId: channel.id, timestamp: Date.now(), executorId });
  // Remove old deletions
  const recentDeletions = deletions.filter(d => Date.now() - d.timestamp < deleteTimeWindow);
  deletedChannels.set(guildId, recentDeletions);

  // Check for mass delete
  if (recentDeletions.length >= deleteThreshold) {
    const uniqueUsers = [...new Set(recentDeletions.map(d => d.executorId))];
    for (const userId of uniqueUsers) {
      try {
        await channel.guild.members.ban(userId, { reason: 'Mass channel deletion detected by anti-nuke' });
        const member = await channel.guild.members.fetch(userId);
        member.send('You have been kicked by Petal for mass deleting channels.').catch(() => {});
      } catch (err) {
        console.error(`Failed to ban or DM user ${userId}:`, err);
      }
    }
    // Clear the record
    deletedChannels.set(guildId, []);
  }
});

// --- Event: Channel create (restore) ---
client.on('channelCreate', async (channel) => {
  if (!channel.guild) return;
  const cachedInfo = channelInfoCache.get(channel.id);
  if (cachedInfo) {
    const guild = channel.guild;
    try {
      if (cachedInfo.type === 0) { // Text
        await guild.channels.create(cachedInfo.name, {
          type: 0,
          parent: cachedInfo.parentId,
          position: cachedInfo.position,
          topic: cachedInfo.topic,
          nsfw: cachedInfo.nsfw,
          permissionOverwrites: cachedInfo.permissionOverwrites
        });
      } else if (cachedInfo.type === 2) { // Voice
        await guild.channels.create(cachedInfo.name, {
          type: 2,
          parent: cachedInfo.parentId,
          position: cachedInfo.position,
          userLimit: cachedInfo.userLimit,
          bitrate: cachedInfo.bitrate,
          permissionOverwrites: cachedInfo.permissionOverwrites
        });
      }
      channelInfoCache.delete(channel.id);
    } catch (err) {
      console.error('Error restoring channel:', err);
    }
  }
});

// --- Commands setup ---
const commands = [
  {
    name: 'send',
    description: 'Make the bot send a message or image',
    options: [
      {
        name: 'message',
        description: 'The text to send',
        type: ApplicationCommandOptionType.String,
        required: false
      },
      {
        name: 'image',
        description: 'An image to send',
        type: ApplicationCommandOptionType.Attachment,
        required: false
      }
    ]
  }
];

// --- Ready event ---
client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}`);
  // Set status
  client.user.setPresence({
    status: 'dnd',
    activities: [{ name: 'discord.gg/fameunlocked', type: ActivityType.Custom }]
  });
  // Register slash commands
  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('Slash commands registered');
  } catch (err) {
    console.error(err);
  }
});

// --- Interaction handler ---
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName === 'send') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return interaction.reply({ content: 'You need Manage Messages permission.', ephemeral: true });
    }
    const text = interaction.options.getString('message');
    const image = interaction.options.getAttachment('image');
    if (!text && !image) {
      return interaction.reply({ content: 'Provide message or image.', ephemeral: true });
    }
    await interaction.reply({ content: 'Message sent.', ephemeral: true });
    await interaction.channel.send({
      content: text || undefined,
      files: image ? [image.url] : undefined
    });
  }
});

// --- Message commands ---
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.guild) return;
  const prefix = getPrefix(message.guild.id);
  if (!message.content.startsWith(prefix)) return;
  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // ping
  if (command === 'ping') {
    return message.reply('Pong!');
  }
  // prefix
  if (command === 'prefix') {
    if (args[0] === 'set') {
      if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return message.reply('You need Manage Server permission.');
      }
      const newPrefix = args[1];
      if (!newPrefix || newPrefix.length > 5) {
        return message.reply('Invalid prefix.');
      }
      data.prefixes[message.guild.id] = newPrefix;
      saveData();
      return message.reply(`Prefix set to \`${newPrefix}\``);
    } else {
      return message.reply(`Current prefix is \`${prefix}\``);
    }
  }
  // help
  if (command === 'help') {
    const helpEmbed = new EmbedBuilder()
      .setColor('#FFE0E9')
      .setTitle('Petal Help')
      .setDescription('List of commands')
      .addFields(
        { name: 'ping', value: 'Check if bot is online', inline: true },
        { name: 'prefix', value: 'Show/set prefix', inline: true },
        { name: 'lock', value: 'Lock channel', inline: true },
        { name: 'unlock', value: 'Unlock channel', inline: true },
        { name: 'welcomer', value: 'Set welcome channel', inline: true },
        { name: 'testwelcome', value: 'Test welcome', inline: true },
        { name: '/send', value: 'Send message/image', inline: true }
      )
      .setFooter({ text: `Requested by ${message.author.tag}` })
      .setTimestamp();
    return message.reply({ embeds: [helpEmbed] });
  }
  // lock
  if (command === 'lock') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      const noPerm = new EmbedBuilder()
        .setColor('#FFE0E9')
        .setTitle('Missing Permissions')
        .setDescription('Need Manage Channels')
        .setFooter({ text: `Requested by ${message.author.tag}` })
        .setTimestamp();
      return message.reply({ embeds: [noPerm] });
    }
    try {
      await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, {
        SendMessages: false
      });
      const embed = new EmbedBuilder()
        .setColor('#FFE0E9')
        .setTitle('Channel Locked')
        .setDescription(`Locked by ${message.author.tag}`)
        .addFields(
          { name: 'Channel', value: `${message.channel}`, inline: true },
          { name: 'Moderator', value: `${message.author}`, inline: true }
        )
        .setFooter({ text: 'Petal' })
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    } catch (err) {
      return message.reply('Failed to lock');
    }
  }
  // unlock
  if (command === 'unlock') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      const noPerm = new EmbedBuilder()
        .setColor('#FFE0E9')
        .setTitle('Missing Permissions')
        .setDescription('Need Manage Channels')
        .setFooter({ text: `Requested by ${message.author.tag}` })
        .setTimestamp();
      return message.reply({ embeds: [noPerm] });
    }
    try {
      await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, {
        SendMessages: null
      });
      const embed = new EmbedBuilder()
        .setColor('#FFE0E9')
        .setTitle('Channel Unlocked')
        .setDescription(`Unlocked by ${message.author.tag}`)
        .addFields(
          { name: 'Channel', value: `${message.channel}`, inline: true },
          { name: 'Moderator', value: `${message.author}`, inline: true }
        )
        .setFooter({ text: 'Petal' })
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    } catch (err) {
      return message.reply('Failed to unlock');
    }
  }
  // welcomer
  if (command === 'welcomer') {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply('Need Admin permission');
    }
    const channel = message.mentions.channels.first();
    if (!channel) {
      return message.reply(`Usage: \`${prefix}welcomer #channel\``);
    }
    const askEmbed = new EmbedBuilder()
      .setColor('#FFE0E9')
      .setTitle('Welcome Setup')
      .setDescription(`Set welcome channel to ${channel}\nUpload banner image in next 60s`)
      .setFooter({ text: 'Petal' })
      .setTimestamp();

    await message.reply({ embeds: [askEmbed] });
    const filter = m => m.author.id === message.author.id && m.attachments.size > 0;
    const collected = await message.channel.awaitMessages({ filter, max: 1, time: 60000, errors: ['time'] }).catch(() => null);
    if (!collected) return message.channel.send('Timeout');
    const bannerUrl = collected.first().attachments.first().url;
    data.welcome[message.guild.id] = { channelId: channel.id, banner: bannerUrl };
    saveData();
    const successEmbed = new EmbedBuilder()
      .setColor('#FFE0E9')
      .setTitle('Welcome Set')
      .setDescription(`Welcome messages will send in ${channel}`)
      .setImage(bannerUrl)
      .setFooter({ text: 'Petal' })
      .setTimestamp();
    return message.channel.send({ embeds: [successEmbed] });
  }
  // testwelcome
  if (command === 'testwelcome') {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply('Need Admin permission');
    }
    const welcomeConfig = data.welcome[message.guild.id];
    if (!welcomeConfig) {
      return message.reply('Set welcome channel first');
    }
    const member = message.member;
    const joinDate = `<t:${Math.floor(member.user.createdTimestamp / 1000)}:D>`;
    const banner = welcomeConfig.banner || null;
    const welcomeEmbed = new EmbedBuilder()
      .setColor('#FFE0E9')
      .setTitle('Welcome')
      .setDescription(`Welcome ${member} to **${member.guild.name}**`)
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 512 }))
      .addFields(
        { name: 'User', value: `${member.user.tag}`, inline: true },
        { name: 'Account Created', value: joinDate, inline: true },
        { name: 'Member Count', value: `${member.guild.memberCount}`, inline: true }
      )
      .setFooter({ text: 'Petal' })
      .setTimestamp();
    if (banner) welcomeEmbed.setImage(banner);
    return message.reply({ content: `${member}`, embeds: [welcomeEmbed] });
  }
});

// Register slash commands
client.once(Events.ClientReady, async () => {
  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('Slash commands registered');
  } catch (err) {
    console.error(err);
  }
});

// Slash command array
const commands = [
  {
    name: 'send',
    description: 'Send message or image',
    options: [
      {
        name: 'message',
        description: 'Message text',
        type: ApplicationCommandOptionType.String,
        required: false
      },
      {
        name: 'image',
        description: 'Image attachment',
        type: ApplicationCommandOptionType.Attachment,
        required: false
      }
    ]
  }
];

// Handle slash commands
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'send') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return interaction.reply({ content: 'You need Manage Messages permission.', ephemeral: true });
    }
    const text = interaction.options.getString('message');
    const image = interaction.options.getAttachment('image');

    if (!text && !image) {
      return interaction.reply({ content: 'Provide message or image.', ephemeral: true });
    }
    await interaction.reply({ content: 'Sent!', ephemeral: true });
    await interaction.channel.send({
      content: text || undefined,
      files: image ? [image.url] : undefined
    });
  }
});

// Login bot
client.login(process.env.TOKEN);
