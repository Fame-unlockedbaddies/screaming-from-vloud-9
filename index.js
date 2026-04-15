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
  ApplicationIntegrationType,
  InteractionContextType,
  Partials,
} = require("discord.js");
const http = require("http");

const TOKEN = process.env.DISCORD_TOKEN || process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const PORT = process.env.PORT || 10000;
const RENDER_URL = process.env.RENDER_URL;
const MAX_SERVERS_TO_SCAN = Number(process.env.MAX_SERVERS_TO_SCAN || 2500);
const DEEP_SEARCH_MAX_SERVERS = Number(process.env.DEEP_SEARCH_MAX_SERVERS || 10000);
const EMBED_COLOR = 0x8b1e5a;

if (!TOKEN) {
  console.error("Missing bot token. Add DISCORD_TOKEN in Render environment variables.");
  process.exit(1);
}

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Discord bot is alive");
});

server.listen(PORT, () => {
  console.log(`Keep-alive server running on port ${PORT}`);
});

if (RENDER_URL) {
  setInterval(async () => {
    try {
      await fetch(RENDER_URL);
      console.log("Self-ping sent");
    } catch (error) {
      console.error("Self-ping failed:", error.message);
    }
  }, 10 * 60 * 1000);
} else {
  console.warn("RENDER_URL is not set. Render free web services may sleep when inactive.");
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages],
  partials: [Partials.Channel],
});

function trimText(value, maxLength = 1024) {
  if (!value) return "Unknown";
  return String(value).length > maxLength ? `${String(value).slice(0, maxLength - 3)}...` : String(value);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function makeRobloxJoinUrl(placeId, gameId) {
  if (placeId && gameId) {
    return `https://www.roblox.com/games/start?placeId=${placeId}&gameInstanceId=${gameId}`;
  }

  if (placeId) {
    return `https://www.roblox.com/games/${placeId}`;
  }

  return "https://www.roblox.com/discover";
}

async function safeFetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "User-Agent": "Mozilla/5.0 DiscordBot RobloxSnipeBot",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function getUserId(username) {
  try {
    const data = await safeFetchJson("https://users.roblox.com/v1/usernames/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usernames: [username], excludeBannedUsers: false }),
    });

    return data.data?.[0]?.id || null;
  } catch (error) {
    console.error("getUserId failed:", error.message);
    return null;
  }
}

async function getUserPresence(userId) {
  try {
    const data = await safeFetchJson("https://presence.roblox.com/v1/presence/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userIds: [Number(userId)] }),
    });

    return data.userPresences?.[0] || null;
  } catch (error) {
    console.error("getUserPresence failed:", error.message);
    return null;
  }
}

async function getUniverseFromPlaceId(placeId) {
  try {
    const data = await safeFetchJson(`https://apis.roblox.com/universes/v1/places/${placeId}/universe`);
    return data.universeId || null;
  } catch (error) {
    console.error("getUniverseFromPlaceId failed:", error.message);
    return null;
  }
}

async function getGameName(universeId) {
  if (!universeId) return "Unknown Game";

  try {
    const data = await safeFetchJson(`https://games.roblox.com/v1/games?universeIds=${universeId}`);
    return data.data?.[0]?.name || `Game ${universeId}`;
  } catch (error) {
    console.error("getGameName failed:", error.message);
    return `Game ${universeId}`;
  }
}

async function getCurrentAvatar(userId) {
  try {
    const data = await safeFetchJson(
      `https://thumbnails.roblox.com/v1/users/avatar?userIds=${userId}&size=420x420&format=Png&isCircular=false`
    );

    return data.data?.[0]?.imageUrl || null;
  } catch (error) {
    console.error("getCurrentAvatar failed:", error.message);
    return null;
  }
}

async function getAvatarHeadshot(userId) {
  try {
    const data = await safeFetchJson(
      `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`
    );

    return data.data?.[0]?.imageUrl || null;
  } catch (error) {
    console.error("getAvatarHeadshot failed:", error.message);
    return null;
  }
}

