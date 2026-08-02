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
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} = require('discord.js');
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  StreamType
} = require('@discordjs/voice');
const ytdl = require('@distube/ytdl-core');
const ytSearch = require('yt-search');
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
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildVoiceStates
  ]
});

// Data storage
const dataPath = './data.json';
let data = {
  prefixes: {},
  welcome: {},
  leave: {},
  antinuke: {}
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

// ==================== MUSIC SYSTEM ====================
const queues = new Map();

function getQueue(guildId) {
  return queues.get(guildId);
}

function createMusicButtons(isPaused = false, isLooping = false) {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('music_pause_resume')
      .setLabel(isPaused ? 'Resume' : 'Pause')
      .setStyle(ButtonStyle.Primary)
      .setEmoji(isPaused ? '▶️' : '⏸️'),
    new ButtonBuilder()
      .setCustomId('music_skip')
      .setLabel('Skip')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('⏭️'),
    new ButtonBuilder()
      .setCustomId('music_loop')
      .setLabel(isLooping ? 'Loop: On' : 'Loop: Off')
      .setStyle(isLooping ? ButtonStyle.Success : ButtonStyle.Secondary)
      .setEmoji('🔁')
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('music_stop')
      .setLabel('End Session')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('⏹️')
  );

  return [row1, row2];
}

async function findSong(query) {
  try {
    if (ytdl.validateURL(query)) {
      const info = await ytdl.getInfo(query);
      const video = info.videoDetails;
      return {
        title: video.title,
        url: video.video_url,
        duration: new Date(video.lengthSeconds * 1000).toISOString().substr(11, 8).replace(/^00:/, ''),
        thumbnail: video.thumbnails[0]?.url || null,
        success: true
      };
    }

    const result = await ytSearch(query);
    if (!result || !result.videos || result.videos.length === 0) {
      return { success: false, error: 'No results found.' };
    }

    const video = result.videos[0];
    return {
      title: video.title,
      url: video.url,
      duration: video.timestamp || 'Unknown',
      thumbnail: video.thumbnail || null,
      success: true
    };
  } catch (err) {
    console.error('findSong error:', err.message);
    return { success: false, error: 'Failed to find the song.' };
  }
}

async function playSong(guildId) {
  const queue = getQueue(guildId);
  if (!queue || queue.songs.length === 0) {
    if (queue?.connection) {
      queue.connection.destroy();
      queues.delete(guildId);
    }
    return;
  }

  const song = queue.songs[0];

  try {
    const stream = ytdl(song.url, {
      filter: 'audioonly',
      highWaterMark: 1 << 25,
      quality: 'highestaudio'
    });

    const resource = createAudioResource(stream, {
      inputType: StreamType.Arbitrary
    });

    queue.player.play(resource);

    const embed = new EmbedBuilder()
      .setColor('#FFE0E9')
      .setAuthor({ name: 'Now Playing' })
      .setTitle(song.title)
      .setURL(song.url)
      .addFields(
        { name: 'Duration', value: `\`${song.duration || 'Unknown'}\``, inline: true },
        { name: 'Requested by', value: `${song.requestedBy}`, inline: true }
      )
      .setThumbnail(song.thumbnail || null)
      .setFooter({ text: 'Petal Music' })
      .setTimestamp();

    const buttons = createMusicButtons(false, queue.loop || false);

    const msg = await queue.textChannel.send({
      embeds: [embed],
      components: buttons
    }).catch(() => null);

    queue.nowPlayingMessage = msg;
  } catch (err) {
    console.error('Error playing song:', err.message);
    queue.textChannel.send(`Failed to play **${song.title}**`).catch(() => {});
    queue.songs.shift();
    playSong(guildId);
  }
}

// ==================== ANIME GIF HELPER ====================
async function getAnimeGif(category) {
  try {
    const response = await fetch(`https://api.waifu.pics/sfw/${category}`);
    const data = await response.json();
    return data.url;
  } catch {
    return null;
  }
}

// ==================== ANTI-NUKE SYSTEM ====================
const channelCache = new Map();
const roleCache = new Map();
const recentChannelDeletes = new Map();
const recentRoleDeletes = new Map();

const ANTINUKE_THRESHOLD = 3;
const ANTINUKE_WINDOW = 10_000;
const ANTINUKE_OFF_ROLE = '1531850051771568128';

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

