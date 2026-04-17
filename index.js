const http = require("http");
const {
  ActionRowBuilder,
  ApplicationIntegrationType,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  InteractionContextType,
  Partials,
  PermissionsBitField,
  REST,
  Routes,
  SlashCommandBuilder,
  WebhookClient,
} = require("discord.js");

const TOKEN = process.env.TOKEN || process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID || null;
const PORT = process.env.PORT || 3000;
const FAME_GAME_ID = process.env.FAME_GAME_ID || "121157515767845";
const FAME_GAME_NAME = process.env.FAME_GAME_NAME || "Fame";
const WEBHOOK_URL = process.env.WEBHOOK_URL || null;
const FOUNDER_ROLE_ID = process.env.FOUNDER_ROLE_ID || null;
const LOG_CHANNEL_NAME = process.env.LOG_CHANNEL_NAME || "discord-logs";
const DEFAULT_ALLOWED_SERVER_IDS = ["1428878035926388809"];
const ALLOWED_SERVER_IDS = (process.env.ALLOWED_SERVER_IDS || DEFAULT_ALLOWED_SERVER_IDS.join(","))
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

if (!TOKEN) {
  console.error("Missing TOKEN or DISCORD_TOKEN environment variable");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration,
  ],
  partials: [Partials.Channel],
});

const userViolations = new Map();

const stats = {
  totalSnipes: 0,
  successfulSnipes: 0,
  failedSnipes: 0,
  startTime: Date.now(),
  apiCalls: 0,
  rateLimits: 0,
  blockedInvites: 0,
  totalTimeouts: 0,
  autoTimeouts: 0,
  manualTimeouts: 0,
};

let webhook = null;

if (WEBHOOK_URL) {
  try {
    webhook = new WebhookClient({ url: WEBHOOK_URL });
    console.log("Webhook logging enabled");
  } catch (error) {
    console.error("Webhook failed:", error.message);
  }
}

http
  .createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "application/json");

    if (req.url === "/stats") {
      const uptime = Math.floor((Date.now() - stats.startTime) / 1000);
      const successRate = stats.totalSnipes > 0 ? ((stats.successfulSnipes / stats.totalSnipes) * 100).toFixed(2) : "0.00";

      res.end(
        JSON.stringify({
          status: "online",
          bot: client.user?.tag || "starting",
          game: FAME_GAME_NAME,
          uptime,
          totalSnipes: stats.totalSnipes,
          successfulSnipes: stats.successfulSnipes,
          failedSnipes: stats.failedSnipes,
          successRate: `${successRate}%`,
          apiCalls: stats.apiCalls,
          rateLimits: stats.rateLimits,
          blockedInvites: stats.blockedInvites,
          totalTimeouts: stats.totalTimeouts,
        })
      );
      return;
    }

    res.end(
      JSON.stringify({
        status: "online",
        message: `${FAME_GAME_NAME} Sniper Bot`,
      })
    );
  })
  .listen(PORT, () => console.log(`Web service listening on port ${PORT}`));

let lastRequest = 0;
const REQUEST_DELAY = 250;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForRateLimit() {
  const now = Date.now();
  const wait = lastRequest + REQUEST_DELAY - now;
  if (wait > 0) await sleep(wait);
  lastRequest = Date.now();
  stats.apiCalls += 1;
}

async function robloxFetch(url, options = {}) {
  await waitForRateLimit();

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (response.status === 429) {
    stats.rateLimits += 1;
    await sleep(2500);
    return robloxFetch(url, options);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Roblox API error ${response.status}${text ? `: ${text}` : ""}`);
  }

  return response.json();
}

async function getRobloxUser(username) {
  const data = await robloxFetch("https://users.roblox.com/v1/usernames/users", {
    method: "POST",
    body: JSON.stringify({
      usernames: [username],
      excludeBannedUsers: false,
    }),
  });

  return data.data?.[0] || null;
}

async function getUserAvatar(userId, size = "720x720") {
  const params = new URLSearchParams({
    userIds: String(userId),
    size,
    format: "Png",
    isCircular: "false",
  });

  const data = await robloxFetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?${params}`);
  return data.data?.[0]?.imageUrl || null;
}