async function getAvatarHistory(userId) {
  try {
    const data = await safeFetchJson(
      `https://avatar.roblox.com/v1/users/${userId}/outfits?page=1&itemsPerPage=25&isEditable=false`
    );

    return data.data || [];
  } catch (error) {
    console.error("getAvatarHistory failed:", error.message);
    return [];
  }
}

async function getServerPage(universeId, cursor = null) {
  const url = `https://games.roblox.com/v1/games/${universeId}/servers/Public?limit=100&sortOrder=Asc${
    cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""
  }`;

  return safeFetchJson(url);
}

async function getServerPlayerThumbnails(server) {
  const tokens = server.playerTokens || [];
  if (tokens.length === 0) return [];

  const requests = tokens.slice(0, 100).map((token, index) => ({
    requestId: `${server.id}:${index}`,
    token,
    type: "AvatarHeadShot",
    size: "150x150",
    format: "Png",
    isCircular: false,
  }));

  try {
    const data = await safeFetchJson("https://thumbnails.roblox.com/v1/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requests),
    });

    return data.data || [];
  } catch (error) {
    console.error(`getServerPlayerThumbnails failed for ${server.id}:`, error.message);
    return [];
  }
}

async function findPlayerServerByHeadshot(universeId, targetHeadshotUrl, maxServersToScan, progressCallback) {
  let cursor = null;
  let scannedServers = 0;
  let scannedPlayers = 0;
  let pageCount = 0;

  while (scannedServers < maxServersToScan) {
    const page = await getServerPage(universeId, cursor).catch(error => {
      console.error("getServerPage failed:", error.message);
      return null;
    });

    if (!page || !Array.isArray(page.data) || page.data.length === 0) {
      break;
    }

    pageCount += 1;

    for (const serverInfo of page.data) {
      if (scannedServers >= maxServersToScan) break;

      scannedServers += 1;
      scannedPlayers += serverInfo.playing || 0;

      if (serverInfo.playerTokens?.length) {
        const thumbnails = await getServerPlayerThumbnails(serverInfo);
        const matchedThumbnail = thumbnails.find(thumbnail => thumbnail.imageUrl && thumbnail.imageUrl === targetHeadshotUrl);

        if (matchedThumbnail) {
          return {
            found: true,
            server: serverInfo,
            scannedServers,
            scannedPlayers,
            pageCount,
          };
        }
      }

      if (scannedServers % 25 === 0 && progressCallback) {
        await progressCallback(scannedServers, scannedPlayers).catch(() => {});
      }

      await sleep(80);
    }

    if (!page.nextPageCursor) break;
    cursor = page.nextPageCursor;
    await sleep(350);
  }

  return {
    found: false,
    server: null,
    scannedServers,
    scannedPlayers,
    pageCount,
  };
}

async function registerCommands() {
  const applicationId = CLIENT_ID || client.user?.id;

  if (!applicationId) {
    console.error("Could not find application ID. Add CLIENT_ID in Render environment variables.");
    return;
  }

  const commands = [
    new SlashCommandBuilder()
      .setName("roblox")
      .setDescription("Roblox utilities")
      .addSubcommand(subcommand =>
        subcommand
          .setName("avatarhistory")
          .setDescription("View a Roblox user's public saved outfits")
          .addStringOption(option =>
            option.setName("username").setDescription("Roblox username").setRequired(true)
          )
      )
      .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
      .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel)
      .toJSON(),

    new SlashCommandBuilder()
      .setName("snipe")
      .setDescription("Find the public Roblox server a user is currently in")
      .addStringOption(option =>
        option.setName("username").setDescription("Roblox username to snipe").setRequired(true)
      )
      .addStringOption(option =>
        option.setName("placeid").setDescription("Optional Roblox place ID if the user's current game is hidden").setRequired(false)
      )
      .addBooleanOption(option =>
        option.setName("deepsearch").setDescription("Scan more servers for large games. This can take longer.").setRequired(false)
      )
      .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
      .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel)
      .toJSON(),
  ];

  const rest = new REST({ version: "10" }).setToken(TOKEN);

  try {
    await rest.put(Routes.applicationCommands(applicationId), { body: commands });
    console.log("Slash commands registered.");
  } catch (error) {
    console.error("Command registration failed:", error);
  }
}