function serializeRole(role) {
  return {
    id: role.id,
    name: role.name,
    color: role.color,
    hoist: role.hoist,
    permissions: role.permissions.bitfield.toString(),
    mentionable: role.mentionable,
    position: role.position
  };
}

function cacheGuild(guild) {
  const chMap = new Map();
  guild.channels.cache.forEach(ch => {
    if ([ChannelType.GuildCategory, ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildAnnouncement, ChannelType.GuildStageVoice, ChannelType.GuildForum].includes(ch.type)) {
      chMap.set(ch.id, serializeChannel(ch));
    }
  });
  channelCache.set(guild.id, chMap);

  const rMap = new Map();
  guild.roles.cache.forEach(role => {
    if (role.id !== guild.id) rMap.set(role.id, serializeRole(role));
  });
  roleCache.set(guild.id, rMap);
}

async function restoreChannels(guild, deletedChannels) {
  const sorted = [...deletedChannels].sort((a, b) => {
    if (a.type === ChannelType.GuildCategory && b.type !== ChannelType.GuildCategory) return -1;
    if (a.type !== ChannelType.GuildCategory && b.type === ChannelType.GuildCategory) return 1;
    return a.position - b.position;
  });

  const idMap = new Map();

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

      for (const ow of old.permissionOverwrites) {
        try {
          await newChannel.permissionOverwrites.edit(ow.id, {
            allow: BigInt(ow.allow),
            deny: BigInt(ow.deny)
          });
        } catch {}
      }
    } catch {}
  }
}

async function restoreRoles(guild, deletedRoles) {
  const sorted = [...deletedRoles].sort((a, b) => b.position - a.position);
  for (const old of sorted) {
    try {
      await guild.roles.create({
        name: old.name,
        color: old.color,
        hoist: old.hoist,
        permissions: BigInt(old.permissions),
        mentionable: old.mentionable,
        position: old.position,
        reason: 'Petal Anti-Nuke – Role restored'
      });
    } catch {}
  }
}

// Channel / Role events (Anti-Nuke)
client.on(Events.ChannelCreate, ch => {
  if (!ch.guild) return;
  const map = channelCache.get(ch.guild.id) || new Map();
  map.set(ch.id, serializeChannel(ch));
  channelCache.set(ch.guild.id, map);
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
  const config = data.antinuke[guild.id];
  if (!config?.enabled) return;

  let executor = null;
  try {
    const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.ChannelDelete, limit: 6 });
    const entry = logs.entries.find(e => e.target?.id === channel.id && Date.now() - e.createdTimestamp < 15000);
    if (entry) executor = entry.executor;
  } catch { return; }

  if (!executor || executor.id === client.user.id || executor.id === guild.ownerId) return;

  const map = channelCache.get(guild.id);
  const cached = map?.get(channel.id);
  if (!cached) return;
  map.delete(channel.id);

  if (!recentChannelDeletes.has(guild.id)) recentChannelDeletes.set(guild.id, []);
  const list = recentChannelDeletes.get(guild.id);
  list.push({ data: cached, executorId: executor.id, timestamp: Date.now() });

  const now = Date.now();
  const filtered = list.filter(e => now - e.timestamp < ANTINUKE_WINDOW);
  recentChannelDeletes.set(guild.id, filtered);

  const byUser = filtered.filter(e => e.executorId === executor.id);
  if (byUser.length >= ANTINUKE_THRESHOLD) {
    try { await guild.members.ban(executor.id, { reason: 'Petal Anti-Nuke' }); } catch {}
    try {
      const user = await client.users.fetch(executor.id);
      await user.send('kicked by petal');
    } catch {}
    await restoreChannels(guild, byUser.map(e => e.data));
    recentChannelDeletes.set(guild.id, filtered.filter(e => e.executorId !== executor.id));
  }
});

client.on(Events.GuildRoleCreate, role => {
  const map = roleCache.get(role.guild.id) || new Map();
  map.set(role.id, serializeRole(role));
  roleCache.set(role.guild.id, map);
});

client.on(Events.GuildRoleUpdate, (oldRole, newRole) => {
  const map = roleCache.get(newRole.guild.id) || new Map();
  map.set(newRole.id, serializeRole(newRole));
  roleCache.set(newRole.guild.id, map);
});