async function getTokenAvatars(tokens) {
  const requests = tokens.map((token) => ({
    requestId: token,
    type: "AvatarHeadShot",
    targetId: 0,
    token,
    format: "png",
    size: "48x48",
  }));

  const results = [];

  for (let index = 0; index < requests.length; index += 100) {
    const chunk = requests.slice(index, index + 100);
    const data = await robloxFetch("https://thumbnails.roblox.com/v1/batch", {
      method: "POST",
      body: JSON.stringify(chunk),
    });
    results.push(...(data.data || []));
  }

  return results;
}

async function findUserInServers(userId, maxPages = 25) {
  const targetAvatar = await getUserAvatar(userId, "48x48");

  if (!targetAvatar) {
    return {
      found: false,
      scanned: 0,
      playersScanned: 0,
      reason: "Could not get the player's Roblox avatar.",
    };
  }

  let cursor = null;
  let serversScanned = 0;
  let playersScanned = 0;

  for (let page = 0; page < maxPages; page += 1) {
    const params = new URLSearchParams({
      limit: "100",
      sortOrder: "Desc",
      excludeFullGames: "false",
    });

    if (cursor) {
      params.set("cursor", cursor);
    }

    const data = await robloxFetch(`https://games.roblox.com/v1/games/${FAME_GAME_ID}/servers/Public?${params}`);
    const servers = data.data || [];

    if (servers.length === 0) break;

    for (const server of servers) {
      serversScanned += 1;
      const tokens = server.playerTokens || [];
      playersScanned += tokens.length;

      if (tokens.length === 0) continue;

      const avatars = await getTokenAvatars(tokens);
      const match = avatars.find((avatar) => avatar.imageUrl === targetAvatar);

      if (match) {
        return {
          found: true,
          jobId: server.id,
          players: server.playing,
          maxPlayers: server.maxPlayers,
          scanned: serversScanned,
          playersScanned,
        };
      }
    }

    cursor = data.nextPageCursor;
    if (!cursor) break;
  }

  return {
    found: false,
    scanned: serversScanned,
    playersScanned,
  };
}

async function hasFounderRole(interaction) {
  if (!FOUNDER_ROLE_ID || !interaction.guild) return false;
  const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
  return Boolean(member?.roles.cache.has(FOUNDER_ROLE_ID));
}

async function sendToLogChannel(guild, title, description, color = 0x5865f2, fields = [], thumbnail = null) {
  if (!guild) return;

  try {
    const logChannel = guild.channels.cache.find((channel) => channel.name === LOG_CHANNEL_NAME && channel.type === 0);
    if (!logChannel) return;

    const embed = new EmbedBuilder().setTitle(title).setDescription(description).setColor(color).setTimestamp();
    if (fields.length > 0) embed.addFields(fields);
    if (thumbnail) embed.setThumbnail(thumbnail);

    await logChannel.send({ embeds: [embed] });
  } catch (error) {
    console.error("[LOG] Error:", error.message);
  }
}

async function logToWebhook(title, description, type = "INFO", fields = [], thumbnail = null) {
  if (!webhook) return;

  try {
    const colors = {
      SUCCESS: 0x00ff00,
      ERROR: 0xff0000,
      WARNING: 0xffa500,
      PROTECTION: 0x9b59b6,
      INFO: 0x2b2d31,
    };
    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor(colors[type] || colors.INFO)
      .setTimestamp();

    if (fields.length > 0) embed.addFields(fields);
    if (thumbnail) embed.setThumbnail(thumbnail);

    await webhook.send({ embeds: [embed] });
  } catch (error) {
    console.error("Webhook error:", error.message);
  }
}

const inviteRegex = /(?:https?:\/\/)?(?:www\.)?(?:discord\.(?:gg|com\/invite)\/)([a-zA-Z0-9\-_]+)/gi;

async function isInviteAllowed(inviteCode) {
  try {
    const invite = await client.fetchInvite(inviteCode).catch(() => null);
    if (!invite?.guild?.id) return false;
    return ALLOWED_SERVER_IDS.includes(invite.guild.id);
  } catch {
    return false;
  }
}

