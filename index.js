/**
 * ============================================================================
 *  index.js — Baddies Discord Bot
 *  Express data bridge + advanced moderation suite (rich embeds & buttons)
 * ============================================================================
 */

console.log('>>> BOOT <<<');
console.log('TOKEN present:', !!TOKEN, '| WEBHOOK_URL present:', !!WEBHOOK_URL);

const {
  Client, GatewayIntentBits, EmbedBuilder, Events,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  PermissionFlagsBits, SlashCommandBuilder, AttachmentBuilder,
  REST, Routes,
} = require('discord.js');
const express = require('express');
const http = require('http');
const https = require('https');

const PREFIXES = ['!', ','];
const TOKEN = (process.env.TOKEN || process.env.DISCORD_BOT_TOKEN || '').trim();
const SECRET = process.env.ROBLOX_SECRET;
const WEBHOOK_URL =
  process.env.WEBHOOK_URL ||
  'https://discord.com/api/webhooks/1560320788098318446/HS3o5f9i31dcORhsK0CqCcgZruhLq1auPmttXE1E3_HMzYjSzpv5hlv8RGA4PcUQI27E';
const BANNER_URL = 'https://static.wikia.nocookie.net/marvel-rivals/images/4/44/Phoenix_Force_Rivals.png/revision/latest?cb=20250705000055';
const GIF_URL = 'https://i.pinimg.com/originals/7d/6e/8a/7d6e8ae0eb5450aaa3863a4e7cf469fb.gif';

const MOD_LOG_CHANNEL_ID = (process.env.MOD_LOG_CHANNEL_ID || '').trim();
const LEASH_ROLE_ID = (process.env.LEASH_ROLE_ID || '').trim();
const LEASH_ROLE_NAME = process.env.LEASH_ROLE_NAME || '🔒 Leashed';
const DISCORD_CLIENT_ID = (process.env.DISCORD_CLIENT_ID || '').trim();
const DISCORD_GUILD_ID = (process.env.DISCORD_GUILD_ID || '').trim();

const ORANGE = 0xff7a00, RED = 0xe74c3c, GREEN = 0x2ecc71, BLUE = 0x3498db;
const PURPLE = 0x9b59b6, GREY = 0x95a5a6, YELLOW = 0xf1c40f;

const cache = new Map();
const warnings = new Map();
const leashed = new Map();
const cooldowns = new Map();
let caseCounter = 1000;
const startedAt = Date.now();

function httpRequest(url, options = {}) {
  const { method = 'GET', headers = {}, body = null, timeout = 20000 } = options;
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('http://') ? http : https;
    const req = lib.request(url, { method, headers, timeout }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on('timeout', () => req.destroy(new Error('Request timed out')));
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}
async function httpJson(url, options = {}) {
  const res = await httpRequest(url, { ...options, headers: { 'User-Agent': 'BaddiesDiscordBot/2.0 (discord bot)', 'Content-Type': 'application/json', ...(options.headers || {}) } });
  try { return { status: res.status, json: JSON.parse(res.body.toString('utf8')) }; }
  catch (e) { return { status: res.status, json: null, raw: res.body.toString('utf8') }; }
}

const app = express();
app.use(express.json({ limit: '2mb' }));
app.get('/', (req, res) => res.send('Bot online!'));
app.get('/health', (req, res) => res.send('ok'));
const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, '0.0.0.0', () => console.log('WEB ON ' + PORT));

app.post('/roblox-data', (req, res) => {
  if (req.headers['x-roblox-secret'] !== SECRET) return res.status(401).send('bad');
  const { userId, username, avatar, data, backup, weapons } = req.body || {};
  if (!userId || !data) return res.status(400).send('missing');
  cache.set(String(userId), { username, avatar, data, backup, weapons: weapons || [], updatedAt: Date.now() });
  res.send('ok');
});

app.post('/rap-handler', async (req, res) => {
  const { weapon, rap, timestamp } = req.body || {};
  const content = `🪙 **${weapon}** RAP: **${rap}** (at <t:${timestamp}:R>)`;
  try {
    if (TOKEN && process.env.DISCORD_CHANNEL_ID) {
      const r = await httpJson(`https://discord.com/api/v10/channels/${process.env.DISCORD_CHANNEL_ID}/messages`, { method: 'POST', headers: { Authorization: `Bot ${TOKEN}` }, body: JSON.stringify({ content }) });
      if (r.status >= 200 && r.status < 300) console.log('✅ Sent RAP to Discord (bot).'); else console.error('❌ Discord bot error:', r.json || r.raw);
    } else if (WEBHOOK_URL) {
      const r = await httpJson(WEBHOOK_URL, { method: 'POST', body: JSON.stringify({ content }) });
      if (r.status >= 200 && r.status < 300) console.log('✅ Sent RAP to Discord (webhook).'); else console.error('❌ Discord webhook error:', r.json || r.raw);
    } else console.warn('⚠️ No Discord credentials configured – payload not sent.');
  } catch (err) { console.error('❌ RAP handler error:', err.message); }
  res.json({ ok: true, receivedAt: new Date().toISOString() });
});

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

client.on('error', (e) => console.error('❌ CLIENT ERROR:', e && e.message ? e.message : e));
client.on('warn', (m) => console.warn('⚠️ CLIENT WARN:', m));
process.on('unhandledRejection', (e) => console.error('❌ UNHANDLED REJECTION:', e && e.message ? e.message : e));
process.on('uncaughtException', (e) => console.error('❌ UNCAUGHT EXCEPTION:', e && e.message ? e.message : e));

client.once(Events.ClientReady, () => {
  console.log('========================================');
  console.log(`✅ LOGGED IN AS: ${client.user.username} (${client.user.tag})`);
  console.log(`🆔 Bot ID: ${client.user.id}`);
  console.log(`📡 Connected to ${client.guilds.cache.size} guild(s) • ${client.users.cache.size} user(s) cached`);
  console.log('========================================');
});

function fmtUptime(ms = Date.now() - startedAt) {
  const s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const out = []; if (d) out.push(`${d}d`); if (h) out.push(`${h}h`); if (m) out.push(`${m}m`); out.push(`${sec}s`); return out.join(' ');
}
function fmtDuration(minutes) {
  if (minutes >= 1440) return `${(minutes / 1440).toFixed(minutes % 1440 === 0 ? 0 : 1)} day(s)`;
  if (minutes >= 60) return `${(minutes / 60).toFixed(minutes % 60 === 0 ? 0 : 1)} hour(s)`;
  return `${minutes} minute(s)`;
}
function stamp(d = new Date()) { return `<t:${Math.floor(d.getTime() / 1000)}:F>`; }
function relStamp(d = new Date()) { return `<t:${Math.floor(d.getTime() / 1000)}:R>`; }
function parseCommand(content) { const m = content.match(/^([!,])\s*([^\s]+)\s*([\s\S]*)$/); if (!m) return null; return { prefix: m[1], name: m[2].toLowerCase(), rest: m[3].trim() }; }
function levenshtein(a, b) {
  const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i; for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) dp[i][j] = Math.min(dp[i-1][j]+1, dp[i][j-1]+1, dp[i-1][j-1] + (a[i-1] === b[j-1] ? 0 : 1));
  return dp[m][n];
}

