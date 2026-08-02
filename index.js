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
  StringSelectMenuOptionBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionOverwrites
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
  antinuke: {},
  automod: {},
  tickets: {}
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

const SPECIAL_ROLE = '1531850051771568128';
const VEYNETTA_ID = '1497846804480524298';
const AUTOMOD_WORDS = ['dog', 'zoophile', 'porn', 'nsfw', '18+', 'charlie', 'dainty'];

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
    if (!result?.videos?.length) return { success: false, error: 'No results found.' };
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

// ==================== ANTI-NUKE ====================
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
        reason: 'Petal Anti-Nuke'
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
        reason: 'Petal Anti-Nuke'
      });
    } catch {}
  }
}

// Channel / Role events
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
  if (!data.antinuke[guild.id]?.enabled) return;
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
  if (!data.antinuke[guild.id]?.enabled) return;
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
    description: 'Make the bot send a message or image (Special Role Only)',
    options: [
      { name: 'message', description: 'The text to send', type: ApplicationCommandOptionType.String, required: false },
      { name: 'image', description: 'An image to send', type: ApplicationCommandOptionType.Attachment, required: false }
    ]
  },
  {
    name: 'servercopy',
    description: 'Copy all channels from another server (Special Role Only)'
  },
  {
    name: 'createchannel',
    description: 'Create a new channel of any type'
  },
  {
    name: 'bot',
    description: 'Make the bot execute one of its own commands (Special Role Only)'
  },
  {
    name: 'rules',
    description: 'Send the professional server rules embed (Special Role Only)'
  }
];

