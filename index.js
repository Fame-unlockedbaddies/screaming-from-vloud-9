const http = require("http");
const { WebhookClient } = require("discord.js");
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Partials,
  ApplicationIntegrationType,
  InteractionContextType,
  PermissionsBitField
} = require("discord.js");

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const ROBLOX_COOKIE = process.env.ROBLOX_COOKIE;
const PORT = process.env.PORT || 3000;

if (!TOKEN || !CLIENT_ID) {
  console.error("Missing TOKEN or CLIENT_ID");
  process.exit(1);
}

const FAME_GAME_ID = "121157515767845";
const FAME_GAME_NAME = "Fame";
const WEBHOOK_URL = "https://discord.com/api/webhooks/1493916503291203654/xRsw3M1K4nAJm6c6WVEY99yK1_4XC53cK0JRbvAylSfc6t9XK-Jsi9o4uEU_iaYkRjhP";

// YOUR SERVER ID - already added
const ALLOWED_SERVER_IDS = [
  "1428878035926388809"
];

const LOG_CHANNEL_NAME = "discord-logs";
const userViolations = new Map();

let stats = {
  totalSnipes: 0,
  successfulSnipes: 0,
  failedSnipes: 0,
  startTime: Date.now(),
  apiCalls: 0,
  rateLimits: 0,
  blockedInvites: 0,
  totalTimeouts: 0,
  autoTimeouts: 0,
  manualTimeouts: 0
};

let webhook = null;
try {
  webhook = new WebhookClient({ url: WEBHOOK_URL });
  console.log("Webhook logging enabled");
} catch (error) {
  console.error("Webhook failed:", error.message);
}

async function sendToLogChannel(guild, title, description, color = 0x5865F2, fields = [], thumbnail = null) {
  if (!guild) return;
  try {
    const logChannel = guild.channels.cache.find(c => c.name === LOG_CHANNEL_NAME && c.type === 0);
    if (!logChannel) return;
    const embed = new EmbedBuilder().setTitle(title).setDescription(description).setColor(color).setTimestamp();
    if (fields.length > 0) embed.addFields(fields);
    if (thumbnail) embed.setThumbnail(thumbnail);
    await logChannel.send({ embeds: [embed] });
  } catch (error) {
    console.error("[LOG] Error:", error.message);
  }
}

async function logToWebhook(title, description, type = "INFO", fields = [], thumbnail = null, errorStack = null) {
  if (!webhook) return;
  try {
    let color = 0x2B2D31;
    if (type === "SUCCESS") color = 0x00FF00;
    if (type === "ERROR") color = 0xFF0000;
    if (type === "WARNING") color = 0xFFA500;
    if (type === "PROTECTION") color = 0x9B59B6;
    const embed = new EmbedBuilder().setTitle(title).setDescription(description).setColor(color).setTimestamp();
    if (fields && fields.length > 0) embed.addFields(fields);
    if (thumbnail) embed.setThumbnail(thumbnail);
    await webhook.send({ embeds: [embed] });
  } catch (error) {
    console.error("Webhook error:", error.message);
  }
}

http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  if (req.url === '/stats') {
    const uptime = Math.floor((Date.now() - stats.startTime) / 1000);
    const successRate = stats.totalSnipes > 0 ? ((stats.successfulSnipes / stats.totalSnipes) * 100).toFixed(2) : 0;
    res.end(JSON.stringify({
      status: "online",
      bot: client.user?.tag,
      game: FAME_GAME_NAME,
      uptime: uptime,
      totalSnipes: stats.totalSnipes,
      successfulSnipes: stats.successfulSnipes,
      failedSnipes: stats.failedSnipes,
      successRate: `${successRate}%`,
      blockedInvites: stats.blockedInvites,
      totalTimeouts: stats.totalTimeouts
    }));
  } else {
    res.end(JSON.stringify({ status: "online", message: "Fame Sniper Bot" }));
  }
}).listen(PORT, () => console.log(`Server on port ${PORT}`));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration
  ],
  partials: [Partials.Channel]
});

let lastRequest = 0;
const REQUEST_DELAY = 200;

async function waitForRateLimit() {
  const now = Date.now();
  const wait = lastRequest + REQUEST_DELAY - now;
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastRequest = Date.now();
  stats.apiCalls++;
}