function baseEmbed(color = ORANGE) { return new EmbedBuilder().setColor(color).setTimestamp(); }
function errorEmbed(text) { return baseEmbed(RED).setDescription(`❌ ${text}`); }
function successEmbed(text) { return baseEmbed(GREEN).setDescription(`✅ ${text}`); }
function avatarURL(user) { try { return user.displayAvatarURL({ size: 256, extension: 'png' }); } catch { return GIF_URL; } }
async function reply(msg, payload) { try { return await msg.reply(payload); } catch {} }
async function replyError(msg, text) { return reply(msg, { embeds: [errorEmbed(text)] }); }

function modCheck(msg, permission) {
  if (!msg.guild) return 'This command only works inside a server.';
  if (!msg.member || !msg.member.permissions) return 'I cannot read your permissions.';
  const userPerms = msg.member.permissions;
  if (!userPerms.has(PermissionFlagsBits.Administrator) && !userPerms.has(permission)) return `You need the **${permissionName(permission)}** permission to use this.`;
  const me = msg.guild.members.me;
  if (!me) return 'I could not find myself in this server.';
  if (!me.permissions.has(permission) && !me.permissions.has(PermissionFlagsBits.Administrator)) return `I am missing the **${permissionName(permission)}** permission.`;
  return null;
}
function permissionName(perm) {
  const map = { [PermissionFlagsBits.BanMembers]: 'Ban Members', [PermissionFlagsBits.KickMembers]: 'Kick Members', [PermissionFlagsBits.ManageMessages]: 'Manage Messages', [PermissionFlagsBits.ModerateMembers]: 'Timeout Members', [PermissionFlagsBits.ManageRoles]: 'Manage Roles', [PermissionFlagsBits.Administrator]: 'Administrator' };
  return map[perm] || 'required';
}
function hierarchyError(msg, targetMember) {
  if (!targetMember) return null;
  const me = msg.guild.members.me;
  if (targetMember.id === me.id) return 'I cannot moderate myself.';
  if (targetMember.id === msg.author.id) return 'You cannot moderate yourself.';
  if (targetMember.id === msg.guild.ownerId) return 'You cannot moderate the server owner.';
  if (me.roles.highest.comparePositionTo(targetMember.roles.highest) <= 0) return 'That member sits at or above my highest role.';
  if (msg.member.roles.highest && msg.member.roles.highest.comparePositionTo(targetMember.roles.highest) <= 0) return 'That member sits at or above your highest role.';
  return null;
}
async function resolveUser(msg, token) {
  const mention = token.match(/<@!?(\d+)>/);
  if (mention) {
    const found = msg.mentions.users.get(mention[1]);
    if (found) return { user: found, member: msg.mentions.members.get(mention[1]) || null };
    try { const user = await client.users.fetch(mention[1]); return { user, member: null }; } catch { return { error: 'That user could not be found.' }; }
  }
  if (/^\d{5,25}$/.test(token)) {
    try { const user = await client.users.fetch(token); return { user, member: msg.guild.members.cache.get(token) || null }; }
    catch { return { error: 'That user could not be found (wrong ID or they left the server).' }; }
  }
  const lowered = token.toLowerCase();
  const member = msg.guild.members.cache.find((m) => m.user.username.toLowerCase() === lowered || m.displayName.toLowerCase() === lowered);
  if (member) return { user: member.user, member };
  const user = client.users.cache.find((u) => u.username.toLowerCase() === lowered);
  if (user) return { user, member: null };
  return { error: `No user found named **${token}**.` };
}
function splitTarget(text) { const parts = text.split(/\s+/); const token = parts.shift() || ''; return { token, reason: parts.join(' ').trim() }; }

async function sendModLog(embed, originChannelId) {
  const target = MOD_LOG_CHANNEL_ID || originChannelId;
  if (target) { try { const ch = await client.channels.fetch(target); if (ch && ch.isTextBased()) { await ch.send({ embeds: [embed] }); return; } } catch (e) { console.error('mod log channel failed:', e.message); } }
  if (WEBHOOK_URL) { try { const r = await httpJson(WEBHOOK_URL, { method: 'POST', body: JSON.stringify({ embeds: [embed.toJSON()] }) }); if (r.status >= 200 && r.status < 300) return; } catch (e) { console.error('mod log webhook failed:', e.message); } }
  console.error('mod log could not be delivered');
}
async function dmUser(user, embed) { try { await user.send({ embeds: [embed] }); return true; } catch { return false; } }
function nextCase() { caseCounter += 1; return caseCounter; }

const HELP_SECTIONS = [
  { header: '🛡️ Moderation', entries: [ [',ban <user> [reason]', 'Ban a member (DM + mod log + unban button)'], [',unban <id>', 'Lift a ban'], [',softban <user>', 'Ban then unban → purges their messages'], [',kick <user> [reason]', 'Kick a member'], [',mute <user> [minutes]', 'Timeout a member (max 28 days)'], [',unmute <user>', 'Clear a timeout'], [',clear <amount>', 'Bulk delete the last messages (1-100)'] ] },
  { header: '🦮 Leash', entries: [ [',leash <user> [minutes]', 'Put a member on the leash'], [',unleash <user>', 'Release a member from the leash'], [',leashlist', 'Show who is leashed right now'] ] },
  { header: '⚠️ Warnings', entries: [ [',warn <user> [reason]', 'Record a warning'], [',warnings <user>', 'List every warning'], [',clearwarns <user>', 'Wipe all warnings'] ] },
  { header: '🔍 Info', entries: [ [',ping', 'Latency, uptime and memory'], [',userinfo [user]', 'Member profile card'], [',serverinfo', 'Server statistics'], [',roblox <username>', 'Look up a Roblox player'] ] },
];

async function cmdHelp(msg) {
  const embed = baseEmbed(ORANGE).setAuthor({ name: `${client.user.tag} — command centre`, iconURL: client.user.displayAvatarURL() })
    .setDescription(`**Baddies Bot** control panel\nPrefixes: ${PREFIXES.map((p) => `\`${p}\``).join(' ')} • <#${msg.guild.id}>`)
    .setImage(BANNER_URL).setThumbnail(GIF_URL)
    .setFooter({ text: 'Baddies Bot • use ",help" anytime', iconURL: client.user.displayAvatarURL() });
  for (const section of HELP_SECTIONS) embed.addFields({ name: section.header, value: section.entries.map(([c, d]) => `\`${c}\`\n${d}`).join('\n') });
  return reply(msg, { embeds: [embed] });
}