client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}`);
  client.user.setPresence({
    status: 'dnd',
    activities: [{ name: 'Petal by Ariana Grande', type: ActivityType.Listening }]
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
  const config = data.welcome[member.guild.id];
  if (!config?.channelId) return;
  const channel = member.guild.channels.cache.get(config.channelId);
  if (!channel) return;
  try { await member.roles.add('1531850889357299892'); } catch {}
  const embed = new EmbedBuilder()
    .setColor('#FFE0E9')
    .setTitle('Welcome')
    .setDescription(`Welcome ${member} to **${member.guild.name}**`)
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .addFields(
      { name: 'User', value: member.user.tag, inline: true },
      { name: 'Account Created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
      { name: 'Members', value: `${member.guild.memberCount}`, inline: true }
    )
    .setFooter({ text: 'Petal' })
    .setTimestamp();
  if (config.banner) embed.setImage(config.banner);
  channel.send({ content: `${member}`, embeds: [embed] }).catch(() => {});
});
client.on(Events.GuildMemberRemove, async (member) => {
  const config = data.leave[member.guild.id];
  if (!config?.channelId) return;
  const channel = member.guild.channels.cache.get(config.channelId);
  if (!channel) return;
  const embed = new EmbedBuilder()
    .setColor('#FFE0E9')
    .setTitle('Member Left')
    .setDescription(`**${member.user.tag}** has left.`)
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .addFields(
      { name: 'User', value: member.user.tag, inline: true },
      { name: 'ID', value: member.user.id, inline: true },
      { name: 'Members', value: `${member.guild.memberCount}`, inline: true }
    )
    .setFooter({ text: 'Petal' })
    .setTimestamp();
  channel.send({ embeds: [embed] }).catch(() => {});
});

// ==================== INTERACTION HANDLER ====================
client.on(Events.InteractionCreate, async (interaction) => {
  // ===== /bot =====
  if (interaction.isChatInputCommand() && interaction.commandName === 'bot') {
    if (!interaction.member.roles.cache.has(SPECIAL_ROLE)) {
      return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }
    const select = new StringSelectMenuBuilder()
      .setCustomId('bot_execute')
      .setPlaceholder('Choose a command for the bot to execute')
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel(',ping').setDescription('Bot replies with Pong').setValue('ping'),
        new StringSelectMenuOptionBuilder().setLabel(',help').setDescription('Bot sends the help menu').setValue('help'),
        new StringSelectMenuOptionBuilder().setLabel(',lock').setDescription('Bot locks the current channel').setValue('lock'),
        new StringSelectMenuOptionBuilder().setLabel(',unlock').setDescription('Bot unlocks the current channel').setValue('unlock'),
        new StringSelectMenuOptionBuilder().setLabel(',antinuke').setDescription('Bot enables anti-nuke').setValue('antinuke_on'),
        new StringSelectMenuOptionBuilder().setLabel(',antinuke off').setDescription('Bot disables anti-nuke').setValue('antinuke_off'),
        new StringSelectMenuOptionBuilder().setLabel(',testwelcome').setDescription('Bot sends a test welcome').setValue('testwelcome'),
        new StringSelectMenuOptionBuilder().setLabel(',queue').setDescription('Bot shows the music queue').setValue('queue'),
        new StringSelectMenuOptionBuilder().setLabel(',np').setDescription('Bot shows now playing').setValue('np'),
        new StringSelectMenuOptionBuilder().setLabel(',stop').setDescription('Bot stops the music').setValue('stop'),
        new StringSelectMenuOptionBuilder().setLabel(',leave').setDescription('Bot leaves the voice channel').setValue('leave')
      );
    const row = new ActionRowBuilder().addComponents(select);
    const embed = new EmbedBuilder()
      .setColor('#FFE0E9')
      .setTitle('Bot Command Executor')
      .setDescription('Select a command below.\n**The bot itself** will execute it.')
      .setFooter({ text: 'Petal • Special Access' })
      .setTimestamp();
    await interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true
    });
    return;
  }

  // ===== Bot Execute =====
  if (interaction.isStringSelectMenu() && interaction.customId === 'bot_execute') {
    if (!interaction.member.roles.cache.has(SPECIAL_ROLE)) {
      return interaction.reply({ content: 'No permission.', ephemeral: true });
    }
    const choice = interaction.values[0];
    await interaction.update({ content: `Bot is executing **${choice}**...`, embeds: [], components: [] });
    const channel = interaction.channel;
    const guild = interaction.guild;
    const prefix = getPrefix(guild.id);
    try {
      if (choice === 'ping') {
        await channel.send('Pong!');
      }
      if (choice === 'help') {
        const embed = new EmbedBuilder()
          .setColor('#FFE0E9')
          .setTitle('Petal Help Menu')
          .addFields(
            { name: 'General', value: `\`${prefix}ping\`\n\`${prefix}prefix\`` },
            { name: 'Moderation', value: `\`${prefix}lock\`\n\`${prefix}unlock\`\n\`${prefix}hardban\`\n\`${prefix}dm\`\n\`${prefix}set automod\`` },
            { name: 'Welcome / Leave', value: `\`${prefix}welcomer\`\n\`${prefix}testwelcome\`\n\`${prefix}leaver\`` },
            { name: 'Anti-Nuke', value: `\`${prefix}antinuke\`\n\`${prefix}antinuke off\`` },
            { name: 'Tickets', value: `\`${prefix}set ticket system\`` },
            { name: 'Music', value: `\`${prefix}play\`\n\`${prefix}skip\`\n\`${prefix}stop\`\n\`${prefix}pause\`\n\`${prefix}resume\`\n\`${prefix}queue\`\n\`${prefix}np\`\n\`${prefix}leave\`` },
            { name: 'Fun', value: `\`${prefix}hug\`\n\`${prefix}slap\`\n\`${prefix}punch\`\n\`${prefix}kick\`` },
            { name: 'Slash Commands', value: '`/send`\n`/servercopy`\n`/createchannel`\n`/bot`\n`/rules`' }
          )
          .setFooter({ text: 'Executed by Petal' });
        await channel.send({ embeds: [embed] });
      }
      if (choice === 'lock') {
        await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false });
        await channel.send({ embeds: [new EmbedBuilder().setColor('#FFE0E9').setTitle('Channel Locked').setDescription('This channel has been locked by **Petal**.')] });
      }
      if (choice === 'unlock') {
        await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: null });
        await channel.send({ embeds: [new EmbedBuilder().setColor('#FFE0E9').setTitle('Channel Unlocked').setDescription('This channel has been unlocked by **Petal**.')] });
      }
      if (choice === 'antinuke_on') {
        data.antinuke[guild.id] = { enabled: true };
        saveData();
        cacheGuild(guild);
        await channel.send({ embeds: [new EmbedBuilder().setColor('#FFE0E9').setTitle('Anti-Nuke Enabled').setDescription('Anti-nuke has been enabled by **Petal**.')] });
      }
      if (choice === 'antinuke_off') {
        data.antinuke[guild.id] = { enabled: false };
        saveData();
        await channel.send({ embeds: [new EmbedBuilder().setColor('#FFE0E9').setTitle('Anti-Nuke Disabled').setDescription('Anti-nuke has been disabled by **Petal**.')] });
      }
      if (choice === 'testwelcome') {
        const config = data.welcome[guild.id];
        const embed = new EmbedBuilder()
          .setColor('#FFE0E9')
          .setTitle('Welcome')
          .setDescription(`Welcome ${interaction.user} to **${guild.name}**`)
          .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
          .setFooter({ text: 'Petal' })
          .setTimestamp();
        if (config?.banner) embed.setImage(config.banner);
        await channel.send({ content: `${interaction.user}`, embeds: [embed] });
      }
      if (choice === 'queue') {
        const queue = getQueue(guild.id);
        if (!queue || !queue.songs.length) {
          await channel.send('The queue is empty.');
        } else {
          const list = queue.songs.slice(0, 10).map((s, i) => `**${i + 1}.** ${s.title}`).join('\n');
          await channel.send({ embeds: [new EmbedBuilder().setColor('#FFE0E9').setTitle('Music Queue').setDescription(list)] });
        }
      }
      if (choice === 'np') {
        const queue = getQueue(guild.id);
        if (!queue || !queue.songs.length) {
          await channel.send('Nothing is playing.');
        } else {
          const song = queue.songs[0];
          await channel.send({
            embeds: [new EmbedBuilder()
              .setColor('#FFE0E9')
              .setAuthor({ name: 'Now Playing' })
              .setTitle(song.title)
              .setURL(song.url)
              .setThumbnail(song.thumbnail)]
          });
        }
      }
      if (choice === 'stop') {
        const queue = getQueue(guild.id);
        if (!queue) {
          await channel.send('Nothing is playing.');
        } else {
          queue.songs = [];
          queue.player.stop();
          queue.connection.destroy();
          queues.delete(guild.id);
          await channel.send('Stopped the music.');
        }
      }
      if (choice === 'leave') {
        const queue = getQueue(guild.id);
        if (!queue) {
          await channel.send('I am not in a voice channel.');
        } else {
          queue.songs = [];
          queue.player.stop();
          queue.connection.destroy();
          queues.delete(guild.id);
          await channel.send('Left the voice channel.');
        }
      }
    } catch (err) {
      await channel.send(`Failed to execute: ${err.message}`);
    }
    return;
  }

  // ===== /rules =====
  if (interaction.isChatInputCommand() && interaction.commandName === 'rules') {
    if (!interaction.member.roles.cache.has(SPECIAL_ROLE)) {
      return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }
    const rulesEmbed = new EmbedBuilder()
      .setColor('#FFE0E9')
      .setTitle('Server Rules')
      .setDescription('Please read and follow all rules carefully. Breaking them may result in warnings, mutes, or bans.')
      .addFields(
        { name: '1. Be Respectful', value: 'Treat everyone with kindness. Harassment, hate speech, discrimination, or toxic behavior will not be tolerated.' },
        { name: '2. No Spam', value: 'Do not spam messages, emojis, mentions, or links. Keep the chat clean and readable.' },
        { name: '3. No NSFW Content', value: 'Keep all content safe for work. NSFW images, videos, or discussions are strictly prohibited.' },
        { name: '4. No Advertising', value: 'Do not promote other servers, products, or services without permission from staff.' },
        { name: '5. Follow Discord Terms', value: 'You must follow Discord’s Terms of Service and Community Guidelines at all times.' },
        { name: '6. Listen to Staff', value: 'Staff decisions are final. If you have an issue, contact them privately and respectfully.' },
        { name: '7. Use Channels Correctly', value: 'Post content in the appropriate channels. Off-topic messages may be removed.' },
        { name: '8. No Impersonation', value: 'Do not impersonate other members, staff, or bots.' }
      )
      .setFooter({ text: 'Petal • Stay respectful and have fun' })
      .setTimestamp();
    await interaction.channel.send({ embeds: [rulesEmbed] });
    await interaction.reply({ content: 'Rules sent.', ephemeral: true });
    return;
  }

  // ===== /send =====
  if (interaction.isChatInputCommand() && interaction.commandName === 'send') {
    if (!interaction.member.roles.cache.has(SPECIAL_ROLE)) {
      return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }
    const text = interaction.options.getString('message');
    const image = interaction.options.getAttachment('image');
    if (!text && !image) {
      return interaction.reply({ content: 'Provide a message or an image.', ephemeral: true });
    }
    await interaction.reply({ content: 'Message sent.', ephemeral: true });
    await interaction.channel.send({
      content: text || undefined,
      files: image ? [image.url] : undefined
    });
    return;
  }

  // ===== /createchannel =====
  if (interaction.isChatInputCommand() && interaction.commandName === 'createchannel') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({ content: 'You need Manage Channels permission.', ephemeral: true });
    }
    const select = new StringSelectMenuBuilder()
      .setCustomId('createchannel_type')
      .setPlaceholder('Choose channel type')
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('Text Channel').setValue('0'),
        new StringSelectMenuOptionBuilder().setLabel('Voice Channel').setValue('2'),
        new StringSelectMenuOptionBuilder().setLabel('Category').setValue('4'),
        new StringSelectMenuOptionBuilder().setLabel('Announcement').setValue('5'),
        new StringSelectMenuOptionBuilder().setLabel('Stage Channel').setValue('13'),
        new StringSelectMenuOptionBuilder().setLabel('Forum Channel').setValue('15')
      );
    await interaction.reply({
      content: 'What type of channel do you want to create?',
      components: [new ActionRowBuilder().addComponents(select)],
      ephemeral: true
    });
    return;
  }
  if (interaction.isStringSelectMenu() && interaction.customId === 'createchannel_type') {
    const type = parseInt(interaction.values[0]);
    const modal = new ModalBuilder()
      .setCustomId(`createchannel_modal_${type}`)
      .setTitle('Create Channel');
    const nameInput = new TextInputBuilder()
      .setCustomId('channel_name')
      .setLabel('Channel Name')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(100);
    modal.addComponents(new ActionRowBuilder().addComponents(nameInput));
    await interaction.showModal(modal);
    return;
  }
  if (interaction.isModalSubmit() && interaction.customId.startsWith('createchannel_modal_')) {
    const type = parseInt(interaction.customId.replace('createchannel_modal_', ''));
    const name = interaction.fields.getTextInputValue('channel_name');
    try {
      const channel = await interaction.guild.channels.create({
        name,
        type,
        reason: `Created by ${interaction.user.tag}`
      });
      await interaction.reply({ content: `Successfully created ${channel}`, ephemeral: true });
    } catch (err) {
      await interaction.reply({ content: `Failed: ${err.message}`, ephemeral: true });
    }
    return;
  }

  // ===== /servercopy =====
  if (interaction.isChatInputCommand() && interaction.commandName === 'servercopy') {
    if (!interaction.member.roles.cache.has(SPECIAL_ROLE)) {
      return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }
    const guilds = [...client.guilds.cache.values()].filter(g => g.id !== interaction.guildId);
    if (guilds.length === 0) {
      return interaction.reply({ content: 'Bot is not in any other servers.', ephemeral: true });
    }
    const options = guilds.slice(0, 25).map(g =>
      new StringSelectMenuOptionBuilder()
        .setLabel(g.name.substring(0, 100))
        .setDescription(`${g.memberCount} members`)
        .setValue(g.id)
    );
    const select = new StringSelectMenuBuilder()
      .setCustomId('servercopy_select')
      .setPlaceholder('Select server to copy FROM')
      .addOptions(options);
    await interaction.reply({
      content: '**WARNING:** This will delete ALL channels in this server.\nChoose the server to copy from:',
      components: [new ActionRowBuilder().addComponents(select)],
      ephemeral: true
    });
    return;
  }
  if (interaction.isStringSelectMenu() && interaction.customId === 'servercopy_select') {
    const sourceGuild = client.guilds.cache.get(interaction.values[0]);
    if (!sourceGuild) return interaction.update({ content: 'Server not found.', components: [] });
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`servercopy_confirm_${sourceGuild.id}`).setLabel('Yes, delete & copy').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('servercopy_cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
    );
    await interaction.update({
      content: `Selected **${sourceGuild.name}**.\nThis will DELETE ALL channels here and copy from that server.\nAre you sure?`,
      components: [row]
    });
    return;
  }
  if (interaction.isButton() && interaction.customId === 'servercopy_cancel') {
    return interaction.update({ content: 'Cancelled.', components: [] });
  }
  if (interaction.isButton() && interaction.customId.startsWith('servercopy_confirm_')) {
    const sourceGuild = client.guilds.cache.get(interaction.customId.replace('servercopy_confirm_', ''));
    const targetGuild = interaction.guild;
    await interaction.update({ content: 'Copying... This may take a while.', components: [] });
    try {
      for (const ch of [...targetGuild.channels.cache.values()]) {
        try { await ch.delete(); } catch {}
      }
      const sourceChannels = [...sourceGuild.channels.cache.values()]
        .filter(c => [0, 2, 4, 5, 13, 15].includes(c.type))
        .sort((a, b) => {
          if (a.type === 4 && b.type !== 4) return -1;
          if (a.type !== 4 && b.type === 4) return 1;
          return a.position - b.position;
        });
      const idMap = new Map();
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
          const newCh = await targetGuild.channels.create(options);
          idMap.set(old.id, newCh);
          for (const ow of old.permissionOverwrites.cache.values()) {
            try {
              await newCh.permissionOverwrites.edit(ow.id, { allow: ow.allow, deny: ow.deny });
            } catch {}
          }
        } catch {}
      }
      await interaction.followUp({ content: `Successfully copied channels from **${sourceGuild.name}**.` });
    } catch (err) {
      await interaction.followUp({ content: `Error: ${err.message}` });
    }
    return;
  }

  // Music buttons
  if (interaction.isButton() && interaction.customId.startsWith('music_')) {
    const queue = getQueue(interaction.guildId);
    if (!queue) return interaction.reply({ content: 'No music playing.', ephemeral: true });
    if (!interaction.member.voice.channel || interaction.member.voice.channelId !== queue.connection.joinConfig.channelId) {
      return interaction.reply({ content: 'Join the voice channel first.', ephemeral: true });
    }
    if (interaction.customId === 'music_pause_resume') {
      if (queue.player.state.status === AudioPlayerStatus.Paused) {
        queue.player.unpause();
        await interaction.update({ components: createMusicButtons(false, queue.loop) });
        await interaction.followUp({ content: `${interaction.user} resumed playback.` });
      } else {
        queue.player.pause();
        await interaction.update({ components: createMusicButtons(true, queue.loop) });
        await interaction.followUp({ content: `${interaction.user} paused playback.` });
      }
    }
    if (interaction.customId === 'music_skip') {
      queue.player.stop();
      await interaction.reply({ content: `${interaction.user} skipped the song.` });
    }
    if (interaction.customId === 'music_loop') {
      queue.loop = !queue.loop;
      await interaction.update({ components: createMusicButtons(queue.player.state.status === AudioPlayerStatus.Paused, queue.loop) });
      await interaction.followUp({ content: `Loop ${queue.loop ? 'enabled' : 'disabled'}.`, ephemeral: true });
    }
    if (interaction.customId === 'music_stop') {
      queue.songs = [];
      queue.player.stop();
      queue.connection.destroy();
      queues.delete(interaction.guildId);
      await interaction.update({ content: 'Session ended.', embeds: [], components: [] });
    }
  }

  // ===== TICKET BUTTONS =====
  if (interaction.isButton() && interaction.customId.startsWith('ticket_open_')) {
    const guildId = interaction.guildId;
    const ticketConfig = data.tickets[guildId];
    if (!ticketConfig) return interaction.reply({ content: 'Ticket system not set up.', ephemeral: true });

    const buttonIndex = parseInt(interaction.customId.replace('ticket_open_', ''));
    const button = ticketConfig.buttons[buttonIndex];
    if (!button) return interaction.reply({ content: 'Invalid button.', ephemeral: true });

    // Check if user already has an open ticket
    const existing = interaction.guild.channels.cache.find(
      c => c.name === `ticket-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}` && c.type === ChannelType.GuildText
    );
    if (existing) {
      return interaction.reply({ content: `You already have an open ticket: ${existing}`, ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const channel = await interaction.guild.channels.create({
        name: `ticket-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 90),
        type: ChannelType.GuildText,
        parent: ticketConfig.categoryId || null,
        permissionOverwrites: [
          {
            id: interaction.guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel]
          },
          {
            id: interaction.user.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles]
          },
          {
            id: client.user.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels]
          }
        ],
        reason: `Ticket opened by ${interaction.user.tag}`
      });

      const ticketEmbed = new EmbedBuilder()
        .setColor('#FFE0E9')
        .setTitle(ticketConfig.title || 'Support Ticket')
        .setDescription(ticketConfig.bio || 'A staff member will assist you shortly.')
        .addFields(
          { name: 'Opened by', value: `${interaction.user}`, inline: true },
          { name: 'Type', value: button.name, inline: true }
        )
        .setFooter({ text: 'Petal Tickets' })
        .setTimestamp();
      if (ticketConfig.banner) ticketEmbed.setImage(ticketConfig.banner);

      const closeRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('ticket_close')
          .setLabel('Close Ticket')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🔒')
      );

      await channel.send({
        content: `${interaction.user}`,
        embeds: [ticketEmbed],
        components: [closeRow]
      });

      await interaction.editReply({ content: `Ticket created: ${channel}` });
    } catch (err) {
      await interaction.editReply({ content: `Failed to create ticket: ${err.message}` });
    }
    return;
  }

  if (interaction.isButton() && interaction.customId === 'ticket_close') {
    if (!interaction.channel.name.startsWith('ticket-')) {
      return interaction.reply({ content: 'This is not a ticket channel.', ephemeral: true });
    }
    await interaction.reply({ content: 'Closing ticket in 5 seconds...' });
    setTimeout(async () => {
      try {
        await interaction.channel.delete('Ticket closed');
      } catch {}
    }, 5000);
    return;
  }
});

// ==================== PREFIX COMMANDS ====================
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.guild) return;

  // ===== VEYNETTA MENTION PROTECTION =====
  if (message.mentions.users.has(VEYNETTA_ID)) {
    return message.reply('Veynetta is busy please wait');
  }

  // ===== AUTOMOD =====
  if (data.automod[message.guild.id]?.enabled) {
    const contentLower = message.content.toLowerCase();
    const hasBannedWord = AUTOMOD_WORDS.some(word => contentLower.includes(word.toLowerCase()));
    if (hasBannedWord) {
      // Allow admins to bypass
      if (!message.member.permissions.has(PermissionFlagsBits.Administrator) &&
          !message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        try {
          await message.delete();
        } catch {}
        return;
      }
    }
  }

  // Invite blocker
  const inviteRegex = /(discord\.(gg|io|me|li)|discordapp\.com\/invite|discord\.com\/invite)\/[a-zA-Z0-9]+/gi;
  if (inviteRegex.test(message.content)) {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator) && !message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      try {
        await message.delete();
        const embed = new EmbedBuilder()
          .setColor('#FFE0E9')
          .setTitle('Invite Links Not Allowed')
          .setDescription(`${message.author}, invites are not permitted.`)
          .setFooter({ text: 'Petal' });
        const msg = await message.channel.send({ embeds: [embed] });
        setTimeout(() => msg.delete().catch(() => {}), 8000);
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
      return message.reply(`Prefix set to \`${newPrefix}\``);
    }
    return message.reply(`Current prefix: \`${prefix}\``);
  }

  if (command === 'help') {
    const embed = new EmbedBuilder()
      .setColor('#FFE0E9')
      .setTitle('Petal Help')
      .addFields(
        { name: 'General', value: `\`${prefix}ping\`\n\`${prefix}prefix\`` },
        { name: 'Moderation', value: `\`${prefix}lock\`\n\`${prefix}unlock\`\n\`${prefix}hardban\`\n\`${prefix}dm\`\n\`${prefix}set automod\`` },
        { name: 'Welcome / Leave', value: `\`${prefix}welcomer\`\n\`${prefix}testwelcome\`\n\`${prefix}leaver\`` },
        { name: 'Anti-Nuke', value: `\`${prefix}antinuke\`\n\`${prefix}antinuke off\`` },
        { name: 'Tickets', value: `\`${prefix}set ticket system\`` },
        { name: 'Music', value: `\`${prefix}play\`\n\`${prefix}skip\`\n\`${prefix}stop\`\n\`${prefix}pause\`\n\`${prefix}resume\`\n\`${prefix}queue\`\n\`${prefix}np\`\n\`${prefix}leave\`` },
        { name: 'Fun', value: `\`${prefix}hug\`\n\`${prefix}slap\`\n\`${prefix}punch\`\n\`${prefix}kick\`` },
        { name: 'Slash Commands', value: '`/send`\n`/servercopy`\n`/createchannel`\n`/bot`\n`/rules`' }
      );
    return message.reply({ embeds: [embed] });
  }

  // ===== SET AUTOMOD =====
  if (command === 'set' && args[0]?.toLowerCase() === 'automod') {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply('Admin only.');
    }
    data.automod[message.guild.id] = { enabled: true };
    saveData();
    const embed = new EmbedBuilder()
      .setColor('#FFE0E9')
      .setTitle('Automod Enabled')
      .setDescription(
        'Messages containing these words will be **immediately deleted**:\n\n' +
        AUTOMOD_WORDS.map(w => `\`${w}\``).join(', ')
      )
      .setFooter({ text: 'Petal Automod' })
      .setTimestamp();
    return message.reply({ embeds: [embed] });
  }

  // ===== SET TICKET SYSTEM =====
  if (command === 'set' && args[0]?.toLowerCase() === 'ticket' && args[1]?.toLowerCase() === 'system') {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply('Admin only.');
    }

    const setupMsg = await message.reply({
      embeds: [new EmbedBuilder()
        .setColor('#FFE0E9')
        .setTitle('Ticket System Setup')
        .setDescription('Please answer the following questions one by one.\n\n**1.** Send the **banner image** URL (or upload an image).\nType `skip` to skip the banner.')]
    });

    const filter = m => m.author.id === message.author.id;

    // 1. Banner
    let banner = null;
    try {
      const bannerCol = await message.channel.awaitMessages({ filter, max: 1, time: 60000 });
      const bannerMsg = bannerCol.first();
      if (bannerMsg) {
        if (bannerMsg.attachments.size > 0) {
          banner = bannerMsg.attachments.first().url;
        } else if (bannerMsg.content.toLowerCase() !== 'skip') {
          banner = bannerMsg.content.trim();
        }
      }
    } catch {
      return message.channel.send('Setup timed out.');
    }

    // 2. Title
    await message.channel.send({
      embeds: [new EmbedBuilder()
        .setColor('#FFE0E9')
        .setTitle('Ticket System Setup')
        .setDescription('**2.** What should the **ticket title** be?\n(Example: `Support Ticket`)')]
    });
    let title = 'Support Ticket';
    try {
      const titleCol = await message.channel.awaitMessages({ filter, max: 1, time: 60000 });
      if (titleCol.first()) title = titleCol.first().content.trim() || 'Support Ticket';
    } catch {
      return message.channel.send('Setup timed out.');
    }

    // 3. Bio
    await message.channel.send({
      embeds: [new EmbedBuilder()
        .setColor('#FFE0E9')
        .setTitle('Ticket System Setup')
        .setDescription('**3.** What should the **ticket bio / description** be?\n(This appears inside every new ticket)')]
    });
    let bio = 'A staff member will assist you shortly. Please describe your issue.';
    try {
      const bioCol = await message.channel.awaitMessages({ filter, max: 1, time: 90000 });
      if (bioCol.first()) bio = bioCol.first().content.trim() || bio;
    } catch {
      return message.channel.send('Setup timed out.');
    }

    // 4. Button name
    await message.channel.send({
      embeds: [new EmbedBuilder()
        .setColor('#FFE0E9')
        .setTitle('Ticket System Setup')
        .setDescription('**4.** What should the **button name** be?\n(Example: `Open Ticket` or `Support`)')]
    });
    let buttonName = 'Open Ticket';
    try {
      const btnCol = await message.channel.awaitMessages({ filter, max: 1, time: 60000 });
      if (btnCol.first()) buttonName = btnCol.first().content.trim() || 'Open Ticket';
    } catch {
      return message.channel.send('Setup timed out.');
    }

    // 5. Button emoji
    await message.channel.send({
      embeds: [new EmbedBuilder()
        .setColor('#FFE0E9')
        .setTitle('Ticket System Setup')
        .setDescription('**5.** What **emoji** should the button use?\n(Example: 🎫 or 📩)\nType `none` for no emoji.')]
    });
    let buttonEmoji = '🎫';
    try {
      const emojiCol = await message.channel.awaitMessages({ filter, max: 1, time: 60000 });
      if (emojiCol.first()) {
        const e = emojiCol.first().content.trim();
        buttonEmoji = e.toLowerCase() === 'none' ? null : e;
      }
    } catch {
      return message.channel.send('Setup timed out.');
    }

    // Optional category
    await message.channel.send({
      embeds: [new EmbedBuilder()
        .setColor('#FFE0E9')
        .setTitle('Ticket System Setup')
        .setDescription('**6.** (Optional) Mention a **category** where tickets should be created.\nType `skip` to put them at the top level.')]
    });
    let categoryId = null;
    try {
      const catCol = await message.channel.awaitMessages({ filter, max: 1, time: 60000 });
      if (catCol.first()) {
        const catMsg = catCol.first();
        if (catMsg.content.toLowerCase() !== 'skip') {
          const cat = catMsg.mentions.channels.first() || message.guild.channels.cache.get(catMsg.content);
          if (cat && cat.type === ChannelType.GuildCategory) {
            categoryId = cat.id;
          }
        }
      }
    } catch {}

    // Save config
    data.tickets[message.guild.id] = {
      title,
      bio,
      banner,
      categoryId,
      buttons: [{ name: buttonName, emoji: buttonEmoji }]
    };
    saveData();

    // Build panel
    const panelEmbed = new EmbedBuilder()
      .setColor('#FFE0E9')
      .setTitle(title)
      .setDescription(bio)
      .setFooter({ text: 'Petal Tickets • Click the button below to open a ticket' })
      .setTimestamp();
    if (banner) panelEmbed.setImage(banner);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('ticket_open_0')
        .setLabel(buttonName)
        .setStyle(ButtonStyle.Primary)
        .setEmoji(buttonEmoji || undefined)
    );

    await message.channel.send({
      embeds: [panelEmbed],
      components: [row]
    });

    return message.channel.send({
      embeds: [new EmbedBuilder()
        .setColor('#FFE0E9')
        .setTitle('Ticket System Ready')
        .setDescription('The ticket panel has been created above. Users can now open tickets by clicking the button.')]
    });
  }

  // Fun
  if (['hug', 'slap', 'punch', 'kick'].includes(command)) {
    const target = message.mentions.users.first();
    if (!target) return message.reply(`Usage: \`${prefix}${command} @user\``);
    const gif = await getAnimeGif(command === 'punch' ? 'slap' : command);
    if (!gif) return message.reply('Failed to get gif.');
    return message.reply({
      embeds: [new EmbedBuilder().setColor('#FFE0E9').setDescription(`**${message.author}** ${command}ed **${target}**!`).setImage(gif)]
    });
  }

  // Music
  if (command === 'play') {
    const query = args.join(' ');
    if (!query) return message.reply(`Usage: \`${prefix}play <song>\``);
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) return message.reply('Join a voice channel.');
    const msg = await message.reply('Searching...');
    const result = await findSong(query);
    if (!result.success) return msg.edit(result.error);
    const song = {
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
        if (queue.loop && queue.songs.length) playSong(message.guild.id);
        else { queue.songs.shift(); playSong(message.guild.id); }
      });
      player.on('error', () => { queue.songs.shift(); playSong(message.guild.id); });
    }
    queue.songs.push(song);
    if (queue.songs.length === 1) {
      await msg.delete().catch(() => {});
      playSong(message.guild.id);
    } else {
      await msg.edit({
        content: null,
        embeds: [new EmbedBuilder().setColor('#FFE0E9').setAuthor({ name: `#${queue.songs.length} Queued` }).setDescription(`**${song.title}**`).setThumbnail(song.thumbnail)]
      });
    }
  }
  if (command === 'stop') {
    const queue = getQueue(message.guild.id);
    if (!queue) return message.reply('Nothing playing.');
    queue.songs = [];
    queue.player.stop();
    queue.connection.destroy();
    queues.delete(message.guild.id);
    return message.reply('Stopped.');
  }
  if (command === 'skip') {
    const queue = getQueue(message.guild.id);
    if (!queue) return message.reply('Nothing playing.');
    queue.player.stop();
    return message.reply('Skipped.');
  }
  if (command === 'pause') {
    const queue = getQueue(message.guild.id);
    if (!queue) return message.reply('Nothing playing.');
    queue.player.pause();
    return message.reply('Paused.');
  }
  if (command === 'resume') {
    const queue = getQueue(message.guild.id);
    if (!queue) return message.reply('Nothing playing.');
    queue.player.unpause();
    return message.reply('Resumed.');
  }
  if (command === 'queue') {
    const queue = getQueue(message.guild.id);
    if (!queue?.songs.length) return message.reply('Queue empty.');
    const list = queue.songs.slice(0, 10).map((s, i) => `**${i+1}.** ${s.title}`).join('\n');
    return message.reply({ embeds: [new EmbedBuilder().setColor('#FFE0E9').setTitle('Queue').setDescription(list)] });
  }
  if (command === 'np' || command === 'nowplaying') {
    const queue = getQueue(message.guild.id);
    if (!queue?.songs.length) return message.reply('Nothing playing.');
    const song = queue.songs[0];
    return message.reply({
      embeds: [new EmbedBuilder().setColor('#FFE0E9').setAuthor({ name: 'Now Playing' }).setTitle(song.title).setURL(song.url).setThumbnail(song.thumbnail)]
    });
  }
  if (command === 'leave') {
    const queue = getQueue(message.guild.id);
    if (!queue) return message.reply('Not in voice.');
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
    return message.reply({ embeds: [new EmbedBuilder().setColor('#FFE0E9').setTitle('Locked')] });
  }
  if (command === 'unlock') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) return message.reply('Missing permission.');
    await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null });
    return message.reply({ embeds: [new EmbedBuilder().setColor('#FFE0E9').setTitle('Unlocked')] });
  }

  // welcomer
  if (command === 'welcomer') {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return message.reply('Admin only.');
    const channel = message.mentions.channels.first();
    if (!channel) return message.reply(`Usage: \`${prefix}welcomer #channel\``);
    await message.reply('Upload banner within 60s.');
    const collected = await message.channel.awaitMessages({
      filter: m => m.author.id === message.author.id && m.attachments.size > 0,
      max: 1, time: 60000
    }).catch(() => null);
    if (!collected) return message.channel.send('Timed out.');
    data.welcome[message.guild.id] = { channelId: channel.id, banner: collected.first().attachments.first().url };
    saveData();
    return message.channel.send({ embeds: [new EmbedBuilder().setColor('#FFE0E9').setTitle('Welcome Ready').setImage(data.welcome[message.guild.id].banner)] });
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
      return message.reply('Could not DM user.');
    }
  }
  if (command === 'hardban') {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return message.reply('Admin only.');
    const target = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
    if (!target) return message.reply(`Usage: \`${prefix}hardban @user\``);
    if (!target.bannable) return message.reply('Cannot ban.');
    await target.ban({ deleteMessageSeconds: 604800, reason: `Hardbanned by ${message.author.tag}` });
    return message.reply({ embeds: [new EmbedBuilder().setColor('#FFE0E9').setTitle('Hardbanned')] });
  }
  if (command === 'antinuke') {
    if (args[0] === 'off') {
      if (!message.member.roles.cache.has(ANTINUKE_OFF_ROLE)) return message.reply('Cannot disable.');
      data.antinuke[message.guild.id] = { enabled: false };
      saveData();
      return message.reply({ embeds: [new EmbedBuilder().setColor('#FFE0E9').setTitle('Anti-Nuke Off')] });
    }
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return message.reply('Admin only.');
    data.antinuke[message.guild.id] = { enabled: true };
    saveData();
    cacheGuild(message.guild);
    return message.reply({ embeds: [new EmbedBuilder().setColor('#FFE0E9').setTitle('Anti-Nuke On')] });
  }
});

client.login(process.env.TOKEN);