client.on(Events.GuildRoleDelete, async (role) => {
  const guild = role.guild;
  const config = data.antinuke[guild.id];
  if (!config?.enabled) return;

  let executor = null;
  try {
    const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.RoleDelete, limit: 6 });
    const entry = logs.entries.find(e => e.target?.id === role.id && Date.now() - e.createdTimestamp < 15000);
    if (entry) executor = entry.executor;
  } catch { return; }

  if (!executor || executor.id === client.user.id || executor.id === guild.ownerId) return;

  const map = roleCache.get(guild.id);
  const cached = map?.get(role.id);
  if (!cached) return;
  map.delete(role.id);

  if (!recentRoleDeletes.has(guild.id)) recentRoleDeletes.set(guild.id, []);
  const list = recentRoleDeletes.get(guild.id);
  list.push({ data: cached, executorId: executor.id, timestamp: Date.now() });

  const now = Date.now();
  const filtered = list.filter(e => now - e.timestamp < ANTINUKE_WINDOW);
  recentRoleDeletes.set(guild.id, filtered);

  const byUser = filtered.filter(e => e.executorId === executor.id);
  if (byUser.length >= ANTINUKE_THRESHOLD) {
    try { await guild.members.ban(executor.id, { reason: 'Petal Anti-Nuke' }); } catch {}
    try {
      const user = await client.users.fetch(executor.id);
      await user.send('kicked by petal');
    } catch {}
    await restoreRoles(guild, byUser.map(e => e.data));
    recentRoleDeletes.set(guild.id, filtered.filter(e => e.executorId !== executor.id));
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
  },
  {
    name: 'servercopy',
    description: 'Copy all channels from another server the bot is in (DESTRUCTIVE)'
  }
];