async function getUserId(username) {
  try {
    await waitForRateLimit();
    const res = await fetch("https://users.roblox.com/v1/usernames/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usernames: [username] })
    });
    const data = await res.json();
    if (data.data && data.data.length > 0) {
      return { id: data.data[0].id, name: data.data[0].name };
    }
    return null;
  } catch (error) {
    return null;
  }
}

async function getUserPresence(userId) {
  try {
    await waitForRateLimit();
    const res = await fetch("https://presence.roblox.com/v1/presence/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": `.ROBLOSECURITY=${ROBLOX_COOKIE}`
      },
      body: JSON.stringify({ userIds: [userId] })
    });
    const data = await res.json();
    if (data.userPresences && data.userPresences[0]) {
      const p = data.userPresences[0];
      if (p.userPresenceType === 2) {
        return { online: true, inGame: true, placeId: p.placeId };
      } else if (p.userPresenceType === 1) {
        return { online: true, inGame: false, placeId: null };
      }
    }
    return { online: false, inGame: false, placeId: null };
  } catch (error) {
    return { online: false, inGame: false, placeId: null };
  }
}

async function getUserAvatar(userId) {
  try {
    await waitForRateLimit();
    const res = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=720x720&format=Png&isCircular=false`);
    const data = await res.json();
    return data.data?.[0]?.imageUrl || null;
  } catch (error) {
    return null;
  }
}

async function getGameName(placeId) {
  if (!placeId) return "Unknown";
  try {
    await waitForRateLimit();
    const res = await fetch(`https://games.roblox.com/v1/games?universeIds=${placeId}`);
    const data = await res.json();
    return data.data?.[0]?.name || "Unknown Game";
  } catch (error) {
    return "Unknown Game";
  }
}

async function findUserInServers(userId) {
  let cursor = "";
  let serversScanned = 0;
  const userIdStr = userId.toString();
  try {
    for (let attempt = 0; attempt < 30; attempt++) {
      await waitForRateLimit();
      const url = `https://games.roblox.com/v1/games/${FAME_GAME_ID}/servers/Public?limit=100${cursor ? `&cursor=${cursor}` : ""}`;
      const res = await fetch(url);
      if (res.status === 429) {
        stats.rateLimits++;
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      const data = await res.json();
      if (!data.data || data.data.length === 0) break;
      for (const server of data.data) {
        serversScanned++;
        if (server.playing && Array.isArray(server.playing)) {
          if (server.playing.map(p => p.toString()).includes(userIdStr)) {
            return { found: true, jobId: server.id, players: server.playing.length, maxPlayers: server.maxPlayers, scanned: serversScanned };
          }
        }
      }
      cursor = data.nextPageCursor;
      if (!cursor) break;
    }
    return { found: false, scanned: serversScanned };
  } catch (error) {
    return { found: false, scanned: serversScanned, error: true };
  }
}

const inviteRegex = /(?:https?:\/\/)?(?:www\.)?(?:discord\.(?:gg|com\/invite)\/)([a-zA-Z0-9\-_]+)/gi;

async function isInviteAllowed(inviteCode) {
  try {
    const invite = await client.fetchInvite(inviteCode).catch(() => null);
    if (!invite) return false;
    return ALLOWED_SERVER_IDS.includes(invite.guild.id);
  } catch (error) {
    return false;
  }
}

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  const matches = message.content.match(inviteRegex);
  if (!matches) return;
  for (const match of matches) {
    const inviteCode = match.split("/").pop();
    const isAllowed = await isInviteAllowed(inviteCode);
    if (!isAllowed) {
      stats.blockedInvites++;
      try {
        await message.delete();
        const violations = (userViolations.get(message.author.id) || 0) + 1;
        userViolations.set(message.author.id, violations);
        if (violations >= 3) {
          const member = await message.guild?.members.fetch(message.author.id).catch(() => null);
          if (member) {
            await member.timeout(10 * 60 * 1000, `Automatic timeout: Invite violations (${violations})`);
            stats.totalTimeouts++;
            stats.autoTimeouts++;
            await sendToLogChannel(message.guild, "User Timed Out (Auto)", `${message.author.tag} was automatically timed out.`, 0xFFA500, [
              { name: "User", value: message.author.tag, inline: true },
              { name: "Action By", value: "Bot (Automatic)", inline: true },
              { name: "Violations", value: `${violations}/3`, inline: true }
            ]);
            setTimeout(() => userViolations.delete(message.author.id), 10 * 60 * 1000);
          }
        } else {
          await sendToLogChannel(message.guild, "Invite Warning", `${message.author.tag} received warning ${violations}/3`, 0xFFA500, [
            { name: "User", value: message.author.tag, inline: true },
            { name: "Violation", value: `${violations}/3`, inline: true }
          ]);
        }
        const warningMsg = await message.channel.send({ embeds: [new EmbedBuilder().setTitle("Invite Blocked").setDescription(`${message.author}, invite links to other servers are not allowed.`).setColor(0xFF0000)] });
        setTimeout(() => warningMsg.delete().catch(() => {}), 5000);
      } catch (error) {
        console.error("[PROTECTION] Error:", error.message);
      }
      break;
    }
  }
});