function pingEmbed() {
  const mem = process.memoryUsage().heapUsed / 1024 / 1024;
  return baseEmbed(ORANGE).setAuthor({ name: 'Pong! 🏓', iconURL: client.user.displayAvatarURL() })
    .setDescription(`\`\`\`ansi\n  Websocket  ${client.ws.ping}ms\n  Round-trip ${Date.now() - client.ws.ping}ms\n\`\`\``)
    .addFields(
      { name: '📡 Latency', value: `\`${client.ws.ping} ms\``, inline: true },
      { name: '⏱️ Uptime', value: `\`${fmtUptime()}\``, inline: true },
      { name: '🧠 Memory', value: `\`${mem.toFixed(1)} MB\``, inline: true },
      { name: '🌐 Web', value: `\`http://localhost:${PORT}\``, inline: true },
      { name: '🏠 Guilds', value: `\`${client.guilds.cache.size}\``, inline: true },
      { name: '👥 Users', value: `\`${client.users.cache.size}\``, inline: true }
    ).setImage(BANNER_URL).setFooter({ text: `Baddies Bot • ${client.guilds.cache.size} servers`, iconURL: client.user.displayAvatarURL() });
}
async function cmdPing(msg) {
  const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`ping:refresh:${msg.author.id}`).setLabel('Refresh').setStyle(ButtonStyle.Primary).setEmoji('🔄'));
  return reply(msg, { embeds: [pingEmbed()], components: [row] });
}

