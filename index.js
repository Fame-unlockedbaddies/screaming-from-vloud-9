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
  ButtonStyle
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
    // If it's a direct YouTube link
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

    // Search
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
    console.log('Trying to play:', song.url);

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
    queue.textChannel.send(`Failed to play **${song.title}**\nReason: \`${err.message}\``).catch(() => {});
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
  } catch (err) {
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
    position: role.position,
    icon: role.icon,
    unicodeEmoji: role.unicodeEmoji
  };
}

function cacheGuild(guild) {
  const chMap = new Map();
  guild.channels.cache.forEach(ch => {
    if ([
      ChannelType.GuildCategory,
      ChannelType.GuildText,
      ChannelType.GuildVoice,
      ChannelType.GuildAnnouncement,
      ChannelType.GuildStageVoice,
      ChannelType.GuildForum
    ].includes(ch.type)) {
      chMap.set(ch.id, serializeChannel(ch));
    }
  });
  channelCache.set(guild.id, chMap);

  const rMap = new Map();
  guild.roles.cache.forEach(role => {
    if (role.id !== guild.id) {
      rMap.set(role.id, serializeRole(role));
    }
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
    } catch (err) {}
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
    } catch (err) {}
  }
}

// Channel events
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
    try {
      await guild.members.ban(executor.id, { reason: 'Petal Anti-Nuke – Mass channel deletion' });
    } catch {}
    try {
      const user = await client.users.fetch(executor.id);
      await user.send('kicked by petal');
    } catch {}
    await restoreChannels(guild, byUser.map(e => e.data));
    recentChannelDeletes.set(guild.id, filtered.filter(e => e.executorId !== executor.id));
  }
});

// Role events
client.on(Events.GuildRoleCreate, (role) => {
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
    try {
      await guild.members.ban(executor.id, { reason: 'Petal Anti-Nuke – Mass role deletion' });
    } catch {}
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

// Welcome event
client.on(Events.GuildMemberAdd, async (member) => {
  const welcomeConfig = data.welcome[member.guild.id];
  if (!welcomeConfig || !welcomeConfig.channelId) return;

  const channel = member.guild.channels.cache.get(welcomeConfig.channelId);
  if (!channel) return;

  try {
    await member.roles.add('1531850889357299892');
  } catch (err) {}

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

// Leave event
client.on(Events.GuildMemberRemove, async (member) => {
  const leaveConfig = data.leave[member.guild.id];
  if (!leaveConfig || !leaveConfig.channelId) return;

  const channel = member.guild.channels.cache.get(leaveConfig.channelId);
  if (!channel) return;

  const leaveEmbed = new EmbedBuilder()
    .setColor('#FFE0E9')
    .setTitle('Member Left')
    .setDescription(`**${member.user.tag}** has left the server.`)
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 512 }))
    .addFields(
      { name: 'User', value: `${member.user.tag}`, inline: true },
      { name: 'ID', value: `${member.user.id}`, inline: true },
      { name: 'Member Count', value: `${member.guild.memberCount}`, inline: true }
    )
    .setFooter({ text: 'Petal' })
    .setTimestamp();

  channel.send({ embeds: [leaveEmbed] }).catch(() => {});
});

// ==================== BUTTON + SLASH HANDLER ====================
client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'send') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        return interaction.reply({ content: 'You need Manage Messages permission.', ephemeral: true });
      }

      const text = interaction.options.getString('message');
      const image = interaction.options.getAttachment('image');

      if (!text && !image) {
        return interaction.reply({ content: 'You must provide a message or an image.', ephemeral: true });
      }

      await interaction.reply({ content: 'Message sent.', ephemeral: true });
      await interaction.channel.send({
        content: text || undefined,
        files: image ? [image.url] : undefined
      });
    }
    return;
  }

  if (!interaction.isButton()) return;

  const queue = getQueue(interaction.guildId);
  if (!queue) {
    return interaction.reply({ content: 'No active music session.', ephemeral: true });
  }

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
});