client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}`);

  client.user.setPresence({
    status: 'dnd',
    activities: [{
      name: 'Petal by Ariana Grande',
      type: ActivityType.Listening
    }]
  });

  for (const guild of client.guilds.cache.values()) {
    cacheGuild(guild);
  }

  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('Slash commands registered');
  } catch (err) {
    console.error(err);
  }
});

// Welcome + Leave
client.on(Events.GuildMemberAdd, async (member) => {
  const welcomeConfig = data.welcome[member.guild.id];
  if (!welcomeConfig?.channelId) return;

  const channel = member.guild.channels.cache.get(welcomeConfig.channelId);
  if (!channel) return;

  try { await member.roles.add('1531850889357299892'); } catch {}

  const embed = new EmbedBuilder()
    .setColor('#FFE0E9')
    .setTitle('Welcome')
    .setDescription(`Welcome ${member} to **${member.guild.name}**`)
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 512 }))
    .addFields(
      { name: 'User', value: member.user.tag, inline: true },
      { name: 'Account Created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
      { name: 'Member Count', value: `${member.guild.memberCount}`, inline: true }
    )
    .setFooter({ text: 'Petal' })
    .setTimestamp();

  if (welcomeConfig.banner) embed.setImage(welcomeConfig.banner);
  channel.send({ content: `${member}`, embeds: [embed] }).catch(() => {});
});

client.on(Events.GuildMemberRemove, async (member) => {
  const leaveConfig = data.leave[member.guild.id];
  if (!leaveConfig?.channelId) return;

  const channel = member.guild.channels.cache.get(leaveConfig.channelId);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setColor('#FFE0E9')
    .setTitle('Member Left')
    .setDescription(`**${member.user.tag}** has left the server.`)
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .addFields(
      { name: 'User', value: member.user.tag, inline: true },
      { name: 'ID', value: member.user.id, inline: true },
      { name: 'Member Count', value: `${member.guild.memberCount}`, inline: true }
    )
    .setFooter({ text: 'Petal' })
    .setTimestamp();

  channel.send({ embeds: [embed] }).catch(() => {});
});

// ==================== INTERACTION HANDLER ====================
client.on(Events.InteractionCreate, async (interaction) => {

  // ===== /send =====
  if (interaction.isChatInputCommand() && interaction.commandName === 'send') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return interaction.reply({ content: 'You need Manage Messages permission.', ephemeral: true });
    }
    const text = interaction.options.getString('message');
    const image = interaction.options.getAttachment('image');
    if (!text && !image) return interaction.reply({ content: 'Provide a message or image.', ephemeral: true });

    await interaction.reply({ content: 'Message sent.', ephemeral: true });
    await interaction.channel.send({ content: text || undefined, files: image ? [image.url] : undefined });
    return;
  }

  // ===== /servercopy =====
  if (interaction.isChatInputCommand() && interaction.commandName === 'servercopy') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: 'Only Administrators can use this command.', ephemeral: true });
    }

    const guilds = [...client.guilds.cache.values()].filter(g => g.id !== interaction.guildId);

    if (guilds.length === 0) {
      return interaction.reply({ content: 'The bot is not in any other servers.', ephemeral: true });
    }

    const options = guilds.slice(0, 25).map(g => 
      new StringSelectMenuOptionBuilder()
        .setLabel(g.name.substring(0, 100))
        .setDescription(`${g.memberCount} members`)
        .setValue(g.id)
    );

    const select = new StringSelectMenuBuilder()
      .setCustomId('servercopy_select')
      .setPlaceholder('Select the server to copy FROM')
      .addOptions(options);

    const row = new ActionRowBuilder().addComponents(select);

    await interaction.reply({
      content: '**WARNING:** This will **DELETE ALL CHANNELS** in this server and copy channels from the selected server.\n\nChoose the server to copy from:',
      components: [row],
      ephemeral: true
    });
    return;
  }

  // ===== Server Copy Select Menu =====
  if (interaction.isStringSelectMenu() && interaction.customId === 'servercopy_select') {
    const sourceGuildId = interaction.values[0];
    const sourceGuild = client.guilds.cache.get(sourceGuildId);

    if (!sourceGuild) {
      return interaction.update({ content: 'Could not find that server.', components: [] });
    }

    const confirmRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`servercopy_confirm_${sourceGuildId}`)
        .setLabel('Yes, delete everything & copy')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('servercopy_cancel')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.update({
      content: `You selected **${sourceGuild.name}**.\n\nThis will **DELETE ALL CHANNELS** in **${interaction.guild.name}** and copy everything from **${sourceGuild.name}**.\n\nAre you sure?`,
      components: [confirmRow]
    });
    return;
  }

  // ===== Server Copy Confirm / Cancel =====
  if (interaction.isButton()) {
    if (interaction.customId === 'servercopy_cancel') {
      return interaction.update({ content: 'Server copy cancelled.', components: [] });
    }

    if (interaction.customId.startsWith('servercopy_confirm_')) {
      const sourceGuildId = interaction.customId.replace('servercopy_confirm_', '');
      const sourceGuild = client.guilds.cache.get(sourceGuildId);
      const targetGuild = interaction.guild;

      if (!sourceGuild) {
        return interaction.update({ content: 'Source server not found.', components: [] });
      }

      await interaction.update({ content: 'Starting server copy... This may take a while.', components: [] });

      try {
        // 1. Delete all channels in target
        const channelsToDelete = [...targetGuild.channels.cache.values()];
        for (const ch of channelsToDelete) {
          try {
            await ch.delete('Server copy - clearing channels');
          } catch {}
        }

        // 2. Get all channels from source (categories first)
        const sourceChannels = [...sourceGuild.channels.cache.values()]
          .filter(c => [
            ChannelType.GuildCategory,
            ChannelType.GuildText,
            ChannelType.GuildVoice,
            ChannelType.GuildAnnouncement,
            ChannelType.GuildStageVoice,
            ChannelType.GuildForum
          ].includes(c.type))
          .sort((a, b) => {
            if (a.type === ChannelType.GuildCategory && b.type !== ChannelType.GuildCategory) return -1;
            if (a.type !== ChannelType.GuildCategory && b.type === ChannelType.GuildCategory) return 1;
            return a.position - b.position;
          });

        const idMap = new Map(); // oldId → newChannel

        for (const old of sourceChannels) {
          try {
            const options = {
              name: old.name,
              type: old.type,
              topic: old.topic || undefined,
              nsfw: old.nsfw || false,
              rateLimitPerUser: old.rateLimitPerUser || 0,
              position: old.position,
              reason: `Copied from ${sourceGuild.name}`
            };

            if (old.parentId && idMap.has(old.parentId)) {
              options.parent = idMap.get(old.parentId).id;
            }

            const newChannel = await targetGuild.channels.create(options);
            idMap.set(old.id, newChannel);

            // Copy permission overwrites (best effort)
            for (const ow of old.permissionOverwrites.cache.values()) {
              try {
                await newChannel.permissionOverwrites.edit(ow.id, {
                  allow: ow.allow,
                  deny: ow.deny
                });
              } catch {}
            }
          } catch (err) {
            console.error('Failed to copy channel:', old.name, err.message);
          }
        }

        await interaction.followUp({
          content: `Successfully copied **${sourceChannels.length}** channels from **${sourceGuild.name}** into **${targetGuild.name}**.`
        });

      } catch (err) {
        console.error('Server copy failed:', err);
        await interaction.followUp({ content: `Something went wrong: ${err.message}` });
      }
      return;
    }
  }

  // ===== Music Buttons =====
  if (interaction.isButton() && interaction.customId.startsWith('music_')) {
    const queue = getQueue(interaction.guildId);
    if (!queue) return interaction.reply({ content: 'No active music session.', ephemeral: true });

    if (!interaction.member.voice.channel || interaction.member.voice.channelId !== queue.connection.joinConfig.channelId) {
      return interaction.reply({ content: 'You must be in the same voice channel.', ephemeral: true });
    }

    if (interaction.customId === 'music_pause_resume') {
      if (queue.player.state.status === AudioPlayerStatus.Paused) {
        queue.player.unpause();
        await interaction.update({ components: createMusicButtons(false, queue.loop || false) });
        await interaction.followUp({ content: `${interaction.user} resumed the playback!` });
      } else {
        queue.player.pause();
        await interaction.update({ components: createMusicButtons(true, queue.loop || false) });
        await interaction.followUp({ content: `${interaction.user} has just paused the playback!` });
      }
    }

    if (interaction.customId === 'music_skip') {
      queue.player.stop();
      await interaction.reply({ content: `${interaction.user} skipped the song.` });
    }

    if (interaction.customId === 'music_loop') {
      queue.loop = !queue.loop;
      await interaction.update({
        components: createMusicButtons(queue.player.state.status === AudioPlayerStatus.Paused, queue.loop)
      });
      await interaction.followUp({ content: `Loop is now **${queue.loop ? 'enabled' : 'disabled'}**.`, ephemeral: true });
    }

    if (interaction.customId === 'music_stop') {
      queue.songs = [];
      queue.player.stop();
      queue.connection.destroy();
      queues.delete(interaction.guildId);
      await interaction.update({ content: 'Music session ended.', embeds: [], components: [] });
    }
  }
});

// ==================== PREFIX COMMANDS ====================
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.guild) return;

  // Invite blocker
  const inviteRegex = /(https?:\/\/)?(www\.)?(discord\.(gg|io|me|li)|discordapp\.com\/invite|discord\.com\/invite)\/[a-zA-Z0-9]+/gi;
  if (inviteRegex.test(message.content)) {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator) && !message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      try {
        await message.delete();
        const embed = new EmbedBuilder()
          .setColor('#FFE0E9')
          .setTitle('Invite Links Are Not Allowed')
          .setDescription(`${message.author}, posting Discord invite links is **not permitted**.`)
          .setFooter({ text: 'Petal • Server Protection' });
        const warning = await message.channel.send({ embeds: [embed] });
        setTimeout(() => warning.delete().catch(() => {}), 8000);
      } catch {}
      return;
    }
  }

  const prefix = getPrefix(message.guild.id);
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (command === 'ping') return message.reply('Pong!');

  if (command === 'prefix') {
    if (args[0] === 'set') {
      if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) return message.reply('Missing permission.');
      const newPrefix = args[1];
      if (!newPrefix || newPrefix.length > 5) return message.reply('Invalid prefix.');
      data.prefixes[message.guild.id] = newPrefix;
      saveData();
      return message.reply(`Prefix changed to \`${newPrefix}\``);
    }
    return message.reply(`Current prefix is \`${prefix}\``);
  }

  if (command === 'help') {
    const embed = new EmbedBuilder()
      .setColor('#FFE0E9')
      .setTitle('Petal Help Menu')
      .addFields(
        { name: 'General', value: `\`${prefix}ping\`\n\`${prefix}prefix\`` },
        { name: 'Moderation', value: `\`${prefix}lock\`\n\`${prefix}unlock\`\n\`${prefix}hardban\`\n\`${prefix}dm\`` },
        { name: 'Welcome / Leave', value: `\`${prefix}welcomer\`\n\`${prefix}testwelcome\`\n\`${prefix}leaver\`` },
        { name: 'Anti-Nuke', value: `\`${prefix}antinuke\`\n\`${prefix}antinuke off\`` },
        { name: 'Music', value: `\`${prefix}play\`\n\`${prefix}skip\`\n\`${prefix}stop\`\n\`${prefix}pause\`\n\`${prefix}resume\`\n\`${prefix}queue\`\n\`${prefix}np\`\n\`${prefix}leave\`` },
        { name: 'Fun', value: `\`${prefix}hug\`\n\`${prefix}slap\`\n\`${prefix}punch\`\n\`${prefix}kick\`` },
        { name: 'Slash Commands', value: '`/send`\n`/servercopy`' }
      )
      .setFooter({ text: `Requested by ${message.author.tag}` });
    return message.reply({ embeds: [embed] });
  }

  // Fun commands
  if (['hug', 'slap', 'punch', 'kick'].includes(command)) {
    const target = message.mentions.users.first();
    if (!target) return message.reply(`Usage: \`${prefix}${command} @user\``);
    const category = command === 'punch' ? 'slap' : command;
    const gif = await getAnimeGif(category);
    if (!gif) return message.reply('Failed to get gif.');
    const embed = new EmbedBuilder()
      .setColor('#FFE0E9')
      .setDescription(`**${message.author}** ${command}ed **${target}**!`)
      .setImage(gif);
    return message.reply({ embeds: [embed] });
  }

  // Music
  if (command === 'play') {
    const query = args.join(' ');
    if (!query) return message.reply(`Usage: \`${prefix}play <song/url>\``);

    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) return message.reply('Join a voice channel first.');

    const searchingMsg = await message.reply('Searching...');
    const result = await findSong(query);
    if (!result.success) return searchingMsg.edit(result.error);

    const songInfo = {
      title: result.title,
      url: result.url,
      duration: result.duration,
      thumbnail: result.thumbnail,
      requestedBy: message.author
    };

    let queue = getQueue(message.guild.id);

    if (!queue) {
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: message.guild.id,
        adapterCreator: message.guild.voiceAdapterCreator,
        selfDeaf: true
      });

      const player = createAudioPlayer();
      connection.subscribe(player);

      queue = { connection, player, songs: [], textChannel: message.channel, loop: false };
      queues.set(message.guild.id, queue);

      player.on(AudioPlayerStatus.Idle, () => {
        if (queue.loop && queue.songs.length > 0) playSong(message.guild.id);
        else {
          queue.songs.shift();
          playSong(message.guild.id);
        }
      });

      player.on('error', () => {
        queue.songs.shift();
        playSong(message.guild.id);
      });
    }

    queue.songs.push(songInfo);

    if (queue.songs.length === 1) {
      await searchingMsg.delete().catch(() => {});
      playSong(message.guild.id);
    } else {
      const embed = new EmbedBuilder()
        .setColor('#FFE0E9')
        .setAuthor({ name: `#${queue.songs.length} Track Queued` })
        .setDescription(`**${songInfo.title}** has been added`)
        .setThumbnail(songInfo.thumbnail);
      await searchingMsg.edit({ content: null, embeds: [embed] });
    }
  }

  if (command === 'stop') {
    const queue = getQueue(message.guild.id);
    if (!queue) return message.reply('Nothing is playing.');
    queue.songs = [];
    queue.player.stop();
    queue.connection.destroy();
    queues.delete(message.guild.id);
    return message.reply('Stopped.');
  }

  if (command === 'skip') {
    const queue = getQueue(message.guild.id);
    if (!queue) return message.reply('Nothing is playing.');
    queue.player.stop();
    return message.reply('Skipped.');
  }

  if (command === 'pause') {
    const queue = getQueue(message.guild.id);
    if (!queue) return message.reply('Nothing is playing.');
    queue.player.pause();
    return message.reply('Paused.');
  }

  if (command === 'resume') {
    const queue = getQueue(message.guild.id);
    if (!queue) return message.reply('Nothing is playing.');
    queue.player.unpause();
    return message.reply('Resumed.');
  }

  if (command === 'queue') {
    const queue = getQueue(message.guild.id);
    if (!queue || !queue.songs.length) return message.reply('Queue is empty.');
    const list = queue.songs.slice(0, 10).map((s, i) => `**${i + 1}.** ${s.title}`).join('\n');
    return message.reply({ embeds: [new EmbedBuilder().setColor('#FFE0E9').setTitle('Queue').setDescription(list)] });
  }

  if (command === 'np' || command === 'nowplaying') {
    const queue = getQueue(message.guild.id);
    if (!queue || !queue.songs.length) return message.reply('Nothing is playing.');
    const song = queue.songs[0];
    return message.reply({
      embeds: [new EmbedBuilder()
        .setColor('#FFE0E9')
        .setAuthor({ name: 'Now Playing' })
        .setTitle(song.title)
        .setURL(song.url)
        .setThumbnail(song.thumbnail)]
    });
  }

  if (command === 'leave') {
    const queue = getQueue(message.guild.id);
    if (!queue) return message.reply('Not in a voice channel.');
    queue.songs = [];
    queue.player.stop();
    queue.connection.destroy();
    queues.delete(message.guild.id);
    return message.reply('Left.');
  }

  // lock / unlock
  if (command === 'lock') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) return message.reply('Missing permission.');
    await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });
    return message.reply({ embeds: [new EmbedBuilder().setColor('#FFE0E9').setTitle('Channel Locked')] });
  }

  if (command === 'unlock') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) return message.reply('Missing permission.');
    await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null });
    return message.reply({ embeds: [new EmbedBuilder().setColor('#FFE0E9').setTitle('Channel Unlocked')] });
  }

  // welcomer
  if (command === 'welcomer') {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return message.reply('Admin only.');
    const channel = message.mentions.channels.first();
    if (!channel) return message.reply(`Usage: \`${prefix}welcomer #channel\``);
    await message.reply('Upload a banner image within 60 seconds.');
    const collected = await message.channel.awaitMessages({
      filter: m => m.author.id === message.author.id && m.attachments.size > 0,
      max: 1, time: 60000
    }).catch(() => null);
    if (!collected) return message.channel.send('Timed out.');
    data.welcome[message.guild.id] = { channelId: channel.id, banner: collected.first().attachments.first().url };
    saveData();
    return message.channel.send({ embeds: [new EmbedBuilder().setColor('#FFE0E9').setTitle('Welcome System Ready').setImage(data.welcome[message.guild.id].banner)] });
  }

  if (command === 'testwelcome') {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return message.reply('Admin only.');
    const config = data.welcome[message.guild.id];
    if (!config) return message.reply('Not set up.');
    const embed = new EmbedBuilder().setColor('#FFE0E9').setTitle('Welcome').setDescription(`Welcome ${message.member}`).setThumbnail(message.author.displayAvatarURL());
    if (config.banner) embed.setImage(config.banner);
    return message.reply({ content: `${message.member}`, embeds: [embed] });
  }

  if (command === 'leaver') {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return message.reply('Admin only.');
    const channel = message.mentions.channels.first();
    if (!channel) return message.reply(`Usage: \`${prefix}leaver #channel\``);
    data.leave[message.guild.id] = { channelId: channel.id };
    saveData();
    return message.reply({ embeds: [new EmbedBuilder().setColor('#FFE0E9').setTitle('Leave Channel Set')] });
  }

  if (command === 'dm') {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return message.reply('Admin only.');
    const target = message.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null);
    if (!target) return message.reply(`Usage: \`${prefix}dm @user message\``);
    const text = args.slice(1).join(' ');
    if (!text) return message.reply('Provide a message.');
    try {
      await target.send(text);
      return message.reply(`DM sent to **${target.tag}**`);
    } catch {
      return message.reply('Could not DM that user.');
    }
  }

  if (command === 'hardban') {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return message.reply('Admin only.');
    const target = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
    if (!target) return message.reply(`Usage: \`${prefix}hardban @user\``);
    if (!target.bannable) return message.reply('Cannot ban this user.');
    await target.ban({ deleteMessageSeconds: 604800, reason: `Hardbanned by ${message.author.tag}` });
    return message.reply({ embeds: [new EmbedBuilder().setColor('#FFE0E9').setTitle('User Hardbanned')] });
  }

  if (command === 'antinuke') {
    if (args[0] === 'off') {
      if (!message.member.roles.cache.has(ANTINUKE_OFF_ROLE)) return message.reply('You cannot disable it.');
      data.antinuke[message.guild.id] = { enabled: false };
      saveData();
      return message.reply({ embeds: [new EmbedBuilder().setColor('#FFE0E9').setTitle('Anti-Nuke Disabled')] });
    }
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return message.reply('Admin only.');
    data.antinuke[message.guild.id] = { enabled: true };
    saveData();
    cacheGuild(message.guild);
    return message.reply({ embeds: [new EmbedBuilder().setColor('#FFE0E9').setTitle('Anti-Nuke Enabled')] });
  }
});

client.login(process.env.TOKEN);