async function cmdUserinfo(msg, rest) {
  const { token } = splitTarget(rest);
  const target = token ? await resolveUser(msg, token) : { user: msg.author, member: msg.member };
  if (!target.user) return replyError(msg, target.error || 'User not found.');
  const user = target.user; const member = target.member || msg.guild.members.cache.get(user.id) || null;
  const roles = member ? member.roles.cache.filter((r) => r.id !== msg.guild.id).sort((a, b) => b.position - a.position).map((r) => `<@&${r.id}>`) : [];
  const embed = baseEmbed(PURPLE).setAuthor({ name: user.username, iconURL: avatarURL(user) })
    .setTitle(`${user.username}${user.discriminator && user.discriminator !== '0' ? `#${user.discriminator}` : ''}`)
    .setThumbnail(avatarURL(user))
    .addFields(
      { name: '🆔 ID', value: `\`${user.id}\``, inline: true },
      { name: '📅 Account Created', value: stamp(user.createdAt), inline: true },
      { name: '🤖 Bot', value: user.bot ? 'Yes' : 'No', inline: true },
      { name: '📥 Joined Server', value: member?.joinedTimestamp ? stamp(member.joinedTimestamp) : 'Not a member', inline: true },
      { name: '💎 Boosts Since', value: member?.premiumSinceTimestamp ? stamp(member.premiumSinceTimestamp) : 'Never', inline: true },
      { name: '🎭 Nickname', value: member?.nickname ? `\`${member.nickname}\`` : 'None', inline: true },
      { name: '🎭 Roles', value: roles.length ? roles.join(' ') : 'None', inline: false }
    ).setFooter({ text: `Requested by ${msg.author.tag}`, iconURL: msg.author.displayAvatarURL() });
  return reply(msg, { embeds: [embed] });
}

async function cmdServerinfo(msg) {
  const g = msg.guild; const owner = await g.fetchOwner().catch(() => null); const channels = g.channels.cache;
  const embed = baseEmbed(BLUE).setAuthor({ name: g.name, iconURL: g.iconURL() || undefined }).setTitle(`🏠 ${g.name}`).setThumbnail(g.iconURL() || GIF_URL)
    .addFields(
      { name: '🆔 ID', value: `\`${g.id}\``, inline: true }, { name: '👑 Owner', value: owner ? `<@${owner.id}>` : 'Unknown', inline: true },
      { name: '📅 Created', value: stamp(g.createdAt), inline: true }, { name: '👥 Members', value: `\`${g.memberCount}\``, inline: true },
      { name: '💬 Channels', value: `\`${channels.size}\``, inline: true }, { name: '🎭 Roles', value: `\`${g.roles.cache.size}\``, inline: true },
      { name: '😀 Emojis', value: `\`${g.emojis.cache.size}\``, inline: true }, { name: '🔒 Verification', value: `\`${g.verificationLevel}\``, inline: true },
      { name: '💎 Boost Tier', value: `\`${g.premiumTier}\``, inline: true }, { name: '📈 Boosts', value: `\`${g.premiumSubscriptionCount || 0}\``, inline: true }
    ).setFooter({ text: `Baddies Bot • ${g.name}`, iconURL: client.user.displayAvatarURL() });
  return reply(msg, { embeds: [embed] });
}

async function cmdRoblox(msg, rest) {
  const username = rest.split(/\s+/)[0];
  if (!username) return replyError(msg, 'Usage: `,roblox <username>`');
  const embed = baseEmbed(ORANGE).setDescription('🔎 Searching Roblox…');
  const status = await reply(msg, { embeds: [embed] }); if (!status) return;
  try {
    const lookup = await httpJson('https://users.roblox.com/v1/usernames/users', { method: 'POST', body: JSON.stringify({ usernames: [username], excludeBannedUsers: false }) });
    const found = lookup.json?.data?.[0];
    if (!found) return status.edit({ embeds: [errorEmbed(`No Roblox user named **${username}** was found.`).setTimestamp()] });
    const id = found.id;
    const [infoRes, thumbRes] = await Promise.all([ httpJson(`https://users.roblox.com/v1/users/${id}`), httpJson(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${id}&size=420x420&format=Png&isCircular=false`) ]);
    const info = infoRes.json || {}; const avatar = thumbRes.json?.data?.[0]?.imageUrl || null;
    const robloxEmbed = baseEmbed(ORANGE).setAuthor({ name: info.displayName || info.name || username, iconURL: GIF_URL })
      .setTitle(`🎮 ${info.displayName || info.name || username}`).setURL(`https://www.roblox.com/users/${id}/profile`).setThumbnail(avatar || GIF_URL)
      .addFields(
        { name: '🪪 Username', value: `\`${info.name || username}\``, inline: true }, { name: '🆔 User ID', value: `\`${id}\``, inline: true },
        { name: '👥 Friends', value: `\`${info.friendCount ?? 'N/A'}\``, inline: true }, { name: '👀 Followers', value: `\`${info.followerCount ?? 'N/A'}\``, inline: true },
        { name: '📅 Joined Roblox', value: info.createdDate ? stamp(new Date(info.createdDate)) : 'N/A', inline: true }, { name: '✅ Verified', value: info.isVerified ? 'Yes' : 'No', inline: true }
      ).setFooter({ text: `Requested by ${msg.author.tag} • Roblox`, iconURL: msg.author.displayAvatarURL() });
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel('Open Profile').setStyle(ButtonStyle.Link).setURL(`https://www.roblox.com/users/${id}/profile`));
    await status.edit({ embeds: [robloxEmbed], components: [row] });
  } catch (e) { await status.edit({ embeds: [errorEmbed(`Roblox lookup failed: \`${e.message}\``)] }).catch(() => {}); }
}

async function cmdBan(msg, rest) {
  const err = modCheck(msg, PermissionFlagsBits.BanMembers); if (err) return replyError(msg, err);
  const { token, reason } = splitTarget(rest); if (!token) return replyError(msg, 'Usage: `,ban <user> [reason]`');
  const target = await resolveUser(msg, token); if (!target.user) return replyError(msg, target.error || 'User not found.');
  const member = target.member || msg.guild.members.cache.get(target.user.id) || null; const hErr = hierarchyError(msg, member); if (hErr) return replyError(msg, hErr);
  const purge = /\bpurge\b/i.test(reason); const finalReason = reason.replace(/\bpurge\b/gi, '').trim() || 'No reason provided';
  try { const options = { reason: finalReason }; if (purge && msg.guild.members.me.permissions.has(PermissionFlagsBits.ManageMessages)) options.deleteMessageSeconds = 604800; await msg.guild.members.ban(target.user.id, options); }
  catch (e) { return replyError(msg, `Could not ban that user: \`${e.message}\``); }
  const caseId = nextCase();
  const embed = baseEmbed(RED).setAuthor({ name: '⛔ Member Banned', iconURL: client.user.displayAvatarURL() }).setTitle(`${target.user.username} has been banned`).setThumbnail(avatarURL(target.user))
    .setDescription(`**${target.user.username}** (\`${target.user.id}\`) was removed from **${msg.guild.name}**.`)
    .addFields({ name: '📄 Reason', value: finalReason, inline: false }, { name: '👮 Moderator', value: `<@${msg.author.id}>`, inline: true }, { name: '🕒 Time', value: relStamp(), inline: true }, { name: '🗂️ Case', value: `#${caseId}`, inline: true }, { name: '🧹 Messages', value: purge ? 'Purged (7 days)' : 'Kept', inline: true })
    .setFooter({ text: `Baddies Mod Team • Case #${caseId}`, iconURL: client.user.displayAvatarURL() }).setTimestamp();
  const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`unban:${target.user.id}:${msg.author.id}`).setLabel('Unban').setStyle(ButtonStyle.Danger).setEmoji('♻️'));
  await reply(msg, { embeds: [embed], components: [row] });
  await sendModLog(baseEmbed(RED).setAuthor({ name: '📋 Moderation Log • Ban', iconURL: client.user.displayAvatarURL() }).setThumbnail(avatarURL(target.user))
    .addFields({ name: '👤 User', value: `<@${target.user.id}>\n\`${target.user.id}\``, inline: true }, { name: '📄 Reason', value: finalReason, inline: true }, { name: '👮 Moderator', value: `<@${msg.author.id}>`, inline: true }, { name: '🕒 Time', value: relStamp(), inline: true }, { name: '🏠 Server', value: `${msg.guild.name}\n\`${msg.guild.id}\``, inline: true }, { name: '🗂️ Case', value: `#${caseId}`, inline: true })
    .setFooter({ text: `Baddies Mod Team • Case #${caseId}` }).setTimestamp(), msg.channel.id);
  const dmSent = await dmUser(target.user, baseEmbed(RED).setTitle('⛔ You have been banned').setDescription(`You were banned from **${msg.guild.name}**.\n**Reason:** ${finalReason}\n**Case:** #${caseId}`).setFooter({ text: `Baddies Mod Team • ${msg.guild.name}` }).setTimestamp());
  if (!dmSent) console.log(`(could not DM ${target.user.id} about their ban)`);
}

async function cmdUnban(msg, rest) {
  const err = modCheck(msg, PermissionFlagsBits.BanMembers); if (err) return replyError(msg, err);
  const { token } = splitTarget(rest); if (!token) return replyError(msg, 'Usage: `,unban <user id>`');
  const id = token.replace(/\D/g, ''); if (!id) return replyError(msg, 'That is not a valid user ID.');
  try { await msg.guild.members.unban(id, 'Unbanned by ' + msg.author.tag); }
  catch (e) { if (String(e.code).includes('10026')) return replyError(msg, 'That user is not banned.'); return replyError(msg, `Could not unban: \`${e.message}\``); }
  const embed = baseEmbed(GREEN).setAuthor({ name: '♻️ Member Unbanned', iconURL: client.user.displayAvatarURL() }).setTitle(`${id} was unbanned`)
    .addFields({ name: '🆔 User ID', value: `\`${id}\``, inline: true }, { name: '👮 Moderator', value: `<@${msg.author.id}>`, inline: true }, { name: '🕒 Time', value: relStamp(), inline: true })
    .setFooter({ text: `Baddies Mod Team • ${msg.guild.name}` }).setTimestamp();
  await reply(msg, { embeds: [embed] });
  await sendModLog(baseEmbed(GREEN).setAuthor({ name: '📋 Moderation Log • Unban', iconURL: client.user.displayAvatarURL() })
    .addFields({ name: '🆔 User ID', value: `\`${id}\``, inline: true }, { name: '👮 Moderator', value: `<@${msg.author.id}>`, inline: true }, { name: '🏠 Server', value: `${msg.guild.name}`, inline: true }).setTimestamp(), msg.channel.id);
}

async function cmdSoftban(msg, rest) {
  const err = modCheck(msg, PermissionFlagsBits.BanMembers); if (err) return replyError(msg, err);
  const { token } = splitTarget(rest); if (!token) return replyError(msg, 'Usage: `,softban <user>`');
  const target = await resolveUser(msg, token); if (!target.user) return replyError(msg, target.error || 'User not found.');
  const member = target.member || msg.guild.members.cache.get(target.user.id) || null; const hErr = hierarchyError(msg, member); if (hErr) return replyError(msg, hErr);
  try { await msg.guild.members.ban(target.user.id, { reason: 'Softban by ' + msg.author.tag, deleteMessageSeconds: 604800 }); await msg.guild.members.unban(target.user.id, 'Softban by ' + msg.author.tag); }
  catch (e) { return replyError(msg, `Could not softban: \`${e.message}\``); }
  const embed = baseEmbed(YELLOW).setAuthor({ name: '🧹 Member Softbanned', iconURL: client.user.displayAvatarURL() }).setTitle(`${target.user.username} was softbanned`).setThumbnail(avatarURL(target.user))
    .addFields({ name: '🆔 User ID', value: `\`${target.user.id}\``, inline: true }, { name: '👮 Moderator', value: `<@${msg.author.id}>`, inline: true }, { name: '🧹 Messages', value: 'Purged (7 days)', inline: true })
    .setFooter({ text: `Baddies Mod Team • ${msg.guild.name}` }).setTimestamp();
  await reply(msg, { embeds: [embed] });
  await sendModLog(baseEmbed(YELLOW).setAuthor({ name: '📋 Moderation Log • Softban', iconURL: client.user.displayAvatarURL() })
    .addFields({ name: '👤 User', value: `<@${target.user.id}>`, inline: true }, { name: '👮 Moderator', value: `<@${msg.author.id}>`, inline: true }, { name: '🏠 Server', value: `${msg.guild.name}`, inline: true }).setTimestamp(), msg.channel.id);
}

async function cmdKick(msg, rest) {
  const err = modCheck(msg, PermissionFlagsBits.KickMembers); if (err) return replyError(msg, err);
  const { token, reason } = splitTarget(rest); if (!token) return replyError(msg, 'Usage: `,kick <user> [reason]`');
  const target = await resolveUser(msg, token); if (!target.user) return replyError(msg, target.error || 'User not found.');
  const member = target.member || msg.guild.members.cache.get(target.user.id) || null; if (!member) return replyError(msg, 'That user is not in this server.'); const hErr = hierarchyError(msg, member); if (hErr) return replyError(msg, hErr);
  const finalReason = reason || 'No reason provided';
  try { await member.kick(finalReason); } catch (e) { return replyError(msg, `Could not kick that user: \`${e.message}\``); }
  const embed = baseEmbed(ORANGE).setAuthor({ name: '👢 Member Kicked', iconURL: client.user.displayAvatarURL() }).setTitle(`${target.user.username} was kicked`).setThumbnail(avatarURL(target.user))
    .addFields({ name: '🆔 User ID', value: `\`${target.user.id}\``, inline: true }, { name: '📄 Reason', value: finalReason, inline: false }, { name: '👮 Moderator', value: `<@${msg.author.id}>`, inline: true }, { name: '🕒 Time', value: relStamp(), inline: true })
    .setFooter({ text: `Baddies Mod Team • ${msg.guild.name}` }).setTimestamp();
  await reply(msg, { embeds: [embed] });
  await sendModLog(baseEmbed(ORANGE).setAuthor({ name: '📋 Moderation Log • Kick', iconURL: client.user.displayAvatarURL() }).setThumbnail(avatarURL(target.user))
    .addFields({ name: '👤 User', value: `<@${target.user.id}>\n\`${target.user.id}\``, inline: true }, { name: '📄 Reason', value: finalReason, inline: true }, { name: '👮 Moderator', value: `<@${msg.author.id}>`, inline: true }, { name: '🏠 Server', value: `${msg.guild.name}`, inline: true }).setTimestamp(), msg.channel.id);
  await dmUser(target.user, baseEmbed(ORANGE).setTitle('👢 You have been kicked').setDescription(`You were kicked from **${msg.guild.name}**.\n**Reason:** ${finalReason}`).setFooter({ text: `Baddies Mod Team • ${msg.guild.name}` }).setTimestamp());
}

async function cmdMute(msg, rest) {
  const err = modCheck(msg, PermissionFlagsBits.ModerateMembers); if (err) return replyError(msg, err);
  const { token, reason } = splitTarget(rest); if (!token) return replyError(msg, 'Usage: `,mute <user> [minutes] [reason]`');
  const target = await resolveUser(msg, token); if (!target.user) return replyError(msg, target.error || 'User not found.');
  const member = target.member || (await msg.guild.members.fetch(target.user.id).catch(() => null)) || null; if (!member) return replyError(msg, 'Could not fetch that member.'); if (!member.moderatable) return replyError(msg, 'I cannot moderate that member.');
  const parts = rest.split(/\s+/).filter(Boolean); let minutes = 10; const numIdx = parts.findIndex((p, i) => i > 0 && /^\d+$/.test(p)); if (numIdx > 0) minutes = Math.min(parseInt(parts[numIdx], 10), 40320);
  const finalReason = parts.filter((_, i) => i !== numIdx).join(' ').trim() || 'No reason provided';
  try { await member.timeout(minutes * 60 * 1000, finalReason); } catch (e) { return replyError(msg, `Could not mute that user: \`${e.message}\``); }
  const embed = baseEmbed(PURPLE).setAuthor({ name: '🔇 Member Muted', iconURL: client.user.displayAvatarURL() }).setTitle(`${target.user.username} was muted`).setThumbnail(avatarURL(target.user))
    .addFields({ name: '⏱️ Duration', value: fmtDuration(minutes), inline: true }, { name: '📄 Reason', value: finalReason, inline: false }, { name: '👮 Moderator', value: `<@${msg.author.id}>`, inline: true }, { name: '🕒 Ends', value: relStamp(Date.now() + minutes * 60 * 1000), inline: true })
    .setFooter({ text: `Baddies Mod Team • ${msg.guild.name}` }).setTimestamp();
  await reply(msg, { embeds: [embed] });
  await sendModLog(baseEmbed(PURPLE).setAuthor({ name: '📋 Moderation Log • Mute', iconURL: client.user.displayAvatarURL() })
    .addFields({ name: '👤 User', value: `<@${target.user.id}>`, inline: true }, { name: '⏱️ Duration', value: fmtDuration(minutes), inline: true }, { name: '📄 Reason', value: finalReason, inline: true }, { name: '👮 Moderator', value: `<@${msg.author.id}>`, inline: true }).setTimestamp(), msg.channel.id);
}

async function cmdUnmute(msg, rest) {
  const err = modCheck(msg, PermissionFlagsBits.ModerateMembers); if (err) return replyError(msg, err);
  const { token } = splitTarget(rest); if (!token) return replyError(msg, 'Usage: `,unmute <user>`');
  const target = await resolveUser(msg, token); if (!target.user) return replyError(msg, target.error || 'User not found.');
  const member = target.member || (await msg.guild.members.fetch(target.user.id).catch(() => null)) || null; if (!member) return replyError(msg, 'Could not fetch that member.');
  try { await member.timeout(null, 'Unmuted by ' + msg.author.tag); } catch (e) { return replyError(msg, `Could not unmute that user: \`${e.message}\``); }
  const embed = baseEmbed(GREEN).setAuthor({ name: '🔊 Member Unmuted', iconURL: client.user.displayAvatarURL() }).setTitle(`${target.user.username} was unmuted`)
    .addFields({ name: '🆔 User ID', value: `\`${target.user.id}\``, inline: true }, { name: '👮 Moderator', value: `<@${msg.author.id}>`, inline: true }, { name: '🕒 Time', value: relStamp(), inline: true })
    .setFooter({ text: `Baddies Mod Team • ${msg.guild.name}` }).setTimestamp();
  await reply(msg, { embeds: [embed] });
  await sendModLog(baseEmbed(GREEN).setAuthor({ name: '📋 Moderation Log • Unmute', iconURL: client.user.displayAvatarURL() })
    .addFields({ name: '👤 User', value: `<@${target.user.id}>`, inline: true }, { name: '👮 Moderator', value: `<@${msg.author.id}>`, inline: true }, { name: '🏠 Server', value: `${msg.guild.name}`, inline: true }).setTimestamp(), msg.channel.id);
}

async function cmdClear(msg, rest) {
  const err = modCheck(msg, PermissionFlagsBits.ManageMessages); if (err) return replyError(msg, err);
  const amount = parseInt(rest.split(/\s+/)[0], 10); if (!amount || amount < 1 || amount > 100) return replyError(msg, 'Usage: `,clear <1-100>`');
  try {
    const messages = await msg.channel.messages.fetch({ limit: amount + 1 });
    const deleted = await msg.channel.bulkDelete(messages, true); const count = deleted.size; const skipped = amount + 1 - count;
    const embed = baseEmbed(BLUE).setAuthor({ name: '🧹 Messages Cleared', iconURL: client.user.displayAvatarURL() }).setTitle(`${count} message(s) deleted`)
      .addFields({ name: '📍 Channel', value: `<#${msg.channel.id}>`, inline: true }, { name: '👮 Moderator', value: `<@${msg.author.id}>`, inline: true }, { name: '🕒 Time', value: relStamp(), inline: true })
      .setFooter({ text: `Baddies Mod Team • ${msg.guild.name}` }).setTimestamp();
    if (skipped > 0) embed.addFields({ name: 'ℹ️ Note', value: `${skipped} message(s) older than 14 days were kept.`, inline: false });
    await reply(msg, { embeds: [embed] });
  } catch (e) { return replyError(msg, `Could not clear messages: \`${e.message}\``); }
}

async function cmdWarn(msg, rest) {
  const err = modCheck(msg, PermissionFlagsBits.ManageMessages); if (err) return replyError(msg, err);
  const { token, reason } = splitTarget(rest); if (!token) return replyError(msg, 'Usage: `,warn <user> [reason]`');
  const target = await resolveUser(msg, token); if (!target.user) return replyError(msg, target.error || 'User not found.');
  const member = target.member || msg.guild.members.cache.get(target.user.id) || null; const hErr = hierarchyError(msg, member); if (hErr) return replyError(msg, hErr);
  const finalReason = reason || 'No reason provided';
  if (!warnings.has(target.user.id)) warnings.set(target.user.id, []);
  const list = warnings.get(target.user.id); const warnId = list.length + 1; list.push({ id: warnId, reason: finalReason, mod: msg.author.tag, at: Date.now() });
  const embed = baseEmbed(YELLOW).setAuthor({ name: '⚠️ Warning Issued', iconURL: client.user.displayAvatarURL() }).setTitle(`${target.user.username} received a warning`).setThumbnail(avatarURL(target.user))
    .addFields({ name: '📄 Reason', value: finalReason, inline: false }, { name: '🔢 Total Warnings', value: `\`${list.length}\``, inline: true }, { name: '👮 Moderator', value: `<@${msg.author.id}>`, inline: true }, { name: '🕒 Time', value: relStamp(), inline: true })
    .setFooter({ text: `Baddies Mod Team • ${msg.guild.name}` }).setTimestamp();
  await reply(msg, { embeds: [embed] });
  await sendModLog(baseEmbed(YELLOW).setAuthor({ name: '📋 Moderation Log • Warning', iconURL: client.user.displayAvatarURL() })
    .addFields({ name: '👤 User', value: `<@${target.user.id}>`, inline: true }, { name: '📄 Reason', value: finalReason, inline: true }, { name: '👮 Moderator', value: `<@${msg.author.id}>`, inline: true }, { name: '🔢 Count', value: `\`${list.length}\``, inline: true }).setTimestamp(), msg.channel.id);
  await dmUser(target.user, baseEmbed(YELLOW).setTitle('⚠️ You received a warning').setDescription(`A warning was issued to you in **${msg.guild.name}**.\n**Reason:** ${finalReason}`).setFooter({ text: `Baddies Mod Team • ${msg.guild.name}` }).setTimestamp());
}

async function cmdWarnings(msg, rest) {
  const { token } = splitTarget(rest);
  const target = token ? await resolveUser(msg, token) : { user: msg.author, member: msg.member };
  if (!target.user) return replyError(msg, target.error || 'User not found.');
  const list = warnings.get(target.user.id) || [];
  const embed = baseEmbed(YELLOW).setAuthor({ name: '⚠️ Warning History', iconURL: client.user.displayAvatarURL() }).setTitle(`${target.user.username} — ${list.length} warning(s)`).setThumbnail(avatarURL(target.user));
  if (!list.length) embed.setDescription('✅ This member has a clean record. No warnings found.');
  else embed.setDescription(list.map((w) => `**#${w.id}** • ${w.reason}\n└ by \`${w.mod}\` • ${relStamp(new Date(w.at))}`).join('\n'));
  embed.setFooter({ text: `Baddies Mod Team • ${msg.guild.name}` });
  return reply(msg, { embeds: [embed] });
}

async function cmdClearwarns(msg, rest) {
  const err = modCheck(msg, PermissionFlagsBits.ManageMessages); if (err) return replyError(msg, err);
  const { token } = splitTarget(rest); if (!token) return replyError(msg, 'Usage: `,clearwarns <user>`');
  const target = await resolveUser(msg, token); if (!target.user) return replyError(msg, target.error || 'User not found.');
  const count = (warnings.get(target.user.id) || []).length; warnings.delete(target.user.id);
  const embed = baseEmbed(GREEN).setAuthor({ name: '🧽 Warnings Cleared', iconURL: client.user.displayAvatarURL() }).setTitle(`${target.user.username}'s warnings were cleared`)
    .addFields({ name: '🔢 Removed', value: `\`${count}\``, inline: true }, { name: '👮 Moderator', value: `<@${msg.author.id}>`, inline: true }, { name: '🕒 Time', value: relStamp(), inline: true })
    .setFooter({ text: `Baddies Mod Team • ${msg.guild.name}` }).setTimestamp();
  await reply(msg, { embeds: [embed] });
  await sendModLog(baseEmbed(GREEN).setAuthor({ name: '📋 Moderation Log • Clear Warnings', iconURL: client.user.displayAvatarURL() })
    .addFields({ name: '👤 User', value: `<@${target.user.id}>`, inline: true }, { name: '🔢 Removed', value: `\`${count}\``, inline: true }, { name: '👮 Moderator', value: `<@${msg.author.id}>`, inline: true }).setTimestamp(), msg.channel.id);
}

async function getLeashRole(guild) {
  if (LEASH_ROLE_ID) { const byId = guild.roles.cache.get(LEASH_ROLE_ID); if (byId) return byId; const fetched = await guild.roles.fetch(LEASH_ROLE_ID).catch(() => null); if (fetched) return fetched; }
  const byName = guild.roles.cache.find((r) => r.name === LEASH_ROLE_NAME); if (byName) return byName;
  const me = guild.members.me; if (!me || !me.permissions.has(PermissionFlagsBits.ManageRoles)) return null;
  try { return await guild.roles.create({ name: LEASH_ROLE_NAME, color: GREY, reason: 'Leash role created by Baddies Bot' }); } catch { return null; }
}

async function cmdLeash(msg, rest) {
  const err = modCheck(msg, PermissionFlagsBits.ManageRoles); if (err) return replyError(msg, err);
  const { token, reason } = splitTarget(rest); if (!token) return replyError(msg, 'Usage: `,leash <user> [minutes] [reason]`');
  const target = await resolveUser(msg, token); if (!target.user) return replyError(msg, target.error || 'User not found.');
  const member = target.member || (await msg.guild.members.fetch(target.user.id).catch(() => null)) || null; if (!member) return replyError(msg, 'Could not fetch that member.');
  const hErr = hierarchyError(msg, member); if (hErr) return replyError(msg, hErr); if (!member.moderatable) return replyError(msg, 'I cannot moderate that member.');
  const parts = rest.split(/\s+/).filter(Boolean); let minutes = 60; const numIdx = parts.findIndex((p, i) => i > 0 && /^\d+$/.test(p)); if (numIdx > 0) minutes = Math.min(parseInt(parts[numIdx], 10), 40320);
  const finalReason = parts.filter((_, i) => i !== numIdx).join(' ').trim() || 'Caught wandering off';
  const role = await getLeashRole(msg.guild);
  if (role) { try { await member.roles.add(role, 'Leashed by ' + msg.author.tag); } catch (e) { return replyError(msg, `Could not apply the leash role: \`${e.message}\``); } }
  try { await member.timeout(minutes * 60 * 1000, `Leashed: ${finalReason}`); } catch {}
  leashed.set(target.user.id, { since: Date.now(), until: Date.now() + minutes * 60 * 1000, by: msg.author.tag, reason: finalReason });
  const embed = baseEmbed(GREY).setAuthor({ name: '🦮 Member Leashed', iconURL: client.user.displayAvatarURL() }).setTitle(`${target.user.username} has been put on the leash`).setThumbnail(avatarURL(target.user))
    .setDescription(`\`\`\`\n   🦮 <@${target.user.id}> is now on a short leash.\n\`\`\``)
    .addFields({ name: '⏱️ Leash Length', value: fmtDuration(minutes), inline: true }, { name: '📄 Reason', value: finalReason, inline: false }, { name: '👮 Handler', value: `<@${msg.author.id}>`, inline: true }, { name: '🕒 Unleashes', value: relStamp(Date.now() + minutes * 60 * 1000), inline: true })
    .setFooter({ text: `Baddies Mod Team • ${msg.guild.name}` }).setTimestamp();
  const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`unleash:${target.user.id}:${msg.author.id}`).setLabel('Release').setStyle(ButtonStyle.Success).setEmoji('🦮'));
  await reply(msg, { embeds: [embed], components: [row] });
  await sendModLog(baseEmbed(GREY).setAuthor({ name: '📋 Moderation Log • Leash', iconURL: client.user.displayAvatarURL() }).setThumbnail(avatarURL(target.user))
    .addFields({ name: '👤 User', value: `<@${target.user.id}>`, inline: true }, { name: '⏱️ Duration', value: fmtDuration(minutes), inline: true }, { name: '📄 Reason', value: finalReason, inline: true }, { name: '👮 Handler', value: `<@${msg.author.id}>`, inline: true }).setTimestamp(), msg.channel.id);
}

