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
const ROBLOX_COOKIE = process.env.ROBLOX_COOKIE || null;
const FOUNDER_ROLE_ID = "1482560426972549232";

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

const stats = {
  totalSnipes: 0,
  successfulSnipes: 0,
  failedSnipes: 0,
  startTime: Date.now(),
  apiCalls: 0,
  rateLimits: 0,
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

// HTTP Server
http
  .createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/stats") {
      const uptime = Math.floor((Date.now() - stats.startTime) / 1000);
      const successRate = stats.totalSnipes > 0 ? ((stats.successfulSnipes / stats.totalSnipes) * 100).toFixed(2) : "0.00";
      res.end(JSON.stringify({
        status: "online",
        bot: client.user?.tag || "starting",
        game: FAME_GAME_NAME,
        uptime,
        totalSnipes: stats.totalSnipes,
        successfulSnipes: stats.successfulSnipes,
        failedSnipes: stats.failedSnipes,
        successRate: `${successRate}%`,
      }));
      return;
    }
    res.end(JSON.stringify({ status: "online", message: `${FAME_GAME_NAME} Sniper Bot` }));
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
  const cookieHeader = ROBLOX_COOKIE ? { Cookie: `.ROBLOSECURITY=${ROBLOX_COOKIE}` } : {};
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...cookieHeader, ...options.headers },
  });

  if (response.status === 429) {
    stats.rateLimits += 1;
    await sleep(2500);
    return robloxFetch(url, options);
  }
  if (!response.ok) throw new Error(`Roblox API error ${response.status}`);
  return response.json();
}

// ─── Roblox Snipe Functions (kept minimal & stable) ───
async function getRobloxUser(username) {
  const data = await robloxFetch("https://users.roblox.com/v1/usernames/users", {
    method: "POST",
    body: JSON.stringify({ usernames: [username], excludeBannedUsers: false }),
  });
  return data.data?.[0] || null;
}

async function getUserAvatar(userId) {
  const params = new URLSearchParams({ userIds: String(userId), size: "48x48", format: "Png", isCircular: "false" });
  const data = await robloxFetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?${params}`);
  return data.data?.[0]?.imageUrl || null;
}

async function getTokenAvatars(tokens) {
  const requests = tokens.map(token => ({
    requestId: token,
    type: "AvatarHeadShot",
    targetId: 0,
    token,
    format: "png",
    size: "48x48",
  }));

  const results = [];
  for (let i = 0; i < requests.length; i += 50) {
    const chunk = requests.slice(i, i + 50);
    try {
      const data = await robloxFetch("https://thumbnails.roblox.com/v1/batch", {
        method: "POST",
        body: JSON.stringify(chunk),
      });
      results.push(...(data.data || []));
    } catch (e) {
      console.log(`[Avatar Error] ${e.message}`);
    }
  }
  return results;
}

async function findUserInServers(userId, username, maxPages = 8) {
  const targetAvatar = await getUserAvatar(userId).catch(() => null);
  if (!targetAvatar) return { found: false, scanned: 0, playersScanned: 0 };

  let cursor = null;
  let serversScanned = 0;
  let playersScanned = 0;
  const lowerName = username.toLowerCase();

  for (let page = 0; page < maxPages; page++) {
    try {
      const params = new URLSearchParams({ limit: "100", sortOrder: "Desc", excludeFullGames: "false" });
      if (cursor) params.set("cursor", cursor);

      const data = await robloxFetch(`https://games.roblox.com/v1/games/${FAME_GAME_ID}/servers/Public?${params}`);
      const servers = data.data || [];
      if (servers.length === 0) break;

      for (const server of servers) {
        serversScanned++;
        const userIds = server.playerIds || server.playerUserIds || [];
        const tokens = server.playerTokens || [];

        playersScanned += Math.max(userIds.length, tokens.length);

        if (userIds.includes(Number(userId)) || userIds.includes(String(userId))) {
          return { found: true, jobId: server.id, players: server.playing, maxPlayers: server.maxPlayers, scanned: serversScanned, playersScanned };
        }

        if (tokens.length === 0) continue;

        const avatars = await getTokenAvatars(tokens);
        if (avatars.find(a => a.imageUrl === targetAvatar) || 
            avatars.find(a => a.requestId && a.requestId.toLowerCase().includes(lowerName))) {
          return { found: true, jobId: server.id, players: server.playing, maxPlayers: server.maxPlayers, scanned: serversScanned, playersScanned };
        }
      }

      cursor = data.nextPageCursor;
      if (!cursor) break;
    } catch (err) {
      console.error(`[SCAN ERROR]`, err.message);
      break;
    }
  }
  return { found: false, scanned: serversScanned, playersScanned };
}

