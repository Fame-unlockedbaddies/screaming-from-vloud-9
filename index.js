const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  Events,
  REST,
  Routes,
  PermissionFlagsBits,
  ApplicationCommandOptionType,
  ActivityType,
  AuditLogEvent,
  ChannelType
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

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration // needed for audit logs
  ]
});

// Data storage
const dataPath = './data.json';
let data = {
  prefixes: {},
  welcome: {},
  antinuke: {} // guildId → { enabled: true/false }
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

// ==================== ANTI-NUKE SYSTEM ====================
const channelCache = new Map(); // guildId → Map(channelId → channelData)
const recentDeletes = new Map(); // guildId → [{ channelData, executorId, timestamp }]

const ANTINUKE_THRESHOLD = 3;      // channels
const ANTINUKE_WINDOW = 10_000;    // 10 seconds

function serializeChannel(channel) {
  return {
    id: channel.id,
    name: channel.name,
    type: channel.type,
    topic: channel.topic || null,
    nsfw: channel.nsfw || false,
    rateLimitPerUser: channel.rateLimitPerUser || 0,
    parentId: channel.parentId || null,
    position: channel.position,
    permissionOverwrites: channel.permissionOverwrites.cache.map(ow => ({
      id: ow.id,
      type: ow.type,
      allow: ow.allow.bitfield.toString(),
      deny: ow.deny.bitfield.toString()
    }))
  };
}

function cacheGuildChannels(guild) {
  const map = new Map();
  guild.channels.cache.forEach(ch => {
    if (ch.type === ChannelType.GuildCategory ||
        ch.type === ChannelType.GuildText ||
        ch.type === ChannelType.GuildVoice ||
        ch.type === ChannelType.GuildAnnouncement ||
        ch.type === ChannelType.GuildStageVoice ||
        ch.type === ChannelType.GuildForum) {
      map.set(ch.id, serializeChannel(ch));
    }
  });
  channelCache.set(guild.id, map);
}

async function restoreChannels(guild, deletedChannels) {
  // Sort so categories are created first
  const sorted = [...deletedChannels].sort((a, b) => {
    if (a.type === ChannelType.GuildCategory && b.type !== ChannelType.GuildCategory) return -1;
    if (a.type !== ChannelType.GuildCategory && b.type === ChannelType.GuildCategory) return 1;
    return a.position - b.position;
  });

  const idMap = new Map(); // oldId → newChannel

  for (const old of sorted) {
    try {
      const options = {
        name: old.name,
        type: old.type,
        topic: old.topic,
        nsfw: old.nsfw,
        rateLimitPerUser: old.rateLimitPerUser,
        position: old.position,
        reason: 'Petal Anti-Nuke – Channel restored'
      };

      if (old.parentId && idMap.has(old.parentId)) {
        options.parent = idMap.get(old.parentId).id;
      } else if (old.parentId && guild.channels.cache.has(old.parentId)) {
        options.parent = old.parentId;
      }

      const newChannel = await guild.channels.create(options);
      idMap.set(old.id, newChannel);

      // Restore permission overwrites
      for (const ow of old.permissionOverwrites) {
        try {
          await newChannel.permissionOverwrites.edit(ow.id, {
            allow: BigInt(ow.allow),
            deny: BigInt(ow.deny)
          });
        } catch (e) {
          // Role/user may no longer exist – ignore
        }
      }
    } catch (err) {
      console.error('Failed to restore channel:', old.name, err.message);
    }
  }
}

client.on(Events.ChannelCreate, (channel) => {
  if (!channel.guild) return;
  const map = channelCache.get(channel.guild.id) || new Map();
  map.set(channel.id, serializeChannel(channel));
  channelCache.set(channel.guild.id, map);
});

client.on(Events.ChannelUpdate, (oldCh, newCh) => {
  if (!newCh.guild) return;
  const map = channelCache.get(newCh.guild.id) || new Map();
  map.set(newCh.id, serializeChannel(newCh));
  channelCache.set(newCh.guild.id, map);
});

client.on(Events.ChannelDelete, async (channel) => {
  if (!channel.guild) return;

  const guild = channel.guild;
  const antinukeConfig = data.antinuke[guild.id];
  if (!antinukeConfig || !antinukeConfig.enabled) return;

  // Get who deleted it from audit logs
  let executor = null;
  try {
    const logs = await guild.fetchAuditLogs({
      type: AuditLogEvent.ChannelDelete,
      limit: 5
    });
    const entry = logs.entries.find(e =>
      e.target?.id === channel.id &&
      Date.now() - e.createdTimestamp < 10000
    );
    if (entry) executor = entry.executor;
  } catch (err) {
    console.error('Audit log fetch failed:', err.message);
    return;
  }

  if (!executor || executor.id === client.user.id || executor.id === guild.ownerId) return;

  // Get cached data of the deleted channel
  const map = channelCache.get(guild.id);
  const cached = map?.get(channel.id);
  if (!cached) return;

  // Remove from cache
  map.delete(channel.id);

  // Track recent deletes
  if (!recentDeletes.has(guild.id)) recentDeletes.set(guild.id, []);
  const list = recentDeletes.get(guild.id);

  list.push({
    channelData: cached,
    executorId: executor.id,
    timestamp: Date.now()
  });

  // Clean old entries
  const now = Date.now();
  const filtered = list.filter(e => now - e.timestamp < ANTINUKE_WINDOW);
  recentDeletes.set(guild.id, filtered);

  // Count how many this executor deleted recently
  const byThisUser = filtered.filter(e => e.executorId === executor.id);

  if (byThisUser.length >= ANTINUKE_THRESHOLD) {
    // MASS DELETE DETECTED
    console.log(`[Anti-Nuke] Mass delete detected by ${executor.tag} in ${guild.name}`);

    // Ban the user
    try {
      await guild.members.ban(executor.id, {
        reason: 'Petal Anti-Nuke – Mass channel deletion',
        deleteMessageSeconds: 0
      });
    } catch (err) {
      console.error('Failed to ban:', err.message);
    }

    // DM them
    try {
      const user = await client.users.fetch(executor.id);
      await user.send('kicked by petal');
    } catch (err) {
      // DMs closed – ignore
    }

    // Restore all channels they just deleted
    const toRestore = byThisUser.map(e => e.channelData);
    await restoreChannels(guild, toRestore);

    // Clear their recent deletes so we don’t spam
    recentDeletes.set(
      guild.id,
      filtered.filter(e => e.executorId !== executor.id)
    );

    // Optional: send a log message to a mod channel if you want later
  }
});

// ==================== SLASH COMMANDS ====================
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

client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}`);

  client.user.setPresence({
    status: 'dnd',
    activities: [{
      name: 'discord.gg/fameunlocked',
      type: ActivityType.Custom
    }]
  });

  // Cache all channels on startup
  for (const guild of client.guilds.cache.values()) {
    cacheGuildChannels(guild);
  }

  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('Slash commands registered');
  } catch (err) {
    console.error(err);
  }
});

// Welcome event
client.on(Events.GuildMemberAdd, async (member) => {
  const welcomeConfig = data.welcome[member.guild.id];
  if (!welcomeConfig || !welcomeConfig.channelId) return;

  const channel = member.guild.channels.cache.get(welcomeConfig.channelId);
  if (!channel) return;

  try {
    await member.roles.add('1531850889357299892');
  } catch (err) {
    console.error('Failed to give role:', err);
  }

  const joinDate = `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`;
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

  channel.send({ content: `${member}`, embeds: [welcomeEmbed] }).catch(() => {});
});

// Slash command handler
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'send') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return interaction.reply({
        content: 'You need Manage Messages permission to use this command.',
        ephemeral: true
      });
    }

    const text = interaction.options.getString('message');
    const image = interaction.options.getAttachment('image');

    if (!text && !image) {
      return interaction.reply({
        content: 'You must provide a message or an image.',
        ephemeral: true
      });
    }

    await interaction.reply({ content: 'Message sent.', ephemeral: true });
    await interaction.channel.send({
      content: text || undefined,
      files: image ? [image.url] : undefined
    });
  }
});

// Prefix commands
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
        return message.reply('You need Manage Server permission to change the prefix.');
      }
      const newPrefix = args[1];
      if (!newPrefix || newPrefix.length > 5) {
        return message.reply('Please provide a valid prefix (max 5 characters).');
      }
      data.prefixes[message.guild.id] = newPrefix;
      saveData();
      return message.reply(`Prefix has been changed to \`${newPrefix}\``);
    }
    return message.reply(`Current prefix is \`${prefix}\``);
  }

  // help
  if (command === 'help') {
    const helpEmbed = new EmbedBuilder()
      .setColor('#FFE0E9')
      .setTitle('Petal Help')
      .setDescription('List of available commands')
      .addFields(
        { name: 'ping', value: 'Check if the bot is online', inline: true },
        { name: 'prefix', value: 'Show or change the prefix', inline: true },
        { name: 'lock', value: 'Lock the current channel', inline: true },
        { name: 'unlock', value: 'Unlock the current channel', inline: true },
        { name: 'welcomer', value: 'Set the welcome channel + banner', inline: true },
        { name: 'testwelcome', value: 'Test the welcome message', inline: true },
        { name: 'antinuke', value: 'Enable/disable anti-nuke protection', inline: true },
        { name: '/send', value: 'Make the bot send a message or image', inline: true }
      )
      .setFooter({ text: `Requested by ${message.author.tag}` })
      .setTimestamp();
    return message.reply({ embeds: [helpEmbed] });
  }

  // lock
  if (command === 'lock') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      const noPermEmbed = new EmbedBuilder()
        .setColor('#FFE0E9')
        .setTitle('Missing Permissions')
        .setDescription('You need the **Manage Channels** permission to use this command.')
        .setFooter({ text: `Requested by ${message.author.tag}` })
        .setTimestamp();
      return message.reply({ embeds: [noPermEmbed] });
    }

    try {
      await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, {
        SendMessages: false
      });

      const lockEmbed = new EmbedBuilder()
        .setColor('#FFE0E9')
        .setTitle('Channel Locked')
        .setDescription(`This channel has been locked by **${message.author.tag}**.\n\nMembers can no longer send messages.`)
        .addFields(
          { name: 'Channel', value: `${message.channel}`, inline: true },
          { name: 'Moderator', value: `${message.author}`, inline: true }
        )
        .setFooter({ text: 'Petal' })
        .setTimestamp();
      return message.reply({ embeds: [lockEmbed] });
    } catch (err) {
      return message.reply('Failed to lock the channel.');
    }
  }

  // unlock
  if (command === 'unlock') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      const noPermEmbed = new EmbedBuilder()
        .setColor('#FFE0E9')
        .setTitle('Missing Permissions')
        .setDescription('You need the **Manage Channels** permission to use this command.')
        .setFooter({ text: `Requested by ${message.author.tag}` })
        .setTimestamp();
      return message.reply({ embeds: [noPermEmbed] });
    }

    try {
      await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, {
        SendMessages: null
      });

      const unlockEmbed = new EmbedBuilder()
        .setColor('#FFE0E9')
        .setTitle('Channel Unlocked')
        .setDescription(`This channel has been unlocked by **${message.author.tag}**.\n\nMembers can now send messages again.`)
        .addFields(
          { name: 'Channel', value: `${message.channel}`, inline: true },
          { name: 'Moderator', value: `${message.author}`, inline: true }
        )
        .setFooter({ text: 'Petal' })
        .setTimestamp();
      return message.reply({ embeds: [unlockEmbed] });
    } catch (err) {
      return message.reply('Failed to unlock the channel.');
    }
  }

  // welcomer
  if (command === 'welcomer') {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply('You need Administrator permission to use this command.');
    }

    const channel = message.mentions.channels.first();
    if (!channel) {
      return message.reply(`Usage: \`${prefix}welcomer #channel\``);
    }

    const askEmbed = new EmbedBuilder()
      .setColor('#FFE0E9')
      .setTitle('Welcome Setup')
      .setDescription(`Welcome channel set to ${channel}.\n\nPlease upload a **banner image** in the next message (you have 60 seconds).`)
      .setFooter({ text: 'Petal' })
      .setTimestamp();

    await message.reply({ embeds: [askEmbed] });

    const filter = (m) => m.author.id === message.author.id && m.attachments.size > 0;
    const collected = await message.channel.awaitMessages({
      filter,
      max: 1,
      time: 60000,
      errors: ['time']
    }).catch(() => null);

    if (!collected) {
      return message.channel.send('Timed out. Please run the command again and upload an image.');
    }

    const imageMessage = collected.first();
    const bannerUrl = imageMessage.attachments.first().url;

    data.welcome[message.guild.id] = {
      channelId: channel.id,
      banner: bannerUrl
    };
    saveData();

    const successEmbed = new EmbedBuilder()
      .setColor('#FFE0E9')
      .setTitle('Welcome System Ready')
      .setDescription(`Welcome messages will be sent in ${channel}`)
      .setImage(bannerUrl)
      .setFooter({ text: 'Petal' })
      .setTimestamp();

    return message.channel.send({ embeds: [successEmbed] });
  }

  // testwelcome
  if (command === 'testwelcome') {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply('You need Administrator permission to use this command.');
    }

    const welcomeConfig = data.welcome[message.guild.id];
    if (!welcomeConfig) {
      return message.reply(`Welcome system is not set up yet. Use \`${prefix}welcomer #channel\` first.`);
    }

    const member = message.member;
    const joinDate = `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`;
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

  // ==================== ANTINUKE COMMAND ====================
  if (command === 'antinuke') {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply('You need Administrator permission to use this command.');
    }

    const sub = args[0]?.toLowerCase();

    if (sub === 'on') {
      data.antinuke[message.guild.id] = { enabled: true };
      saveData();
      cacheGuildChannels(message.guild); // refresh cache

      const embed = new EmbedBuilder()
        .setColor('#FFE0E9')
        .setTitle('Anti-Nuke Enabled')
        .setDescription('Petal is now protecting this server from mass channel deletions.\n\nIf anyone (bot or user) deletes **3+ channels in 10 seconds**, they will be banned and the channels will be restored.')
        .setFooter({ text: 'Petal' })
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    }

    if (sub === 'off') {
      data.antinuke[message.guild.id] = { enabled: false };
      saveData();

      const embed = new EmbedBuilder()
        .setColor('#FFE0E9')
        .setTitle('Anti-Nuke Disabled')
        .setDescription('Anti-nuke protection has been turned off for this server.')
        .setFooter({ text: 'Petal' })
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    }

    // status
    const config = data.antinuke[message.guild.id];
    const enabled = config?.enabled === true;

    const embed = new EmbedBuilder()
      .setColor('#FFE0E9')
      .setTitle('Anti-Nuke Status')
      .setDescription(`Protection is currently **${enabled ? 'ENABLED' : 'DISABLED'}**.`)
      .addFields(
        { name: 'Threshold', value: '3 channels in 10 seconds', inline: true },
        { name: 'Action', value: 'Ban + Restore + DM', inline: true }
      )
      .setFooter({ text: `Use ${prefix}antinuke on / off` })
      .setTimestamp();
    return message.reply({ embeds: [embed] });
  }
});

client.login(process.env.TOKEN);