async function cmdUnleash(msg, rest) {
  const err = modCheck(msg, PermissionFlagsBits.ManageRoles); if (err) return replyError(msg, err);
  const { token } = splitTarget(rest); if (!token) return replyError(msg, 'Usage: `,unleash <user>`');
  const target = await resolveUser(msg, token); if (!target.user) return replyError(msg, target.error || 'User not found.');
  const member = target.member || (await msg.guild.members.fetch(target.user.id).catch(() => null)) || null;
  const role = await getLeashRole(msg.guild);
  if (role && member) { try { await member.roles.remove(role, 'Unleashed by ' + msg.author.tag); } catch {} }
  if (member && member.moderatable) { try { await member.timeout(null, 'Unleashed by ' + msg.author.tag); } catch {} }
  leashed.delete(target.user.id);
  const embed = baseEmbed(GREEN).setAuthor({ name: '🛞 Member Unleashed', iconURL: client.user.displayAvatarURL() }).setTitle(`${target.user.username} is off the leash`).setThumbnail(avatarURL(target.user))
    .addFields({ name: '🆔 User ID', value: `\`${target.user.id}\``, inline: true }, { name: '👮 Handler', value: `<@${msg.author.id}>`, inline: true }, { name: '🕒 Time', value: relStamp(), inline: true })
    .setFooter({ text: `Baddies Mod Team • ${msg.guild.name}` }).setTimestamp();
  await reply(msg, { embeds: [embed] });
  await sendModLog(baseEmbed(GREEN).setAuthor({ name: '📋 Moderation Log • Unleash', iconURL: client.user.displayAvatarURL() })
    .addFields({ name: '👤 User', value: `<@${target.user.id}>`, inline: true }, { name: '👮 Handler', value: `<@${msg.author.id}>`, inline: true }).setTimestamp(), msg.channel.id);
}

