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

if (!ROBLOX_COOKIE) {
  console.warn("⚠️ ROBLOX_COOKIE is not set. Snipe accuracy will be limited.");
} else {
  console.log("✅ ROBLOX_COOKIE loaded");
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

// HTTP Server
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
    headers: {
      "Content-Type": "application/json",
      ...cookieHeader,
      ...options.headers,
    },
  });

  if (response.status === 429) {
    stats.rateLimits += 1;
    console.log("[RATE LIMIT] Waiting 2.5s...");
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
    body: JSON.stringify({ usernames: [username], excludeBannedUsers: false }),
  });
  return data.data?.[0] || null;
}

async function getUserAvatar(userId) {
  const params = new URLSearchParams({ userIds: String(userId), size: "48x48", format: "Png", isCircular: "false" });
  const data = await robloxFetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?${params}`);
  return data.data?.[0]?.imageUrl || null;
}

async function getUserPresence(userId) {
  try {
    const headers = ROBLOX_COOKIE ? { Cookie: `.ROBLOSECURITY=${ROBLOX_COOKIE}` } : {};
    const data = await robloxFetch("https://presence.roblox.com/v1/presence/users", {
      method: "POST",
      body: JSON.stringify({ userIds: [userId] }),
      headers,
    });
    const p = data.userPresences?.[0];
    if (!p) return null;
    return {
      type: p.userPresenceType,
      rootPlaceId: p.rootPlaceId,
      gameInstanceId: p.gameId,
      lastOnline: p.lastOnline,
    };
  } catch {
    return null;
  }
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
  for (let i = 0; i < requests.length; i += 50) {   // Smaller batch = more stable
    const chunk = requests.slice(i, i + 50);
    try {
      const data = await robloxFetch("https://thumbnails.roblox.com/v1/batch", {
        method: "POST",
        body: JSON.stringify(chunk),
      });
      results.push(...(data.data || []));
    } catch (e) {
      console.log(`[Avatar Batch Error] ${e.message}`);
    }
  }
  return results;
}

async function findUserInServers(userId, username, maxPages = 8) {
  const targetAvatar = await getUserAvatar(userId).catch(() => null);
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
          return { found: true, jobId: server.id, players: server.playing, maxPlayers: server.maxPlayers, scanned: serversScanned, playersScanned, method: "userId" };
        }

        if (tokens.length === 0) continue;

        const avatars = await getTokenAvatars(tokens);
        const avatarMatch = avatars.find((a) => a.imageUrl === targetAvatar);
        if (avatarMatch) {
          return { found: true, jobId: server.id, players: server.playing, maxPlayers: server.maxPlayers, scanned: serversScanned, playersScanned, method: "avatar" };
        }

        const nameMatch = avatars.find((a) => a.requestId && a.requestId.toLowerCase().includes(lowerName));
        if (nameMatch) {
          return { found: true, jobId: server.id, players: server.playing, maxPlayers: server.maxPlayers, scanned: serversScanned, playersScanned, method: "nameToken" };
        }
      }

      cursor = data.nextPageCursor;
      if (!cursor) break;
    } catch (err) {
      console.error(`[SCAN ERROR] Page ${page + 1}:`, err.message);
      break;
    }
  }
  return { found: false, scanned: serversScanned, playersScanned };
}

// ==================== COMMANDS ====================
function buildCommands() {
  const contexts = [InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel];
  const types = [ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall];

  return [
    new SlashCommandBuilder()
      .setName("snipe")
      .setDescription(`Find a player in ${FAME_GAME_NAME}`)
      .addStringOption((option) => option.setName("username").setDescription("Roblox username").setRequired(true))
      .addBooleanOption((option) =>
        option.setName("deepsearch").setDescription("Enable deep search (slower but scans more servers)").setRequired(false)
      )
      .setIntegrationTypes(types)
      .setContexts(contexts)
      .toJSON(),
    // Add your other commands (stats, timeout, etc.) here if needed
  ];
}

async function registerCommands() {
  const commands = buildCommands();
  if (CLIENT_ID) {
    const rest = new REST({ version: "10" }).setToken(TOKEN);
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log("Global slash commands registered");
  } else {
    for (const guild of client.guilds.cache.values()) {
      await guild.commands.set(commands);
    }
    console.log(`Guild commands registered in ${client.guilds.cache.size} servers`);
  }
}

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await registerCommands().catch(console.error);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

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
        return interaction.editReply({
          embeds: [new EmbedBuilder().setTitle("User Not Found").setDescription(`Could not find "${username}" on Roblox.`).setColor(0xff0000)],
        });
      }

      const [avatar, presence] = await Promise.all([
        getUserAvatar(userData.id),
        getUserPresence(userData.id),
      ]);

      const profileUrl = `https://www.roblox.com/users/${userData.id}/profile`;

      // === KEEPING YOUR SEARCHING EMBED ===
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🔍 Searching...")
            .setDescription(`Looking for **[${userData.name}](${profileUrl})** in **${FAME_GAME_NAME}** public servers...`)
            .setColor(0x5865f2)
            .setThumbnail(avatar)
            .addFields({ name: "Mode", value: deepSearch ? "Deep Search (25 pages)" : "Fast Search (8 pages)", inline: true }),
        ],
      });

      const result = await findUserInServers(userData.id, userData.name, maxPages);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

      if (!result.found) {
        stats.failedSnipes += 1;
        let desc = `Could not find **[${userData.name}](${profileUrl})** in any public servers.`;
        if (presence?.type === 2 && String(presence.rootPlaceId) === String(FAME_GAME_ID)) {
          desc += "\n\n> They are likely in a **private or VIP server**.";
        }

        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle("❌ Snipe Failed")
              .setDescription(desc)
              .addFields(
                { name: "Mode", value: deepSearch ? "Deep Search" : "Fast Search", inline: true },
                { name: "Servers Scanned", value: `${result.scanned}`, inline: true },
                { name: "Time", value: `${elapsed}s`, inline: true }
              )
              .setColor(0xff0000)
              .setThumbnail(avatar),
          ],
        });
      }

      // ===================== SUCCESS - WITH JOIN BUTTON =====================
      stats.successfulSnipes += 1;
      const gamePage = `https://www.roblox.com/games/${FAME_GAME_ID}`;
      const directJoinLink = `roblox://experiences/start?placeId=${FAME_GAME_ID}&gameInstanceId=${result.jobId}`;

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle("✅ Player Found!")
            .setDescription(`Found **[${userData.name}](${profileUrl})** in **${FAME_GAME_NAME}**`)
            .addFields(
              { name: "Server", value: `${result.players}/${result.maxPlayers} players`, inline: true },
              { name: "Time Taken", value: `${elapsed}s`, inline: true },
              { name: "Mode", value: deepSearch ? "Deep Search" : "Fast Search", inline: true },
              { name: "Job ID", value: `\`${result.jobId}\``, inline: false },
              { name: "Direct Join Link", value: `\`${directJoinLink}\`` }
            )
            .setColor(0x00ff00)
            .setThumbnail(avatar)
            .setFooter({ text: "Click the button below to join their server immediately" }),
        ],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setLabel("🚀 Join Their Server Now")
              .setURL(directJoinLink)
              .setStyle(ButtonStyle.Link)
          ),
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setLabel("Open Game Page")
              .setURL(gamePage)
              .setStyle(ButtonStyle.Link)
          ),
        ],
      });
    } catch (error) {
      stats.failedSnipes += 1;
      console.error("[SNIPE ERROR]", error);

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle("⚠️ Sniping Error")
            .setDescription("Something went wrong while sniping.\nPlease try again in 10-30 seconds.")
            .setColor(0xffa500)
            .addFields({ name: "Tip", value: "Make sure your ROBLOX_COOKIE is valid if you have one." }),
        ],
      });
    }
  }
});

// Add your other commands (stats, timeout, invite protection, etc.) here if needed

process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

client.login(TOKEN);