async function registerCommands() {
  const commands = [
    new SlashCommandBuilder().setName("snipe").setDescription(`Find a player in ${FAME_GAME_NAME}`).addStringOption(opt => opt.setName("username").setDescription("Roblox username").setRequired(true)).setIntegrationTypes([ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall]).setContexts([InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel]).toJSON(),
    new SlashCommandBuilder().setName("stats").setDescription("View bot statistics").setIntegrationTypes([ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall]).setContexts([InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel]).toJSON(),
    new SlashCommandBuilder().setName("timeout").setDescription("[MOD] Timeout a user").addUserOption(opt => opt.setName("user").setDescription("User to timeout").setRequired(true)).addIntegerOption(opt => opt.setName("minutes").setDescription("Duration (1-60)").setRequired(true).setMinValue(1).setMaxValue(60)).addStringOption(opt => opt.setName("reason").setDescription("Reason").setRequired(false)).setDefaultMemberPermissions(PermissionsBitField.Flags.ModerateMembers).toJSON(),
    new SlashCommandBuilder().setName("untimeout").setDescription("[MOD] Remove timeout").addUserOption(opt => opt.setName("user").setDescription("User to untimeout").setRequired(true)).setDefaultMemberPermissions(PermissionsBitField.Flags.ModerateMembers).toJSON(),
    new SlashCommandBuilder().setName("allowserver").setDescription("[ADMIN] Add allowed server").addStringOption(opt => opt.setName("serverid").setDescription("Server ID").setRequired(true)).setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator).toJSON(),
    new SlashCommandBuilder().setName("allowlist").setDescription("[ADMIN] View allowed servers").setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator).toJSON(),
    new SlashCommandBuilder().setName("removeallowed").setDescription("[ADMIN] Remove allowed server").addStringOption(opt => opt.setName("serverid").setDescription("Server ID").setRequired(true)).setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator).toJSON(),
    new SlashCommandBuilder().setName("clearwarnings").setDescription("[ADMIN] Clear user warnings").addUserOption(opt => opt.setName("user").setDescription("User").setRequired(true)).setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator).toJSON(),
    new SlashCommandBuilder().setName("warnings").setDescription("[ADMIN] View user warnings").addUserOption(opt => opt.setName("user").setDescription("User").setRequired(true)).setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator).toJSON()
  ];
  const rest = new REST({ version: "10" }).setToken(TOKEN);
  try {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log("Commands registered!");
  } catch (err) {
    console.error("Command registration failed:", err);
  }
}

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  console.log(`Game: ${FAME_GAME_NAME}`);
  console.log(`Your server ID 1428878035926388809 is allowed`);
  await registerCommands();
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // SNIPE COMMAND
  if (interaction.commandName === "snipe") {
    const startTime = Date.now();
    stats.totalSnipes++;
    try {
      await interaction.deferReply();
      const username = interaction.options.getString("username");
      const userData = await getUserId(username);
      if (!userData) {
        stats.failedSnipes++;
        await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("User Not Found").setDescription(`Could not find "${username}"`).setColor(0xFF0000)] });
        return;
      }
      const userId = userData.id;
      const actualUsername = userData.name;
      const presence = await getUserPresence(userId);
      if (!presence.online) {
        stats.failedSnipes++;
        const avatar = await getUserAvatar(userId);
        await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("Snipe Failed").setDescription(`**${actualUsername}** is offline`).setColor(0xFF0000).setThumbnail(avatar)] });
        return;
      }
      if (!presence.inGame) {
        stats.failedSnipes++;
        const avatar = await getUserAvatar(userId);
        await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("Snipe Failed").setDescription(`**${actualUsername}** is online but not in a game`).setColor(0xFFA500).setThumbnail(avatar)] });
        return;
      }
      if (presence.placeId && presence.placeId.toString() !== FAME_GAME_ID) {
        stats.failedSnipes++;
        const avatar = await getUserAvatar(userId);
        const gameName = await getGameName(presence.placeId);
        await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("Snipe Failed").setDescription(`**${actualUsername}** is playing **${gameName}**, not ${FAME_GAME_NAME}`).setColor(0xFFA500).setThumbnail(avatar)] });
        return;
      }
      const avatar = await getUserAvatar(userId);
      await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("Searching...").setDescription(`Looking for **${actualUsername}** in **${FAME_GAME_NAME}**...`).setColor(0x5865F2).setThumbnail(avatar)] });
      const result = await findUserInServers(userId);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      if (!result.found) {
        stats.failedSnipes++;
        await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("Snipe Failed").setDescription(`Could not find **${actualUsername}**`).addFields({ name: "Servers Scanned", value: `${result.scanned}`, inline: true }).setColor(0xFF0000).setThumbnail(avatar)] });
        return;
      }
      stats.successfulSnipes++;
      const joinLink = `https://www.roblox.com/games/${FAME_GAME_ID}?jobId=${result.jobId}`;
      await interaction.editReply({
        embeds: [new EmbedBuilder().setTitle("Player Found!").setDescription(`Found **${actualUsername}** in **${FAME_GAME_NAME}**`).addFields({ name: "Server", value: `${result.players}/${result.maxPlayers} players`, inline: true }, { name: "Time", value: `${elapsed}s`, inline: true }).setColor(0x00FF00).setThumbnail(avatar).setImage(avatar)],
        components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel("Join Game").setURL(joinLink).setStyle(ButtonStyle.Link))]
      });
    } catch (error) {
      stats.failedSnipes++;
      await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("Error").setDescription(error.message).setColor(0xFF0000)] });
    }
    return;
  }

  // STATS COMMAND
  if (interaction.commandName === "stats") {
    const uptime = Math.floor((Date.now() - stats.startTime) / 1000);
    const successRate = stats.totalSnipes > 0 ? ((stats.successfulSnipes / stats.totalSnipes) * 100).toFixed(2) : 0;
    await interaction.reply({
      embeds: [new EmbedBuilder().setTitle("Bot Statistics").addFields(
        { name: "Uptime", value: `${Math.floor(uptime / 86400)}d ${Math.floor((uptime % 86400) / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`, inline: true },
        { name: "Total Snipes", value: `${stats.totalSnipes}`, inline: true },
        { name: "Successful", value: `${stats.successfulSnipes}`, inline: true },
        { name: "Failed", value: `${stats.failedSnipes}`, inline: true },
        { name: "Success Rate", value: `${successRate}%`, inline: true },
        { name: "Blocked Invites", value: `${stats.blockedInvites}`, inline: true },
        { name: "Total Timeouts", value: `${stats.totalTimeouts}`, inline: true }
      ).setColor(0x5865F2)]
    });
    return;
  }

  // TIMEOUT COMMAND
  if (interaction.commandName === "timeout") {
    const targetUser = interaction.options.getUser("user");
    const minutes = interaction.options.getInteger("minutes");
    const reason = interaction.options.getString("reason") || "No reason";
    try {
      const member = await interaction.guild.members.fetch(targetUser.id);
      if (!member.moderatable) {
        await interaction.reply({ embeds: [new EmbedBuilder().setTitle("Error").setDescription("Cannot timeout this user.").setColor(0xFF0000)], ephemeral: true });
        return;
      }
      await member.timeout(minutes * 60 * 1000, reason);
      stats.totalTimeouts++;
      stats.manualTimeouts++;
      await interaction.reply({ embeds: [new EmbedBuilder().setTitle("User Timed Out").setDescription(`${targetUser.tag} timed out for ${minutes} minutes`).addFields({ name: "Reason", value: reason }, { name: "Moderator", value: interaction.user.tag }).setColor(0xFFA500)] });
      await sendToLogChannel(interaction.guild, "Timeout (Manual)", `${targetUser.tag} was timed out by ${interaction.user.tag}`, 0xFFA500, [
        { name: "User", value: targetUser.tag }, { name: "Moderator", value: interaction.user.tag }, { name: "Duration", value: `${minutes} minutes` }, { name: "Reason", value: reason }
      ]);
    } catch (error) {
      await interaction.reply({ embeds: [new EmbedBuilder().setTitle("Error").setDescription(error.message).setColor(0xFF0000)], ephemeral: true });
    }
    return;
  }

  // UNTIMEOUT COMMAND
  if (interaction.commandName === "untimeout") {
    const targetUser = interaction.options.getUser("user");
    try {
      const member = await interaction.guild.members.fetch(targetUser.id);
      await member.timeout(null);
      await interaction.reply({ embeds: [new EmbedBuilder().setTitle("Timeout Removed").setDescription(`${targetUser.tag} is no longer timed out`).addFields({ name: "Moderator", value: interaction.user.tag }).setColor(0x00FF00)] });
      await sendToLogChannel(interaction.guild, "Timeout Removed", `${targetUser.tag} had timeout removed by ${interaction.user.tag}`, 0x00FF00);
    } catch (error) {
      await interaction.reply({ embeds: [new EmbedBuilder().setTitle("Error").setDescription(error.message).setColor(0xFF0000)], ephemeral: true });
    }
    return;
  }

  // ALLOWSERVER COMMAND
  if (interaction.commandName === "allowserver") {
    const serverId = interaction.options.getString("serverid");
    if (ALLOWED_SERVER_IDS.includes(serverId)) {
      await interaction.reply({ embeds: [new EmbedBuilder().setTitle("Already Allowed").setDescription(`Server ${serverId} is already allowed.`).setColor(0xFFA500)], ephemeral: true });
      return;
    }
    ALLOWED_SERVER_IDS.push(serverId);
    await interaction.reply({ embeds: [new EmbedBuilder().setTitle("Server Added").setDescription(`Server ${serverId} has been added to allowlist.`).setColor(0x00FF00)], ephemeral: true });
    return;
  }

  // ALLOWLIST COMMAND
  if (interaction.commandName === "allowlist") {
    let list = "";
    for (const id of ALLOWED_SERVER_IDS) {
      let name = "Unknown";
      try { const g = await client.guilds.fetch(id); name = g.name; } catch(e) {}
      list += `${name} (${id})\n`;
    }
    await interaction.reply({ embeds: [new EmbedBuilder().setTitle("Allowed Servers").setDescription(list || "None").setColor(0x5865F2)], ephemeral: true });
    return;
  }

  // REMOVEALLOWED COMMAND
  if (interaction.commandName === "removeallowed") {
    const serverId = interaction.options.getString("serverid");
    const index = ALLOWED_SERVER_IDS.indexOf(serverId);
    if (index === -1) {
      await interaction.reply({ embeds: [new EmbedBuilder().setTitle("Not Found").setDescription(`Server ${serverId} not in allowlist.`).setColor(0xFF0000)], ephemeral: true });
      return;
    }
    ALLOWED_SERVER_IDS.splice(index, 1);
    await interaction.reply({ embeds: [new EmbedBuilder().setTitle("Server Removed").setDescription(`Server ${serverId} removed from allowlist.`).setColor(0xFFA500)], ephemeral: true });
    return;
  }

  // CLEARWARNINGS COMMAND
  if (interaction.commandName === "clearwarnings") {
    const targetUser = interaction.options.getUser("user");
    if (userViolations.has(targetUser.id)) {
      userViolations.delete(targetUser.id);
      await interaction.reply({ embeds: [new EmbedBuilder().setTitle("Warnings Cleared").setDescription(`Cleared warnings for ${targetUser.tag}.`).setColor(0x00FF00)], ephemeral: true });
    } else {
      await interaction.reply({ embeds: [new EmbedBuilder().setTitle("No Warnings").setDescription(`${targetUser.tag} has no warnings.`).setColor(0xFFA500)], ephemeral: true });
    }
    return;
  }

  // WARNINGS COMMAND
  if (interaction.commandName === "warnings") {
    const targetUser = interaction.options.getUser("user");
    const violations = userViolations.get(targetUser.id) || 0;
    await interaction.reply({ embeds: [new EmbedBuilder().setTitle("User Warnings").setDescription(`${targetUser.tag} has ${violations}/3 warnings.`).setColor(violations >= 3 ? 0xFF0000 : 0xFFA500)], ephemeral: true });
    return;
  }
});

process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

client.login(TOKEN);