async function cmdLeashlist(msg) {
  const embed = baseEmbed(GREY).setAuthor({ name: '🦮 Leash Register', iconURL: client.user.displayAvatarURL() }).setTitle(`Currently leashed — ${leashed.size} member(s)`);
  if (!leashed.size) embed.setDescription('✅ Nobody is on the leash right now. Free as a bird.');
  else embed.setDescription([...leashed.entries()].map(([id, info]) => `${info.until < Date.now() ? '⏰' : '🦮'} <@${id}> — ${fmtDuration(Math.max(1, Math.round((info.until - Date.now()) / 60000)))} left • by \`${info.by}\` • ${info.reason}`).join('\n'));
  embed.setFooter({ text: `Baddies Mod Team • ${msg.guild.name}` });
  return reply(msg, { embeds: [embed] });
}

const COMMANDS = {
  help: (m) => cmdHelp(m), commands: (m) => cmdHelp(m), ping: (m) => cmdPing(m),
  userinfo: (m, r) => cmdUserinfo(m, r), user: (m, r) => cmdUserinfo(m, r), serverinfo: (m) => cmdServerinfo(m),
  roblox: (m, r) => cmdRoblox(m, r), ban: (m, r) => cmdBan(m, r), unban: (m, r) => cmdUnban(m, r),
  softban: (m, r) => cmdSoftban(m, r), kick: (m, r) => cmdKick(m, r), mute: (m, r) => cmdMute(m, r),
  unmute: (m, r) => cmdUnmute(m, r), clear: (m, r) => cmdClear(m, r), purge: (m, r) => cmdClear(m, r),
  warn: (m, r) => cmdWarn(m, r), warnings: (m, r) => cmdWarnings(m, r), clearwarns: (m, r) => cmdClearwarns(m, r),
  leash: (m, r) => cmdLeash(m, r), unleash: (m, r) => cmdUnleash(m, r), leashlist: (m) => cmdLeashlist(m),
};
const COOLDOWN_CMDS = new Set(['ban', 'kick', 'softban', 'clear', 'mute', 'leash']);
const COOLDOWN_MS = 3000;