function formatUptime(seconds) {
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function buildCommands() {
  const commandContexts = [InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel];
  const installTypes = [ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall];

  return [
    new SlashCommandBuilder()
      .setName("snipe")
      .setDescription(`Find a player in ${FAME_GAME_NAME}`)
      .addStringOption((option) => option.setName("username").setDescription("Roblox username").setRequired(true))
      .addIntegerOption((option) => option.setName("max_pages").setDescription("Server pages to scan, 1-100").setRequired(false).setMinValue(1).setMaxValue(100))
      .setIntegrationTypes(installTypes)
      .setContexts(commandContexts)
      .toJSON(),
    new SlashCommandBuilder()
      .setName("stats")
      .setDescription("View bot statistics")
      .setIntegrationTypes(installTypes)
      .setContexts(commandContexts)
      .toJSON(),
    new SlashCommandBuilder()
      .setName("timeout")
      .setDescription("[MOD] Timeout a user")
      .addUserOption((option) => option.setName("user").setDescription("User to timeout").setRequired(true))
      .addIntegerOption((option) => option.setName("minutes").setDescription("Duration, 1-60").setRequired(true).setMinValue(1).setMaxValue(60))
      .addStringOption((option) => option.setName("reason").setDescription("Reason").setRequired(false))
      .setDefaultMemberPermissions(PermissionsBitField.Flags.ModerateMembers)
      .toJSON(),
    new SlashCommandBuilder()
      .setName("untimeout")
      .setDescription("[MOD] Remove timeout")
      .addUserOption((option) => option.setName("user").setDescription("User to untimeout").setRequired(true))
      .setDefaultMemberPermissions(PermissionsBitField.Flags.ModerateMembers)
      .toJSON(),
    new SlashCommandBuilder()
      .setName("allowserver")
      .setDescription("[ADMIN] Add allowed Discord invite server")
      .addStringOption((option) => option.setName("serverid").setDescription("Server ID").setRequired(true))
      .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
      .toJSON(),
    new SlashCommandBuilder()
      .setName("allowlist")
      .setDescription("[ADMIN] View allowed Discord invite servers")
      .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
      .toJSON(),
    new SlashCommandBuilder()
      .setName("removeallowed")
      .setDescription("[ADMIN] Remove allowed Discord invite server")
      .addStringOption((option) => option.setName("serverid").setDescription("Server ID").setRequired(true))
      .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
      .toJSON(),
    new SlashCommandBuilder()
      .setName("clearwarnings")
      .setDescription("[ADMIN] Clear user invite warnings")
      .addUserOption((option) => option.setName("user").setDescription("User").setRequired(true))
      .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
      .toJSON(),
    new SlashCommandBuilder()
      .setName("warnings")
      .setDescription("[ADMIN] View user invite warnings")
      .addUserOption((option) => option.setName("user").setDescription("User").setRequired(true))
      .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
      .toJSON(),
    new SlashCommandBuilder()
      .setName("channelid")
      .setDescription("[FOUNDER] Get the current channel ID")
      .setIntegrationTypes([ApplicationIntegrationType.GuildInstall])
      .setContexts([InteractionContextType.Guild])
      .toJSON(),
  ];
}

async function registerCommands() {
  const commands = buildCommands();

  if (CLIENT_ID) {
    const rest = new REST({ version: "10" }).setToken(TOKEN);
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log("Global slash commands registered");
    return;
  }

  for (const guild of client.guilds.cache.values()) {
    await guild.commands.set(commands);
  }

  console.log(`Guild slash commands registered in ${client.guilds.cache.size} server(s)`);
}

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  console.log(`Game: ${FAME_GAME_NAME} (${FAME_GAME_ID})`);

  try {
    await registerCommands();
  } catch (error) {
    console.error("Command registration failed:", error);
  }
});

