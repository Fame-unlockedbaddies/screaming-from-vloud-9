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

const MAX_SERVERS = 800;
const DEEP_MAX_SERVERS = 1500;

if (!TOKEN) {
  console.error("Missing DISCORD_TOKEN");
  process.exit(1);
}

/* ---------------- KEEP ALIVE SERVER ---------------- */

const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end("OK");
});

server.listen(PORT, () => {
  console.log("Bot running on port", PORT);
});

/* ---------------- CLIENT ---------------- */

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
  partials: [Partials.Channel],
});

/* ---------------- UTIL ---------------- */

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchJSON(url, options = {}, retries = 2) {
  try {
    const res = await fetch(url, options);
    if (!res.ok) throw new Error(res.statusText);
    return await res.json();
  } catch (e) {
    if (retries <= 0) throw e;
    return fetchJSON(url, options, retries - 1);
  }
}

function parsePlaceId(input) {
  if (!input) return null;
  if (/^\d+$/.test(input)) return input;

  const match = input.match(/roblox\.com\/games\/(\d+)/);
  if (match) return match[1];

  const alt = input.match(/placeId=(\d+)/);
  if (alt) return alt[1];

  return null;
}

function joinUrl(placeId, serverId) {
  return `https://www.roblox.com/games/start?placeId=${placeId}&gameInstanceId=${serverId}`;
}

/* ---------------- ROBLOX API ---------------- */

async function getUserId(username) {
  const data = await fetchJSON("https://users.roblox.com/v1/usernames/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usernames: [username], excludeBannedUsers: false }),
  });

  return data?.data?.[0]?.id || null;
}

async function getHeadshot(userId) {
  const data = await fetchJSON(
    `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png`
  );

  return data?.data?.[0]?.imageUrl || null;
}

async function getUniverse(placeId) {
  const data = await fetchJSON(
    `https://apis.roblox.com/universes/v1/places/${placeId}/universe`
  );

  return data?.universeId || null;
}

async function getGameName(universeId) {
  const data = await fetchJSON(
    `https://games.roblox.com/v1/games?universeIds=${universeId}`
  );

  return data?.data?.[0]?.name || "Unknown Game";
}

async function getServers(universeId, cursor = "") {
  const url =
    `https://games.roblox.com/v1/games/${universeId}/servers/Public?limit=100` +
    (cursor ? `&cursor=${cursor}` : "");

  return fetchJSON(url);
}

async function getThumbnails(tokens, serverId) {
  const body = tokens.slice(0, 50).map((token, i) => ({
    requestId: `${serverId}:${i}`,
    token,
    type: "AvatarHeadShot",
    size: "150x150",
    format: "Png",
  }));

  const data = await fetchJSON(
    "https://thumbnails.roblox.com/v1/batch",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  return data?.data || [];
}

/* ---------------- SCANNER ---------------- */

async function scanServers(universeId, targetHeadshot, maxServers) {
  let cursor = "";
  let scanned = 0;

  while (scanned < maxServers) {
    const page = await getServers(universeId, cursor);

    if (!page?.data?.length) break;

    for (const server of page.data) {
      scanned++;

      if (!server.playerTokens?.length) continue;

      const thumbs = await getThumbnails(server.playerTokens, server.id);

      const match = thumbs.find(t =>
        t.imageUrl &&
        targetHeadshot &&
        t.imageUrl.split("?")[0] === targetHeadshot.split("?")[0]
      );

      if (match) {
        return {
          found: true,
          server,
          scanned,
        };
      }

      await sleep(20);
    }

    cursor = page.nextPageCursor;
    if (!cursor) break;

    await sleep(150);
  }

  return { found: false, scanned };
}

/* ---------------- COMMANDS ---------------- */

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(TOKEN);

  const commands = [
    new SlashCommandBuilder()
      .setName("snipe")
      .setDescription("Find a Roblox player server")
      .addStringOption(o =>
        o.setName("username").setDescription("Roblox username").setRequired(true)
      )
      .addStringOption(o =>
        o.setName("placeid").setDescription("Game link or placeId").setRequired(false)
      )
      .toJSON(),
  ];

  await rest.put(Routes.applicationCommands(CLIENT_ID), {
    body: commands,
  });

  console.log("Commands registered");
}

/* ---------------- BOT LOGIC ---------------- */

client.once("ready", async () => {
  console.log("Logged in as", client.user.tag);
  await registerCommands();
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName !== "snipe") return;

  const username = interaction.options.getString("username");
  const placeInput = interaction.options.getString("placeid");

  await interaction.reply("🔍 Searching...");

  try {
    const userId = await getUserId(username);
    if (!userId) return interaction.editReply("User not found.");

    const headshot = await getHeadshot(userId);
    if (!headshot) return interaction.editReply("Failed to get avatar.");

    let placeId = parsePlaceId(placeInput);

    if (!placeId) {
      return interaction.editReply("Please provide a valid placeId or game link.");
    }

    const universeId = await getUniverse(placeId);
    if (!universeId) return interaction.editReply("Game not found.");

    const gameName = await getGameName(universeId);

    const result = await scanServers(
      universeId,
      headshot,
      MAX_SERVERS
    );

    if (!result.found) {
      return interaction.editReply(
        `❌ Not found after scanning ${result.scanned} servers in ${gameName}`
      );
    }

    const server = result.server;

    const embed = new EmbedBuilder()
      .setTitle("🎯 Player Found")
      .setDescription(`Found **${username}** in **${gameName}**`)
      .addFields(
        { name: "Server ID", value: server.id, inline: true },
        { name: "Players", value: `${server.playing}/${server.maxPlayers}`, inline: true },
        { name: "Scanned", value: String(result.scanned), inline: true }
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("Join Server")
        .setStyle(ButtonStyle.Link)
        .setURL(joinUrl(placeId, server.id))
    );

    return interaction.editReply({
      embeds: [embed],
      components: [row],
    });

  } catch (err) {
    console.error(err);
    return interaction.editReply("Error occurred while scanning.");
  }
});

/* ---------------- START ---------------- */

client.login(TOKEN);