client.on(Events.MessageCreate, async (msg) => {
  if (msg.author.bot) return; if (!msg.guild || msg.system) return;
  const parsed = parseCommand(msg.content); if (!parsed) return;
  const cmd = COMMANDS[parsed.name];
  if (!cmd) {
    const names = Object.keys(COMMANDS); let best = null, bestDist = Infinity;
    for (const n of names) { const d = levenshtein(parsed.name, n); if (d < bestDist) { bestDist = d; best = n; } }
    if (best && bestDist <= 2) return reply(msg, { embeds: [errorEmbed(`Unknown command \`${parsed.prefix}${parsed.name}\`. Did you mean \`${parsed.prefix}${best}\`?`)] });
    return;
  }
  if (COOLDOWN_CMDS.has(parsed.name)) {
    const last = cooldowns.get(msg.author.id) || 0;
    if (Date.now() - last < COOLDOWN_MS) { const wait = ((COOLDOWN_MS - (Date.now() - last)) / 1000).toFixed(1); return replyError(msg, `Slow down — wait ${wait}s before running that again.`); }
    cooldowns.set(msg.author.id, Date.now());
  }
  try { await cmd(msg, parsed.rest); } catch (err) { console.error('command error:', err); await replyError(msg, `Something broke while running \`${parsed.prefix}${parsed.name}\`.`); }
});