// Prefix commands
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
          .setDescription(`${message.author}, posting Discord invite links is **not permitted** in this server.`)
          .setFooter({ text: 'Petal • Server Protection' })
          .setTimestamp();
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

  // ping
  if (command === 'ping') return message.reply('Pong!');

  // prefix
  if (command === 'prefix') {
    if (args[0] === 'set') {
      if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) return message.reply('You need Manage Server permission.');
      const newPrefix = args[1];
      if (!newPrefix || newPrefix.length > 5) return message.reply('Please provide a valid prefix (max 5 characters).');
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
      .setTitle('Petal Help Menu')
      .setDescription('Here is the full list of available commands:')
      .addFields(
        { name: 'General', value: `\`${prefix}ping\`\n\`${prefix}prefix\`\n\`${prefix}prefix set <prefix>\`` },
        { name: 'Moderation', value: `\`${prefix}lock\`\n\`${prefix}unlock\`\n\`${prefix}hardban @user\`\n\`${prefix}dm @user <msg>\`` },
        { name: 'Welcome / Leave', value: `\`${prefix}welcomer #channel\`\n\`${prefix}testwelcome\`\n\`${prefix}leaver #channel\`` },
        { name: 'Anti-Nuke', value: `\`${prefix}antinuke\`\n\`${prefix}antinuke off\`` },
        { name: 'Music', value: `\`${prefix}play <song/url>\`\n\`${prefix}skip\`\n\`${prefix}stop\`\n\`${prefix}pause\`\n\`${prefix}resume\`\n\`${prefix}queue\`\n\`${prefix}np\`\n\`${prefix}leave\`` },
        { name: 'Fun', value: `\`${prefix}hug @user\`\n\`${prefix}slap @user\`\n\`${prefix}punch @user\`\n\`${prefix}kick @user\`` }
      )
      .setFooter({ text: `Requested by ${message.author.tag}` })
      .setTimestamp();
    return message.reply({ embeds: [helpEmbed] });
  }

  // Fun commands
  if (['hug', 'slap', 'punch', 'kick'].includes(command)) {
    const target = message.mentions.users.first();
    if (!target) return message.reply(`Usage: \`${prefix}${command} @user\``);

    let category = command;
    if (command === 'punch') category = 'slap';

    const gif = await getAnimeGif(category);
    if (!gif) return message.reply(`Failed to get a ${command} gif.`);

    const embed = new EmbedBuilder()
      .setColor('#FFE0E9')
      .setDescription(`**${message.author}** ${command}ed **${target}**!`)
      .setImage(gif)
      .setFooter({ text: 'Petal' })
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }

  // ==================== PLAY COMMAND ====================
  if (command === 'play') {
    const query = args.join(' ');
    if (!query) return message.reply(`Usage: \`${prefix}play <song name or YouTube URL>\``);

    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) return message.reply('You need to be in a voice channel.');
    if (!voiceChannel.joinable || !voiceChannel.speakable) return message.reply('I cannot join that voice channel.');

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

      queue = {
        connection,
        player,
        songs: [],
        textChannel: message.channel,
        loop: false
      };

      queues.set(message.guild.id, queue);

      player.on(AudioPlayerStatus.Idle, () => {
        if (queue.loop && queue.songs.length > 0) {
          playSong(message.guild.id);
        } else {
          queue.songs.shift();
          playSong(message.guild.id);
        }
      });

      player.on('error', () => {
        queue.songs.shift();
        playSong(message.guild.id);
      });

      connection.on(VoiceConnectionStatus.Disconnected, async () => {
        try {
          await Promise.race([
            entersState(connection, VoiceConnectionStatus.Signalling, 5000),
            entersState(connection, VoiceConnectionStatus.Connecting, 5000)
          ]);
        } catch {
          connection.destroy();
          queues.delete(message.guild.id);
        }
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
        .setThumbnail(songInfo.thumbnail || null)
        .setFooter({ text: `Duration: ${songInfo.duration || 'Unknown'}` })
        .setTimestamp();

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
    return message.reply('Stopped the music.');
  }

  if (command === 'skip') {
    const queue = getQueue(message.guild.id);
    if (!queue || queue.songs.length === 0) return message.reply('Nothing is playing.');
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
    if (!queue || queue.songs.length === 0) return message.reply('Queue is empty.');
    const list = queue.songs.slice(0, 10).map((s, i) => `**${i + 1}.** [${s.title}](${s.url})`).join('\n');
    const embed = new EmbedBuilder().setColor('#FFE0E9').setTitle('Queue').setDescription(list);
    return message.reply({ embeds: [embed] });
  }

  if (command === 'np' || command === 'nowplaying') {
    const queue = getQueue(message.guild.id);
    if (!queue || queue.songs.length === 0) return message.reply('Nothing is playing.');
    const song = queue.songs[0];
    const embed = new EmbedBuilder()
      .setColor('#FFE0E9')
      .setAuthor({ name: 'Now Playing' })
      .setTitle(song.title)
      .setURL(song.url)
      .addFields(
        { name: 'Duration', value: `\`${song.duration}\``, inline: true },
        { name: 'Requested by', value: `${song.requestedBy}`, inline: true }
      )
      .setThumbnail(song.thumbnail);
    return message.reply({ embeds: [embed] });
  }

  if (command === 'leave') {
    const queue = getQueue(message.guild.id);
    if (!queue) return message.reply('I am not in a voice channel.');
    queue.songs = [];
    queue.player.stop();
    queue.connection.destroy();
    queues.delete(message.guild.id);
    return message.reply('Left the voice channel.');
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
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return message.reply('Administrator only.');
    const channel = message.mentions.channels.first();
    if (!channel) return message.reply(`Usage: \`${prefix}welcomer #channel\``);

    await message.reply('Please upload a banner image within 60 seconds.');
    const collected = await message.channel.awaitMessages({
      filter: m => m.author.id === message.author.id && m.attachments.size > 0,
      max: 1,
      time: 60000
    }).catch(() => null);

    if (!collected) return message.channel.send('Timed out.');
    const bannerUrl = collected.first().attachments.first().url;

    data.welcome[message.guild.id] = { channelId: channel.id, banner: bannerUrl };
    saveData();

    return message.channel.send({
      embeds: [new EmbedBuilder().setColor('#FFE0E9').setTitle('Welcome System Ready').setImage(bannerUrl)]
    });
  }

  if (command === 'testwelcome') {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return message.reply('Administrator only.');
    const config = data.welcome[message.guild.id];
    if (!config) return message.reply('Welcome not set up.');

    const embed = new EmbedBuilder()
      .setColor('#FFE0E9')
      .setTitle('Welcome')
      .setDescription(`Welcome ${message.member} to **${message.guild.name}**`)
      .setThumbnail(message.author.displayAvatarURL({ dynamic: true }));
    if (config.banner) embed.setImage(config.banner);

    return message.reply({ content: `${message.member}`, embeds: [embed] });
  }

  if (command === 'leaver') {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return message.reply('Administrator only.');
    const channel = message.mentions.channels.first();
    if (!channel) return message.reply(`Usage: \`${prefix}leaver #channel\``);
    data.leave[message.guild.id] = { channelId: channel.id };
    saveData();
    return message.reply({ embeds: [new EmbedBuilder().setColor('#FFE0E9').setTitle('Leave Channel Set')] });
  }

  // dm
  if (command === 'dm') {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return message.reply('Administrator only.');
    const target = message.mentions.users.first() || (args[0] ? await client.users.fetch(args[0]).catch(() => null) : null);
    if (!target) return message.reply(`Usage: \`${prefix}dm @user message\``);
    const dmMessage = args.slice(message.mentions.users.first() ? 1 : 1).join(' ');
    if (!dmMessage) return message.reply('Please provide a message.');
    try {
      await target.send(dmMessage);
      return message.reply(`DM sent to **${target.tag}**`);
    } catch {
      return message.reply('Failed to DM that user.');
    }
  }

  // hardban
  if (command === 'hardban') {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return message.reply('Administrator only.');
    const target = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
    if (!target) return message.reply(`Usage: \`${prefix}hardban @user [reason]\``);
    if (!target.bannable) return message.reply('I cannot ban this user.');
    const reason = args.slice(1).join(' ') || 'No reason';
    await target.ban({ deleteMessageSeconds: 604800, reason: `Hardbanned by ${message.author.tag} | ${reason}` });
    return message.reply({ embeds: [new EmbedBuilder().setColor('#FFE0E9').setTitle('User Hardbanned').setDescription(`**${target.user.tag}** was hardbanned.`)] });
  }

  // antinuke
  if (command === 'antinuke') {
    const sub = args[0]?.toLowerCase();
    if (sub === 'off') {
      if (!message.member.roles.cache.has(ANTINUKE_OFF_ROLE)) return message.reply('You cannot disable anti-nuke.');
      data.antinuke[message.guild.id] = { enabled: false };
      saveData();
      return message.reply({ embeds: [new EmbedBuilder().setColor('#FFE0E9').setTitle('Anti-Nuke Disabled')] });
    }

    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return message.reply('Administrator only.');
    data.antinuke[message.guild.id] = { enabled: true };
    saveData();
    cacheGuild(message.guild);
    return message.reply({ embeds: [new EmbedBuilder().setColor('#FFE0E9').setTitle('Anti-Nuke Enabled')] });
  }
});

client.login(process.env.TOKEN);