async function runSnipe(interaction, username, placeIdInput, deepSearch) {
  const startTime = Date.now();
  const maxServersToScan = deepSearch ? DEEP_SEARCH_MAX_SERVERS : MAX_SERVERS_TO_SCAN;

  await interaction.deferReply();

  try {
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(EMBED_COLOR)
          .setTitle("Roblox Snipe")
          .setDescription(`Preparing the server scan for **${trimText(username, 100)}**.`),
      ],
      components: [],
    });

    const robloxId = await getUserId(username);

    if (!robloxId) {
      return interaction.editReply({ content: "Roblox user not found.", embeds: [], components: [] });
    }

    const [avatarUrl, targetHeadshotUrl, presence] = await Promise.all([
      getCurrentAvatar(robloxId),
      getAvatarHeadshot(robloxId),
      getUserPresence(robloxId),
    ]);

    if (!targetHeadshotUrl) {
      return interaction.editReply({
        content: "Could not get this user's Roblox avatar thumbnail. Try again in a minute.",
        embeds: [],
        components: [],
      });
    }

    let placeId = placeIdInput || presence?.placeId || presence?.rootPlaceId || null;
    let universeId = presence?.universeId || null;

    if (placeId && !/^\d+$/.test(String(placeId))) {
      return interaction.editReply({ content: "The optional placeid must be numbers only.", embeds: [], components: [] });
    }

    if (placeId && !universeId) {
      universeId = await getUniverseFromPlaceId(placeId);
    }

    if (!universeId || !placeId) {
      return interaction.editReply({
        content:
          `I found **${username}**, but Roblox did not show what game they are in. ` +
          "Run it again with a place ID, like `/snipe username:theirname placeid:123456789`, so I know which game's servers to scan.",
        embeds: [],
        components: [],
      });
    }

    const gameName = await getGameName(universeId);

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(EMBED_COLOR)
          .setTitle("Search in progress")
          .setDescription(
            `Searching for **${trimText(username, 100)}** in **${trimText(gameName, 200)}**.\n` +
              `This checks server avatar thumbnails and may take a bit for large games.\n` +
              `Mode: **${deepSearch ? "Deep Search" : "Normal Search"}** — up to **${maxServersToScan}** servers.`
          ),
      ],
      components: [],
    });

    const result = await findPlayerServerByHeadshot(universeId, targetHeadshotUrl, maxServersToScan, async (servers, players) => {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(EMBED_COLOR)
            .setTitle("Search still running")
            .setDescription(
              `Looking for **${trimText(username, 100)}** in **${trimText(gameName, 200)}**...\n` +
                `Scanned **${servers}** servers and about **${players}** players.\n` +
                `Mode: **${deepSearch ? "Deep Search" : "Normal Search"}**`
            ),
        ],
        components: [],
      });
    });

    const scanTime = ((Date.now() - startTime) / 1000).toFixed(1);

    if (!result.found) {
      const notFoundEmbed = new EmbedBuilder()
        .setColor(EMBED_COLOR)
        .setTitle("No matching server found")
        .setDescription(
          `I scanned **${result.scannedServers}** public servers for **${trimText(username, 100)}** in **${trimText(gameName, 200)}**, but did not find their avatar.`
        )
        .addFields(
          { name: "Possible reasons", value: "They joined a private/full server, changed games, left, Roblox hid the server, or the scan limit was reached." },
          { name: "Scan Time", value: `${scanTime}s`, inline: true },
          { name: "Players Checked", value: String(result.scannedPlayers), inline: true },
          { name: "Search Mode", value: deepSearch ? "Deep Search" : "Normal Search", inline: true }
        )
        .setTimestamp();

      if (avatarUrl) notFoundEmbed.setImage(avatarUrl);

      return interaction.editReply({ embeds: [notFoundEmbed], components: [] });
    }

    const matchedServer = result.server;
    const embed = new EmbedBuilder()
      .setColor(EMBED_COLOR)
      .setTitle("Matching server found")
      .setDescription(`Located **${trimText(username, 100)}** in **${trimText(gameName, 200)}**.`)
      .addFields(
        { name: "Server ID", value: trimText(matchedServer.id, 1024) },
        { name: "Players", value: `${matchedServer.playing}/${matchedServer.maxPlayers}`, inline: true },
        { name: "Servers Scanned", value: String(result.scannedServers), inline: true },
        { name: "Scan Time", value: `${scanTime}s`, inline: true },
        { name: "Search Mode", value: deepSearch ? "Deep Search" : "Normal Search", inline: true }
      )
      .setTimestamp();

    if (avatarUrl) embed.setImage(avatarUrl);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("Join Server")
        .setStyle(ButtonStyle.Link)
        .setURL(makeRobloxJoinUrl(placeId, matchedServer.id)),
      new ButtonBuilder()
        .setLabel("Open Game")
        .setStyle(ButtonStyle.Link)
        .setURL(`https://www.roblox.com/games/${placeId}`)
    );

    return interaction.editReply({ embeds: [embed], components: [row] });
  } catch (error) {
    console.error("Snipe error:", error);
    return interaction
      .editReply({ content: "Something went wrong while running the snipe command.", embeds: [], components: [] })
      .catch(() => {});
  }
}