client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;

  const matches = message.content.match(inviteRegex);
  if (!matches) return;

  for (const match of matches) {
    const inviteCode = match.split("/").pop();
    const allowed = await isInviteAllowed(inviteCode);

    if (allowed) continue;

    stats.blockedInvites += 1;

    try {
      await message.delete();

      const violations = (userViolations.get(message.author.id) || 0) + 1;
      userViolations.set(message.author.id, violations);

      if (violations >= 3) {
        const member = await message.guild.members.fetch(message.author.id).catch(() => null);

        if (member?.moderatable) {
          await member.timeout(10 * 60 * 1000, `Automatic timeout: Invite violations (${violations})`);
          stats.totalTimeouts += 1;
          stats.autoTimeouts += 1;

          await sendToLogChannel(
            message.guild,
            "User Timed Out (Auto)",
            `${message.author.tag} was automatically timed out.`,
            0xffa500,
            [
              { name: "User", value: message.author.tag, inline: true },
              { name: "User ID", value: message.author.id, inline: true },
              { name: "Action By", value: "Bot (Automatic)", inline: true },
              { name: "Violations", value: `${violations}/3`, inline: true },
              { name: "Duration", value: "10 minutes", inline: true },
            ],
            message.author.displayAvatarURL()
          );

          await logToWebhook("User Timed Out (Auto)", `${message.author.tag} was automatically timed out.`, "PROTECTION");
          setTimeout(() => userViolations.delete(message.author.id), 10 * 60 * 1000);
        }
      } else {
        await sendToLogChannel(
          message.guild,
          "Invite Warning",
          `${message.author.tag} received a warning.`,
          0xffa500,
          [
            { name: "User", value: message.author.tag, inline: true },
            { name: "User ID", value: message.author.id, inline: true },
            { name: "Violation", value: `${violations}/3`, inline: true },
            { name: "Action", value: "Warning issued", inline: true },
          ],
          message.author.displayAvatarURL()
        );
      }

      const warningMsg = await message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle("Invite Blocked")
            .setDescription(`${message.author}, invite links to other servers are not allowed.`)
            .setColor(0xff0000),
        ],
      });

      setTimeout(() => warningMsg.delete().catch(() => {}), 5000);
    } catch (error) {
      console.error("[PROTECTION] Error:", error.message);
    }

    break;
  }
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "channelid") {
    if (!(await hasFounderRole(interaction))) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Access Denied")
            .setDescription("This command is only available to the Founder.")
            .setColor(0xff0000),
        ],
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("Channel ID Information")
          .setDescription(`Channel: **#${interaction.channel?.name || "unknown"}**`)
          .addFields(
            { name: "Channel ID", value: `\`${interaction.channelId}\``, inline: true },
            { name: "Channel Name", value: `#${interaction.channel?.name || "unknown"}`, inline: true }
          )
          .setColor(0x5865f2)
          .setFooter({ text: `Requested by ${interaction.user.tag}` }),
      ],
      ephemeral: true,
    });
    return;
  }

  if (interaction.commandName === "snipe") {
    const startTime = Date.now();
    stats.totalSnipes += 1;

    await interaction.deferReply();

    try {
      const username = interaction.options.getString("username", true).trim();
      const maxPages = interaction.options.getInteger("max_pages") || 25;
      const userData = await getRobloxUser(username);

      if (!userData) {
        stats.failedSnipes += 1;
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle("User Not Found")
              .setDescription(`Could not find "${username}" on Roblox.`)
              .setColor(0xff0000),
          ],
        });
        return;
      }

      const avatar = await getUserAvatar(userData.id);

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Searching...")
            .setDescription(`Looking for **${userData.name}** in **${FAME_GAME_NAME}** public servers...`)
            .setColor(0x5865f2)
            .setThumbnail(avatar),
        ],
      });

      const result = await findUserInServers(userData.id, maxPages);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

      if (!result.found) {
        stats.failedSnipes += 1;
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle("Snipe Failed")
              .setDescription(result.reason || `Could not find **${userData.name}** in the public servers scanned.`)
              .addFields(
                { name: "Servers Scanned", value: `${result.scanned}`, inline: true },
                { name: "Player Slots Scanned", value: `${result.playersScanned || 0}`, inline: true },
                { name: "Pages Scanned", value: `${maxPages}`, inline: true }
              )
              .setColor(0xff0000)
              .setThumbnail(avatar),
          ],
        });
        return;
      }

      stats.successfulSnipes += 1;

      const gamePage = `https://www.roblox.com/games/${FAME_GAME_ID}`;
      const deepLink = `roblox://experiences/start?placeId=${FAME_GAME_ID}&gameInstanceId=${result.jobId}`;

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Player Found!")
            .setDescription(`Found **${userData.name}** in **${FAME_GAME_NAME}**.`)
            .addFields(
              { name: "Server", value: `${result.players}/${result.maxPlayers} players`, inline: true },
              { name: "Time", value: `${elapsed}s`, inline: true },
              { name: "Servers Scanned", value: `${result.scanned}`, inline: true },
              { name: "Job ID", value: `\`${result.jobId}\`` },
              { name: "Roblox Join Link", value: `\`${deepLink}\`` }
            )
            .setColor(0x00ff00)
            .setThumbnail(avatar)
            .setFooter({ text: "Copy the Roblox Join Link if the button only opens the game page." }),
        ],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel("Open Game Page").setURL(gamePage).setStyle(ButtonStyle.Link)
          ),
        ],
      });
    } catch (error) {
      stats.failedSnipes += 1;
      console.error(error);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Error")
            .setDescription("Something went wrong while scanning Roblox servers. Try again in a minute or use a lower max_pages value.")
            .setColor(0xff0000),
        ],
      });
    }
    return;
  }

  if (interaction.commandName === "stats") {
    const uptime = Math.floor((Date.now() - stats.startTime) / 1000);
    const successRate = stats.totalSnipes > 0 ? ((stats.successfulSnipes / stats.totalSnipes) * 100).toFixed(2) : "0.00";

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("Bot Statistics")
          .addFields(
            { name: "Uptime", value: formatUptime(uptime), inline: true },
            { name: "Total Snipes", value: `${stats.totalSnipes}`, inline: true },
            { name: "Successful", value: `${stats.successfulSnipes}`, inline: true },
            { name: "Failed", value: `${stats.failedSnipes}`, inline: true },
            { name: "Success Rate", value: `${successRate}%`, inline: true },
            { name: "API Calls", value: `${stats.apiCalls}`, inline: true },
            { name: "Rate Limits", value: `${stats.rateLimits}`, inline: true },
            { name: "Blocked Invites", value: `${stats.blockedInvites}`, inline: true },
            { name: "Total Timeouts", value: `${stats.totalTimeouts}`, inline: true }
          )
          .setColor(0x5865f2),
      ],
    });
    return;
  }

  if (interaction.commandName === "timeout") {
    const targetUser = interaction.options.getUser("user", true);
    const minutes = interaction.options.getInteger("minutes", true);
    const reason = interaction.options.getString("reason") || "No reason provided";

    try {
      const member = await interaction.guild.members.fetch(targetUser.id);
      if (!member.moderatable) {
        await interaction.reply({
          embeds: [new EmbedBuilder().setTitle("Error").setDescription("Cannot timeout this user.").setColor(0xff0000)],
          ephemeral: true,
        });
        return;
      }

      await member.timeout(minutes * 60 * 1000, reason);
      stats.totalTimeouts += 1;
      stats.manualTimeouts += 1;

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("User Timed Out")
            .setDescription(`${targetUser.tag} timed out for ${minutes} minutes.`)
            .addFields({ name: "Reason", value: reason }, { name: "Moderator", value: interaction.user.tag })
            .setColor(0xffa500),
        ],
      });

      await sendToLogChannel(
        interaction.guild,
        "User Timed Out (Manual)",
        `${targetUser.tag} was manually timed out.`,
        0xffa500,
        [
          { name: "User", value: targetUser.tag, inline: true },
          { name: "User ID", value: targetUser.id, inline: true },
          { name: "Moderator", value: interaction.user.tag, inline: true },
          { name: "Duration", value: `${minutes} minutes`, inline: true },
          { name: "Reason", value: reason, inline: false },
        ],
        targetUser.displayAvatarURL()
      );
    } catch (error) {
      await interaction.reply({
        embeds: [new EmbedBuilder().setTitle("Error").setDescription(error.message).setColor(0xff0000)],
        ephemeral: true,
      });
    }
    return;
  }

  if (interaction.commandName === "untimeout") {
    const targetUser = interaction.options.getUser("user", true);

    try {
      const member = await interaction.guild.members.fetch(targetUser.id);
      await member.timeout(null);

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Timeout Removed")
            .setDescription(`${targetUser.tag} is no longer timed out.`)
            .addFields({ name: "Moderator", value: interaction.user.tag })
            .setColor(0x00ff00),
        ],
      });

      await sendToLogChannel(
        interaction.guild,
        "Timeout Removed",
        `${targetUser.tag} had timeout removed.`,
        0x00ff00,
        [
          { name: "User", value: targetUser.tag, inline: true },
          { name: "User ID", value: targetUser.id, inline: true },
          { name: "Moderator", value: interaction.user.tag, inline: true },
        ],
        targetUser.displayAvatarURL()
      );
    } catch (error) {
      await interaction.reply({
        embeds: [new EmbedBuilder().setTitle("Error").setDescription(error.message).setColor(0xff0000)],
        ephemeral: true,
      });
    }
    return;
  }

  if (interaction.commandName === "allowserver") {
    const serverId = interaction.options.getString("serverid", true).trim();

    if (ALLOWED_SERVER_IDS.includes(serverId)) {
      await interaction.reply({
        embeds: [new EmbedBuilder().setTitle("Already Allowed").setDescription(`Server ${serverId} is already allowed.`).setColor(0xffa500)],
        ephemeral: true,
      });
      return;
    }

    ALLOWED_SERVER_IDS.push(serverId);
    await interaction.reply({
      embeds: [new EmbedBuilder().setTitle("Server Added").setDescription(`Server ${serverId} has been added to the allowlist.`).setColor(0x00ff00)],
      ephemeral: true,
    });
    return;
  }

  if (interaction.commandName === "allowlist") {
    let list = "";

    for (const id of ALLOWED_SERVER_IDS) {
      let name = "Unknown";
      try {
        const guild = await client.guilds.fetch(id);
        name = guild.name;
      } catch {}
      list += `${name} (${id})\n`;
    }

    await interaction.reply({
      embeds: [new EmbedBuilder().setTitle("Allowed Servers").setDescription(list || "None").setColor(0x5865f2)],
      ephemeral: true,
    });
    return;
  }

  if (interaction.commandName === "removeallowed") {
    const serverId = interaction.options.getString("serverid", true).trim();
    const index = ALLOWED_SERVER_IDS.indexOf(serverId);

    if (index === -1) {
      await interaction.reply({
        embeds: [new EmbedBuilder().setTitle("Not Found").setDescription(`Server ${serverId} is not in the allowlist.`).setColor(0xff0000)],
        ephemeral: true,
      });
      return;
    }

    ALLOWED_SERVER_IDS.splice(index, 1);
    await interaction.reply({
      embeds: [new EmbedBuilder().setTitle("Server Removed").setDescription(`Server ${serverId} removed from the allowlist.`).setColor(0xffa500)],
      ephemeral: true,
    });
    return;
  }

  if (interaction.commandName === "clearwarnings") {
    const targetUser = interaction.options.getUser("user", true);

    if (userViolations.has(targetUser.id)) {
      userViolations.delete(targetUser.id);
      await interaction.reply({
        embeds: [new EmbedBuilder().setTitle("Warnings Cleared").setDescription(`Cleared warnings for ${targetUser.tag}.`).setColor(0x00ff00)],
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      embeds: [new EmbedBuilder().setTitle("No Warnings").setDescription(`${targetUser.tag} has no warnings.`).setColor(0xffa500)],
      ephemeral: true,
    });
    return;
  }

  if (interaction.commandName === "warnings") {
    const targetUser = interaction.options.getUser("user", true);
    const violations = userViolations.get(targetUser.id) || 0;

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("User Warnings")
          .setDescription(`${targetUser.tag} has ${violations}/3 warnings.`)
          .setColor(violations >= 3 ? 0xff0000 : 0xffa500),
      ],
      ephemeral: true,
    });
  }
});

process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

client.login(TOKEN);
