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
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState
} = require('@discordjs/voice');
const play = require('play-dl');
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
    const stream = await play.stream(song.url);
    const resource = createAudioResource(stream.stream, {
      inputType: stream.type
    });

    queue.player.play(resource);

    const embed = new EmbedBuilder()
      .setColor('#FFE0E9')
      .setTitle('Now Playing')
      .setDescription(`[${song.title}](${song.url})`)
      .addFields(
        { name: 'Duration', value: song.duration || 'Unknown', inline: true },
        { name: 'Requested by', value: `${song.requestedBy}`, inline: true }
      )
      .setThumbnail(song.thumbnail || null)
      .setFooter({ text: 'Petal Music' })
      .setTimestamp();

    queue.textChannel.send({ embeds: [embed] }).catch(() => {});
  } catch (err) {
    console.error('Error playing song:', err);
    queue.songs.shift();
    playSong(guildId);
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
    } catch (err) {
      console.error('Failed to restore channel:', old.name, err.message);
    }
  }
}

async function restoreRoles(guild, deletedRoles) {
  const sorted = [...deletedRoles].sort((a, b) => b.position - a.position);

  for (const old of sorted) {
    try {
      const newRole = await guild.roles.create({
        name: old.name,
        color: old.color,
        hoist: old.hoist,
        permissions: BigInt(old.permissions),
        mentionable: old.mentionable,
        position: old.position,
        reason: 'Petal Anti-Nuke – Role restored'
      });

      if (old.icon || old.unicodeEmoji) {
        try {
          await newRole.setIcon(old.icon || null);
          if (old.unicodeEmoji) await newRole.setUnicodeEmoji(old.unicodeEmoji);
        } catch {}
      }
    } catch (err) {
      console.error('Failed to restore role:', old.name, err.message);
    }
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
    const logs = await guild.fetchAuditLogs({
      type: AuditLogEvent.ChannelDelete,
      limit: 6
    });
    const entry = logs.entries.find(e =>
      e.target?.id === channel.id && Date.now() - e.createdTimestamp < 15000
    );
    if (entry) executor = entry.executor;
  } catch {
    return;
  }

  if (!executor || executor.id === client.user.id || executor.id === guild.ownerId) return;

  const map = channelCache.get(guild.id);
  const cached = map?.get(channel.id);
  if (!cached) return;
  map.delete(channel.id);

  if (!recentChannelDeletes.has(guild.id)) recentChannelDeletes.set(guild.id, []);
  const list = recentChannelDeletes.get(guild.id);

  list.push({
    data: cached,
    executorId: executor.id,
    timestamp: Date.now()
  });

  const now = Date.now();
  const filtered = list.filter(e => now - e.timestamp < ANTINUKE_WINDOW);
  recentChannelDeletes.set(guild.id, filtered);

  const byUser = filtered.filter(e => e.executorId === executor.id);

  if (byUser.length >= ANTINUKE_THRESHOLD) {
    console.log(`[Anti-Nuke] Mass channel delete by ${executor.tag} in ${guild.name}`);

    try {
      await guild.members.ban(executor.id, {
        reason: 'Petal Anti-Nuke – Mass channel deletion',
        deleteMessageSeconds: 0
      });
    } catch (err) {
      console.error('Ban failed:', err.message);
    }

    try {
      const user = await client.users.fetch(executor.id);
      await user.send('kicked by petal');
    } catch {}

    await restoreChannels(guild, byUser.map(e => e.data));

    recentChannelDeletes.set(
      guild.id,
      filtered.filter(e => e.executorId !== executor.id)
    );
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
    const logs = await guild.fetchAuditLogs({
      type: AuditLogEvent.RoleDelete,
      limit: 6
    });
    const entry = logs.entries.find(e =>
      e.target?.id === role.id && Date.now() - e.createdTimestamp < 15000
    );
    if (entry) executor = entry.executor;
  } catch {
    return;
  }

  if (!executor || executor.id === client.user.id || executor.id === guild.ownerId) return;

  const map = roleCache.get(guild.id);
  const cached = map?.get(role.id);
  if (!cached) return;
  map.delete(role.id);

  if (!recentRoleDeletes.has(guild.id)) recentRoleDeletes.set(guild.id, []);
  const list = recentRoleDeletes.get(guild.id);

  list.push({
    data: cached,
    executorId: executor.id,
    timestamp: Date.now()
  });

  const now = Date.now();
  const filtered = list.filter(e => now - e.timestamp < ANTINUKE_WINDOW);
  recentRoleDeletes.set(guild.id, filtered);

  const byUser = filtered.filter(e => e.executorId === executor.id);

  if (byUser.length >= ANTINUKE_THRESHOLD) {
    console.log(`[Anti-Nuke] Mass role delete by ${executor.tag} in ${guild.name}`);

    try {
      await guild.members.ban(executor.id, {
        reason: 'Petal Anti-Nuke – Mass role deletion',
        deleteMessageSeconds: 0
      });
    } catch (err) {
      console.error('Ban failed:', err.message);
    }

    try {
      const user = await client.users.fetch(executor.id);
      await user.send('kicked by petal');
    } catch {}

    await restoreRoles(guild, byUser.map(e => e.data));

    recentRoleDeletes.set(
      guild.id,
      filtered.filter(e => e.executorId !== executor.id)
    );
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

// Prefix commands + Invite Blocker
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.guild) return;

  // ==================== INVITE LINK BLOCKER ====================
  const inviteRegex = /(https?:\/\/)?(www\.)?(discord\.(gg|io|me|li)|discordapp\.com\/invite|discord\.com\/invite)\/[a-zA-Z0-9]+/gi;

  if (inviteRegex.test(message.content)) {
    if (
      message.member.permissions.has(PermissionFlagsBits.Administrator) ||
      message.member.permissions.has(PermissionFlagsBits.ManageMessages)
    ) {
      // allowed
    } else {
      try {
        await message.delete();

        const embed = new EmbedBuilder()
          .setColor('#FFE0E9')
          .setTitle('Invite Links Are Not Allowed')
          .setDescription(
            `${message.author}, posting Discord invite links is **not permitted** in this server.\n\n` +
            `Please refrain from sharing invites. Repeated offenses may result in further action.`
          )
          .setFooter({ text: 'Petal • Server Protection' })
          .setTimestamp();

        const warning = await message.channel.send({ embeds: [embed] });
        
        setTimeout(() => {
          warning.delete().catch(() => {});
        }, 8000);
      } catch (err) {
        console.error('Failed to delete invite message:', err.message);
      }
      return;
    }
  }

  // ==================== PREFIX COMMANDS ====================
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

  // ==================== HELP COMMAND (UPDATED) ====================
  if (command === 'help') {
    const helpEmbed = new EmbedBuilder()
      .setColor('#FFE0E9')
      .setTitle('Petal Help Menu')
      .setDescription('Here is the full list of available commands:')
      .addFields(
        {
          name: 'General Commands',
          value: 
            `\`${prefix}ping\` – Check if the bot is online\n` +
            `\`${prefix}prefix\` – Show the current prefix\n` +
            `\`${prefix}prefix set <prefix>\` – Change the bot prefix`
        },
        {
          name: 'Moderation',
          value:
            `\`${prefix}lock\` – Lock the current channel\n` +
            `\`${prefix}unlock\` – Unlock the current channel\n` +
            `\`${prefix}hardban @user [reason]\` – Ban a user + delete all their messages (Admin only)\n` +
            `\`${prefix}dm @user <message>\` – Send a DM to a user (Admin only)`
        },
        {
          name: 'Welcome & Leave System',
          value:
            `\`${prefix}welcomer #channel\` – Set the welcome channel + banner\n` +
            `\`${prefix}testwelcome\` – Test the welcome message\n` +
            `\`${prefix}leaver #channel\` – Set the leave channel`
        },
        {
          name: 'Anti-Nuke',
          value:
            `\`${prefix}antinuke\` – Enable anti-nuke protection\n` +
            `\`${prefix}antinuke off\` – Disable anti-nuke (special role only)`
        },
        {
          name: 'Music Commands',
          value:
            `\`${prefix}play <song/url>\` – Play a song from YouTube\n` +
            `\`${prefix}skip\` – Skip the current song\n` +
            `\`${prefix}stop\` – Stop everything and clear the queue\n` +
            `\`${prefix}pause\` – Pause the current song\n` +
            `\`${prefix}resume\` – Resume the paused song\n` +
            `\`${prefix}queue\` – Show the current music queue\n` +
            `\`${prefix}np\` – Show what is currently playing\n` +
            `\`${prefix}leave\` – Make the bot leave the voice channel`
        },
        {
          name: 'Slash Commands',
          value: `\`/send\` – Make the bot send a message or image`
        }
      )
      .setFooter({ text: `Requested by ${message.author.tag} • Prefix: ${prefix}` })
      .setTimestamp();

    return message.reply({ embeds: [helpEmbed] });
  }

  // ==================== MUSIC COMMANDS ====================

  // play
  if (command === 'play') {
    const query = args.join(' ');
    if (!query) {
      return message.reply(`Usage: \`${prefix}play <song name or YouTube URL>\``);
    }

    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) {
      return message.reply('You need to be in a voice channel to play music.');
    }

    if (!voiceChannel.joinable || !voiceChannel.speakable) {
      return message.reply('I cannot join or speak in that voice channel.');
    }

    let songInfo;
    try {
      if (play.yt_validate(query) === 'video') {
        const info = await play.video_info(query);
        songInfo = {
          title: info.video_details.title,
          url: info.video_details.url,
          duration: info.video_details.durationRaw,
          thumbnail: info.video_details.thumbnails[0]?.url,
          requestedBy: message.author
        };
      } else {
        const results = await play.search(query, { limit: 1 });
        if (!results || results.length === 0) {
          return message.reply('No results found.');
        }
        const video = results[0];
        songInfo = {
          title: video.title,
          url: video.url,
          duration: video.durationRaw,
          thumbnail: video.thumbnails[0]?.url,
          requestedBy: message.author
        };
      }
    } catch (err) {
      console.error(err);
      return message.reply('Failed to find that song.');
    }

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
        textChannel: message.channel
      };

      queues.set(message.guild.id, queue);

      player.on(AudioPlayerStatus.Idle, () => {
        queue.songs.shift();
        playSong(message.guild.id);
      });

      player.on('error', (error) => {
        console.error('Player error:', error);
        queue.songs.shift();
        playSong(message.guild.id);
      });

      connection.on(VoiceConnectionStatus.Disconnected, async () => {
        try {
          await Promise.race([
            entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
            entersState(connection, VoiceConnectionStatus.Connecting, 5_000)
          ]);
        } catch {
          connection.destroy();
          queues.delete(message.guild.id);
        }
      });
    }

    queue.songs.push(songInfo);

    if (queue.songs.length === 1) {
      playSong(message.guild.id);
    } else {
      const embed = new EmbedBuilder()
        .setColor('#FFE0E9')
        .setTitle('Added to Queue')
        .setDescription(`[${songInfo.title}](${songInfo.url})`)
        .addFields(
          { name: 'Position', value: `${queue.songs.length}`, inline: true },
          { name: 'Requested by', value: `${message.author}`, inline: true }
        )
        .setThumbnail(songInfo.thumbnail || null)
        .setFooter({ text: 'Petal Music' })
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }
  }

  // stop
  if (command === 'stop') {
    const queue = getQueue(message.guild.id);
    if (!queue) return message.reply('Nothing is playing.');

    queue.songs = [];
    queue.player.stop();
    queue.connection.destroy();
    queues.delete(message.guild.id);

    return message.reply('Stopped the music and cleared the queue.');
  }

  // skip
  if (command === 'skip') {
    const queue = getQueue(message.guild.id);
    if (!queue || queue.songs.length === 0) {
      return message.reply('Nothing is playing.');
    }

    queue.player.stop();
    return message.reply('Skipped the current song.');
  }

  // pause
  if (command === 'pause') {
    const queue = getQueue(message.guild.id);
    if (!queue) return message.reply('Nothing is playing.');

    queue.player.pause();
    return message.reply('Paused the music.');
  }

  // resume
  if (command === 'resume') {
    const queue = getQueue(message.guild.id);
    if (!queue) return message.reply('Nothing is playing.');

    queue.player.unpause();
    return message.reply('Resumed the music.');
  }

  // queue
  if (command === 'queue') {
    const queue = getQueue(message.guild.id);
    if (!queue || queue.songs.length === 0) {
      return message.reply('The queue is empty.');
    }

    const list = queue.songs
      .slice(0, 10)
      .map((s, i) => `**${i + 1}.** [${s.title}](${s.url})`)
      .join('\n');

    const embed = new EmbedBuilder()
      .setColor('#FFE0E9')
      .setTitle('Music Queue')
      .setDescription(list)
      .setFooter({ text: `Total songs: ${queue.songs.length}` })
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }

  // now playing
  if (command === 'np' || command === 'nowplaying') {
    const queue = getQueue(message.guild.id);
    if (!queue || queue.songs.length === 0) {
      return message.reply('Nothing is playing right now.');
    }

    const song = queue.songs[0];

    const embed = new EmbedBuilder()
      .setColor('#FFE0E9')
      .setTitle('Now Playing')
      .setDescription(`[${song.title}](${song.url})`)
      .addFields(
        { name: 'Duration', value: song.duration || 'Unknown', inline: true },
        { name: 'Requested by', value: `${song.requestedBy}`, inline: true }
      )
      .setThumbnail(song.thumbnail || null)
      .setFooter({ text: 'Petal Music' })
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }

  // leave
  if (command === 'leave') {
    const queue = getQueue(message.guild.id);
    if (!queue) return message.reply('I am not in a voice channel.');

    queue.songs = [];
    queue.player.stop();
    queue.connection.destroy();
    queues.delete(message.guild.id);

    return message.reply('Left the voice channel.');
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
    } catch {
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
    } catch {
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

  // leaver
  if (command === 'leaver') {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply('You need Administrator permission to use this command.');
    }

    const channel = message.mentions.channels.first();
    if (!channel) {
      return message.reply(`Usage: \`${prefix}leaver #channel\``);
    }

    data.leave[message.guild.id] = {
      channelId: channel.id
    };
    saveData();

    const successEmbed = new EmbedBuilder()
      .setColor('#FFE0E9')
      .setTitle('Leave Channel Set')
      .setDescription(`Leave messages will now be sent in ${channel}.`)
      .setFooter({ text: 'Petal' })
      .setTimestamp();

    return message.reply({ embeds: [successEmbed] });
  }

  // dm
  if (command === 'dm') {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply('You need **Administrator** permission to use this command.');
    }

    const target =
      message.mentions.users.first() ||
      (args[0] ? await client.users.fetch(args[0]).catch(() => null) : null);

    if (!target) {
      return message.reply(`Usage: \`${prefix}dm @user your message here\`\nOr: \`${prefix}dm UserID your message here\``);
    }

    const dmMessage = args.slice(message.mentions.users.first() ? 1 : 1).join(' ');

    if (!dmMessage) {
      return message.reply('Please provide a message to send.');
    }

    try {
      await target.send(dmMessage);

      const embed = new EmbedBuilder()
        .setColor('#FFE0E9')
        .setTitle('Direct Message Sent')
        .setDescription(`Successfully sent a DM to **${target.tag}**.`)
        .addFields(
          { name: 'User', value: `${target.tag} (${target.id})`, inline: true },
          { name: 'Sent by', value: `${message.author.tag}`, inline: true },
          { name: 'Message', value: dmMessage.length > 1024 ? dmMessage.slice(0, 1021) + '...' : dmMessage }
        )
        .setFooter({ text: 'Petal' })
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    } catch (err) {
      return message.reply(`Failed to DM **${target.tag}**. They may have DMs disabled.`);
    }
  }

  // hardban
  if (command === 'hardban') {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply('You need **Administrator** permission to use this command.');
    }

    const target = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
    if (!target) {
      return message.reply(`Usage: \`${prefix}hardban @user [reason]\``);
    }

    if (target.id === message.author.id) {
      return message.reply('You cannot hardban yourself.');
    }

    if (target.id === client.user.id) {
      return message.reply('You cannot hardban me.');
    }

    if (target.id === message.guild.ownerId) {
      return message.reply('You cannot hardban the server owner.');
    }

    if (
      message.member.roles.highest.position <= target.roles.highest.position &&
      message.guild.ownerId !== message.author.id
    ) {
      return message.reply('You cannot hardban someone with an equal or higher role than you.');
    }

    if (!target.bannable) {
      return message.reply('I cannot ban this user (check my role hierarchy).');
    }

    const reason = args.slice(1).join(' ') || 'No reason provided';

    try {
      await target.ban({
        deleteMessageSeconds: 60 * 60 * 24 * 7,
        reason: `Hardbanned by ${message.author.tag} | ${reason}`
      });

      const embed = new EmbedBuilder()
        .setColor('#FFE0E9')
        .setTitle('User Hardbanned')
        .setDescription(`**${target.user.tag}** has been hardbanned.`)
        .addFields(
          { name: 'User', value: `${target.user.tag} (${target.id})`, inline: true },
          { name: 'Moderator', value: `${message.author.tag}`, inline: true },
          { name: 'Reason', value: reason, inline: false },
          { name: 'Messages Deleted', value: 'All messages from the last 7 days', inline: false }
        )
        .setFooter({ text: 'Petal' })
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    } catch (err) {
      console.error('Hardban failed:', err);
      return message.reply('Failed to hardban the user.');
    }
  }

  // antinuke
  if (command === 'antinuke') {
    const sub = args[0]?.toLowerCase();

    if (sub === 'off') {
      if (!message.member.roles.cache.has(ANTINUKE_OFF_ROLE)) {
        return message.reply('Only members with the special role can turn anti-nuke off.');
      }

      data.antinuke[message.guild.id] = { enabled: false };
      saveData();

      const embed = new EmbedBuilder()
        .setColor('#FFE0E9')
        .setTitle('Anti-Nuke Disabled')
        .setDescription('Anti-nuke protection has been turned off.')
        .setFooter({ text: 'Petal' })
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    }

    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply('You need Administrator permission to enable anti-nuke.');
    }

    data.antinuke[message.guild.id] = { enabled: true };
    saveData();
    cacheGuild(message.guild);

    const embed = new EmbedBuilder()
      .setColor('#FFE0E9')
      .setTitle('Anti-Nuke Enabled')
      .setDescription(
        'Petal is now protecting this server.\n\n' +
        '**Protected against:**\n' +
        '• Mass channel deletion\n' +
        '• Mass role deletion\n\n' +
        'If anyone deletes **3 or more** channels/roles within **10 seconds**, they will be banned, the items will be restored, and they will receive the message: `kicked by petal`\n\n' +
        'Only members with the special role can disable it.'
      )
      .setFooter({ text: 'Petal' })
      .setTimestamp();
    return message.reply({ embeds: [embed] });
  }
});

client.login(process.env.TOKEN);