// ==================== COMMANDS ====================
function buildCommands() {
  return [
    new SlashCommandBuilder()
      .setName("snipe")
      .setDescription(`Find a player in ${FAME_GAME_NAME}`)
      .addStringOption(option => option.setName("username").setDescription("Roblox username").setRequired(true))
      .addBooleanOption(option => option.setName("deepsearch").setDescription("Enable deep search").setRequired(false))
      .toJSON(),

    new SlashCommandBuilder()
      .setName("roleall")
      .setDescription("Give a role to all members (Founder only)")
      .addRoleOption(option => option.setName("role").setDescription("Role to give").setRequired(true))
      .addBooleanOption(option => option.setName("bots").setDescription("Also give to bots?").setRequired(true))
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
  } else {
    for (const guild of client.guilds.cache.values()) {
      await guild.commands.set(commands);
    }
  }
  console.log("Commands registered");
}

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await registerCommands().catch(console.error);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // ==================== SNIPE COMMAND ====================
  if (interaction.commandName === "snipe") {
    const startTime = Date.now();
    stats.totalSnipes += 1;
    await interaction.deferReply();

    try {
      const username = interaction.options.getString("username", true).trim();
      const deepSearch = interaction.options.getBoolean("deepsearch") || false;
      const maxPages = deepSearch ? 25 : 8;

      const userData = await getRobloxUser(username);
      if (!userData) {
        stats.failedSnipes += 1;
        return interaction.editReply({ embeds: [new EmbedBuilder().setTitle("User Not Found").setDescription(`Could not find "${username}" on Roblox.`).setColor(0xff0000)] });
      }

      const [avatar] = await Promise.all([getUserAvatar(userData.id)]);

      const profileUrl = `https://www.roblox.com/users/${userData.id}/profile`;

      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setTitle("🔍 Searching...")
          .setDescription(`Looking for **[${userData.name}](${profileUrl})** in **${FAME_GAME_NAME}**...`)
          .setColor(0x5865f2)
          .setThumbnail(avatar)
          .addFields({ name: "Mode", value: deepSearch ? "Deep Search" : "Fast Search", inline: true })
        ]
      });

      const result = await findUserInServers(userData.id, userData.name, maxPages);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

      if (!result.found) {
        stats.failedSnipes += 1;
        return interaction.editReply({
          embeds: [new EmbedBuilder().setTitle("❌ Snipe Failed").setDescription(`Could not find **[${userData.name}](${profileUrl})**`).setColor(0xff0000).setThumbnail(avatar)]
        });
      }

      stats.successfulSnipes += 1;
      const directJoinLink = `roblox://experiences/start?placeId=${FAME_GAME_ID}&gameInstanceId=${result.jobId}`;

      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setTitle("✅ Player Found!")
          .setDescription(`Found **[${userData.name}](${profileUrl})** in **${FAME_GAME_NAME}**`)
          .addFields(
            { name: "Server", value: `${result.players}/${result.maxPlayers}`, inline: true },
            { name: "Time", value: `${elapsed}s`, inline: true },
            { name: "Job ID", value: `\`${result.jobId}\``, inline: false },
            { name: "Join Link", value: `\`${directJoinLink}\`` }
          )
          .setColor(0x00ff00)
          .setThumbnail(avatar)
        ],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel("🚀 Join Their Server Now").setURL(directJoinLink).setStyle(ButtonStyle.Link),
            new ButtonBuilder().setLabel("Open Game Page").setURL(`https://www.roblox.com/games/${FAME_GAME_ID}`).setStyle(ButtonStyle.Link)
          )
        ]
      });
    } catch (error) {
      stats.failedSnipes += 1;
      console.error("[SNIPE ERROR]", error);
      await interaction.editReply({
        embeds: [new EmbedBuilder().setTitle("⚠️ Error").setDescription("Something went wrong. Try again.").setColor(0xffa500)]
      }).catch(() => {});
    }
  }

  // ==================== ROLEALL COMMAND ====================
  if (interaction.commandName === "roleall") {
    const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    if (!member || !member.roles.cache.has(FOUNDER_ROLE_ID)) {
      return interaction.reply({
        embeds: [new EmbedBuilder().setTitle("Access Denied").setDescription("Only the Founder can use this command.").setColor(0xff0000)],
        ephemeral: true
      });
    }

    const role = interaction.options.getRole("role", true);
    const includeBots = interaction.options.getBoolean("bots", true);

    // Show immediate status message
    const statusEmbed = new EmbedBuilder()
      .setTitle("📋 Assigning Roles...")
      .setDescription(`Giving **${role.name}** to all members.\nThis may take some time depending on server size.`)
      .setColor(0x5865f2);

    await interaction.reply({ embeds: [statusEmbed] });

    try {
      const members = await interaction.guild.members.fetch();
      let assigned = 0;
      let skipped = 0;
      const total = members.size;

      for (const [id, m] of members) {
        if (m.user.bot && !includeBots) {
          skipped++;
          continue;
        }

        if (!m.roles.cache.has(role.id)) {
          try {
            await m.roles.add(role.id);
            assigned++;
          } catch (e) {
            skipped++;
          }
        }

        // Update progress every 20 members
        if ((assigned + skipped) % 20 === 0) {
          const progress = Math.floor(((assigned + skipped) / total) * 100);
          await interaction.editReply({
            embeds: [new EmbedBuilder()
              .setTitle("📋 Assigning Roles...")
              .setDescription(`Progress: **${progress}%** (${assigned + skipped}/${total})\nAssigned: ${assigned} | Skipped: ${skipped}`)
              .setColor(0x5865f2)
            ]
          }).catch(() => {});
        }
      }

      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setTitle("✅ Role Assignment Complete")
          .setDescription(`Successfully assigned **${role.name}** to **${assigned}** members.`)
          .addFields(
            { name: "Total Members", value: `${total}`, inline: true },
            { name: "Skipped", value: `${skipped}`, inline: true }
          )
          .setColor(0x00ff00)
        ]
      });

    } catch (error) {
      console.error("[ROLEALL ERROR]", error);
      await interaction.editReply({
        embeds: [new EmbedBuilder().setTitle("❌ Error").setDescription("Failed to assign roles.").setColor(0xff0000)]
      });
    }
  }
});

process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

client.login(TOKEN);