client.on(Events.InteractionCreate, async (i) => {
  if (i.isButton()) {
    const [action, userId] = i.customId.split(':');
    if (action === 'ping' && userId === i.user.id) { await i.reply({ embeds: [pingEmbed()], ephemeral: true }); return; }
    if (action === 'unban') {
      if (!i.guild) return;
      const me = i.guild.members.me;
      if (!me?.permissions.has(PermissionFlagsBits.BanMembers)) return i.reply({ embeds: [errorEmbed('I lack the **Ban Members** permission.')], ephemeral: true });
      if (!i.member.permissions.has(PermissionFlagsBits.Administrator)) return i.reply({ embeds: [errorEmbed('You need the **Administrator** permission.')], ephemeral: true });
      try { await i.guild.members.unban(userId, 'Unbanned by ' + i.user.tag); }
      catch (e) { return i.reply({ embeds: [errorEmbed(`Could not unban: \`${e.message}\``)], ephemeral: true }); }
      const embed = baseEmbed(GREEN).setAuthor({ name: '♻️ Member Unbanned', iconURL: client.user.displayAvatarURL() }).setTitle(`\`${userId}\` was unbanned`)
        .addFields({ name: '👮 Moderator', value: `<@${i.user.id}>`, inline: true }, { name: '🕒 Time', value: relStamp(), inline: true }).setTimestamp();
      await i.update({ embeds: [embed], components: [] });
      await sendModLog(baseEmbed(GREEN).setAuthor({ name: '📋 Moderation Log • Unban (button)', iconURL: client.user.displayAvatarURL() })
        .addFields({ name: '🆔 User ID', value: `\`${userId}\``, inline: true }, { name: '👮 Moderator', value: `<@${i.user.id}>`, inline: true }, { name: '🏠 Server', value: `${i.guild.name}`, inline: true }).setTimestamp(), i.channel.id);
      return;
    }
    if (action === 'unleash') {
      if (!i.guild) return;
      const me = i.guild.members.me;
      if (!me?.permissions.has(PermissionFlagsBits.ManageRoles)) return i.reply({ embeds: [errorEmbed('I lack the **Manage Roles** permission.')], ephemeral: true });
      if (!i.member.permissions.has(PermissionFlagsBits.Administrator)) return i.reply({ embeds: [errorEmbed('You need the **Administrator** permission.')], ephemeral: true });
      const member = await i.guild.members.fetch(userId).catch(() => null); const role = await getLeashRole(i.guild);
      if (member && role) await member.roles.remove(role, 'Unleashed by ' + i.user.tag).catch(() => {});
      if (member && member.moderatable) await member.timeout(null, 'Unleashed by ' + i.user.tag).catch(() => {});
      leashed.delete(userId);
      const embed = baseEmbed(GREEN).setAuthor({ name: '🛞 Member Unleashed', iconURL: client.user.displayAvatarURL() }).setTitle(`\`${userId}\` is off the leash`)
        .addFields({ name: '👮 Handler', value: `<@${i.user.id}>`, inline: true }, { name: '🕒 Time', value: relStamp(), inline: true }).setTimestamp();
      await i.update({ embeds: [embed], components: [] });
      return;
    }
    return;
  }
  if (!i.isChatInputCommand()) return; if (i.commandName !== 'download') return;
  const assetId = i.options.getString('asset_id').trim().replace(/\D/g, '');
  if (!assetId) return i.reply({ content: 'Please provide a valid numeric asset ID.', ephemeral: true });
  await i.deferReply();
  try {
    const details = await httpJson(`https://economy.roblox.com/v2/assets/${assetId}/details`);
    const d = details.json || {}; const name = d.Name || 'Unknown'; const creator = d.Creator?.Name || 'Unknown'; const creatorId = d.Creator?.Id; const assetTypeId = d.AssetTypeId;
    let buffer = null, ext = '';
    const urls = [`https://assetdelivery.roblox.com/v1/asset/?id=${assetId}`, `https://assetdelivery.roblox.com/v1/asset?id=${assetId}`, `https://www.roblox.com/asset/?id=${assetId}`];
    for (const u of urls) {
      try { const r = await httpRequest(u, { timeout: 30000 }); if (r.status !== 200 || !r.body || r.body.length < 100) continue; const head = r.body.slice(0, 200).toString('utf8').toLowerCase(); if (head.includes('<!doctype') || head.includes('<html') || head.includes('forbidden')) continue; buffer = r.body; ext = detectExt(buffer); break; } catch {}
    }
    const embed = new EmbedBuilder().setColor(0xff69b4).setTitle(name).setThumbnail(GIF_URL)
      .addFields({ name: 'Audio Name', value: name, inline: true }, { name: 'Creator', value: creator + (creatorId ? ` (${creatorId})` : ''), inline: true }, { name: 'Privacy', value: buffer ? 'Public (downloadable)' : 'Restricted / not downloadable', inline: true }, { name: 'Audio ID', value: String(assetId), inline: true }, { name: 'Asset Type ID', value: String(assetTypeId ?? 'N/A'), inline: true }).setTimestamp();
    if (buffer) { const file = new AttachmentBuilder(buffer, { name: `sound_${assetId}${ext}` }); await i.editReply({ embeds: [embed], files: [file] }); }
    else await i.editReply({ embeds: [embed], content: '⚠️ Could not download the audio file (restricted). Use the Listen button in-game.' });
  } catch (err) { await i.editReply({ content: `❌ Error: ${err.message}` }); }
});

function detectExt(buf) {
  if (buf[0] === 0x4f && buf[1] === 0x67 && buf[2] === 0x67 && buf[3] === 0x53) return '.ogg';
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) return '.wav';
  if (buf.slice(4, 8).toString() === 'ftyp') return '.mp4';
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return '.webm';
  if (buf[0] === 0x66 && buf[1] === 0x4c && buf[2] === 0x61 && buf[3] === 0x43) return '.flac';
  if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) return '.mp3';
  if (buf[0] === 0xff && [0xfb, 0xf3, 0xf2, 0xfa, 0xf9].includes(buf[1])) return '.mp3';
  return '.bin';
}

client.once(Events.ClientReady, async () => {
  if (!DISCORD_CLIENT_ID) return;
  const commands = [new SlashCommandBuilder().setName('download').setDescription('Download a Roblox sound by asset ID').addStringOption((opt) => opt.setName('asset_id').setDescription('Roblox asset ID (numbers only)').setRequired(true))];
  try {
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    if (DISCORD_GUILD_ID) await rest.put(Routes.applicationGuildCommands(client.user.id, DISCORD_GUILD_ID), { body: commands.map((c) => c.toJSON()) });
    else await rest.put(Routes.applicationCommands(client.user.id), { body: commands.map((c) => c.toJSON()) });
    console.log('✅ Slash commands registered.');
  } catch (err) { console.error('❌ Slash command registration error:', err.message); }
});

console.log('>>> LOGGING IN <<<');
if (!TOKEN) console.error('❌ NO TOKEN FOUND — set the TOKEN (or DISCORD_BOT_TOKEN) environment variable on Render.');
else {
  client.login(TOKEN)
    .then(() => {
      console.log('login sent, waiting Ready...');
      setTimeout(() => {
        if (!client.readyAt) console.error('❌ ClientReady did NOT fire within 20s. Check token validity, intents, and Render network. readyAt=', client.readyAt);
      }, 20000);
    })
    .catch((e) => console.error('❌ LOGIN FAILED:', e.message));
}