async function runAvatarHistory(interaction, username) {
  await interaction.deferReply();

  try {
    const robloxId = await getUserId(username);

    if (!robloxId) {
      return interaction.editReply({ content: "Roblox user not found.", embeds: [], components: [] });
    }

    const [avatarUrl, outfits] = await Promise.all([getCurrentAvatar(robloxId), getAvatarHistory(robloxId)]);

    const outfitList = outfits
      .slice(0, 10)
      .map((outfit, index) => `${index + 1}. ${trimText(outfit.name || "Unnamed Outfit", 80)}`)
      .join("\n");

    const embed = new EmbedBuilder()
      .setColor(EMBED_COLOR)
      .setTitle(`Avatar History — ${trimText(username, 100)}`)
      .setDescription(outfits.length > 0 ? `Found **${outfits.length}** public saved outfits.\n\n${outfitList}` : "No public outfits found for this user.")
      .setTimestamp();

    if (avatarUrl) embed.setImage(avatarUrl);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("View Roblox Profile")
        .setStyle(ButtonStyle.Link)
        .setURL(`https://www.roblox.com/users/${robloxId}/profile`)
    );

    return interaction.editReply({ embeds: [embed], components: [row] });
  } catch (error) {
    console.error("Avatar history error:", error);
    return interaction.editReply({ content: "Something went wrong while checking avatar history.", embeds: [], components: [] }).catch(() => {});
  }
}

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await registerCommands();
});

client.on("interactionCreate", async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === "roblox" && interaction.options.getSubcommand() === "avatarhistory") {
        const username = interaction.options.getString("username", true);
        return runAvatarHistory(interaction, username);
      }

      if (interaction.commandName === "snipe") {
        const username = interaction.options.getString("username", true);
        const placeId = interaction.options.getString("placeid", false);
        const deepSearch = interaction.options.getBoolean("deepsearch", false) || false;
        return runSnipe(interaction, username, placeId, deepSearch);
      }
    }
  } catch (error) {
    console.error("Interaction error:", error);

    if (interaction.isRepliable()) {
      const payload = { content: "Something went wrong while handling that command.", embeds: [], components: [], ephemeral: true };

      if (interaction.deferred || interaction.replied) {
        return interaction.followUp(payload).catch(() => {});
      }

      return interaction.reply(payload).catch(() => {});
    }
  }
});

process.on("unhandledRejection", error => {
  console.error("Unhandled rejection:", error);
});

process.on("uncaughtException", error => {
  console.error("Uncaught exception:", error);
});

client.login(TOKEN).catch(error => {
  console.error("Login failed:", error);
  process.exit(1);
});
