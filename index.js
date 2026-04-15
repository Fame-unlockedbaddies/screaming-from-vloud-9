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
  InteractionContextType
} = require("discord.js");

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const ROBLOX_COOKIE = process.env.ROBLOX_COOKIE;
const PORT = process.env.PORT || 3000;

if (!TOKEN || !CLIENT_ID) {
  console.error("Missing TOKEN or CLIENT_ID");
  process.exit(1);
}

const WEBHOOK_URL = "https://discord.com/api/webhooks/1493916503291203654/xRsw3M1K4nAJm6c6WVEY99yK1_4XC53cK0JRbvAylSfc6t9XK-Jsi9o4uEU_iaYkRjhP";

let webhook = null;
try {
  webhook = new WebhookClient({ url: WEBHOOK_URL });
  console.log("Webhook enabled");
} catch (error) {
  console.error("Webhook failed:", error.message);
}

const FAME_GAME_ID = "121157515767845";
const FAME_GAME_NAME = "Fame";

async function logToWebhook(title, description, type = "INFO", fields = [], thumbnail = null) {
  if (!webhook) return;
  try {
    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor(0x2B2D31)
      .setTimestamp()
      .setFooter({ text: "Fame Sniper Bot" });
    if (fields.length > 0) embed.addFields(fields);
    if (thumbnail) embed.setThumbnail(thumbnail);
    await webhook.send({ embeds: [embed] });
  } catch (error) {
    console.error("Webhook error:", error.message);
  }
}

http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Bot is alive");
}).listen(PORT, () => console.log(`Server on port ${PORT}`));

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages],
  partials: [Partials.Channel]
});

let lastRequest = 0;
const REQUEST_DELAY = 150;

async function rateLimit() {
  const now = Date.now();
  const wait = lastRequest + REQUEST_DELAY - now;
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastRequest = Date.now();
}

// Get user ID from username
async function getUserId(username) {
  try {
    await rateLimit();
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

// Get user presence
async function getUserPresence(userId) {
  try {
    await rateLimit();
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

// Get user avatar
async function getUserAvatar(userId) {
  try {
    await rateLimit();
    const res = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=720x720&format=Png&isCircular=false`);
    const data = await res.json();
    return data.data?.[0]?.imageUrl || null;
  } catch (error) {
    return null;
  }
}

// Get game name
async function getGameName(placeId) {
  if (!placeId) return "Unknown";
  try {
    await rateLimit();
    const res = await fetch(`https://games.roblox.com/v1/games?universeIds=${placeId}`);
    const data = await res.json();
    return data.data?.[0]?.name || "Unknown Game";
  } catch (error) {
    return "Unknown Game";
  }
}

// CRITICAL FIX: Scan ALL servers properly
async function findUserInAllServers(userId) {
  let cursor = "";
  let serversScanned = 0;
  let totalServers = 0;
  const userIdStr = userId.toString();
  
  console.log(`[SCAN] Starting full server scan for user ${userIdStr}`);
  
  try {
    // First, get total server count
    const firstPage = await fetch(`https://games.roblox.com/v1/games/${FAME_GAME_ID}/servers/Public?limit=100`);
    const firstData = await firstPage.json();
    
    if (firstData.totalServers) {
      totalServers = firstData.totalServers;
      console.log(`[SCAN] Total servers to scan: ${totalServers}`);
    }
    
    // Check first page
    if (firstData.data) {
      for (const server of firstData.data) {
        serversScanned++;
        if (server.playing && Array.isArray(server.playing)) {
          if (server.playing.map(p => p.toString()).includes(userIdStr)) {
            console.log(`[SCAN] FOUND on page 1 after ${serversScanned} servers`);
            return {
              found: true,
              jobId: server.id,
              players: server.playing.length,
              maxPlayers: server.maxPlayers,
              scanned: serversScanned,
              totalServers: totalServers
            };
          }
        }
      }
    }
    
    // Continue scanning remaining pages
    cursor = firstData.nextPageCursor;
    let pageNum = 2;
    
    while (cursor && serversScanned < 5000) { // Scan up to 5000 servers
      await rateLimit();
      const url = `https://games.roblox.com/v1/games/${FAME_GAME_ID}/servers/Public?limit=100&cursor=${cursor}`;
      const res = await fetch(url);
      
      if (res.status === 429) {
        console.log("[SCAN] Rate limited, waiting...");
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      
      const data = await res.json();
      if (!data.data || data.data.length === 0) break;
      
      for (const server of data.data) {
        serversScanned++;
        
        if (server.playing && Array.isArray(server.playing)) {
          if (server.playing.map(p => p.toString()).includes(userIdStr)) {
            console.log(`[SCAN] FOUND on page ${pageNum} after ${serversScanned} servers`);
            return {
              found: true,
              jobId: server.id,
              players: server.playing.length,
              maxPlayers: server.maxPlayers,
              scanned: serversScanned,
              totalServers: totalServers,
              pageFound: pageNum
            };
          }
        }
      }
      
      cursor = data.nextPageCursor;
      pageNum++;
      
      // Log progress every 10 pages
      if (pageNum % 10 === 0) {
        console.log(`[SCAN] Scanned ${serversScanned} servers so far...`);
      }
    }
    
    console.log(`[SCAN] COMPLETE - Scanned ${serversScanned} servers, user not found`);
    return { found: false, scanned: serversScanned, totalServers: totalServers };
    
  } catch (error) {
    console.error("[SCAN] Error:", error);
    return { found: false, scanned: serversScanned, error: true };
  }
}

async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName("snipe")
      .setDescription(`Find a player in ${FAME_GAME_NAME} and join their game`)
      .addStringOption(opt => opt.setName("username").setDescription("Roblox username").setRequired(true))
      .setIntegrationTypes([ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall])
      .setContexts([InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel])
      .toJSON()
  ];

  const rest = new REST({ version: "10" }).setToken(TOKEN);
  try {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log("Commands registered!");
    await logToWebhook("System Online", "Bot is ready", "SUCCESS", [
      { name: "Game", value: FAME_GAME_NAME, inline: true },
      { name: "Command", value: "/snipe", inline: true }
    ]);
  } catch (err) {
    console.error("Command registration failed:", err);
  }
}

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  console.log(`Sniping game: ${FAME_GAME_NAME}`);
  await registerCommands();
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "snipe") return;

  const startTime = Date.now();
  
  try {
    await interaction.deferReply();
    
    const username = interaction.options.getString("username");
    const discordUserId = interaction.user.id;
    
    console.log(`[SNIPE] Request for user: ${username}`);
    
    // Get user ID
    const userData = await getUserId(username);
    if (!userData) {
      const embed = new EmbedBuilder()
        .setTitle("User Not Found")
        .setDescription(`Could not find "${username}" on Roblox`)
        .setColor(0x2B2D31);
      await interaction.editReply({ content: `<@${discordUserId}>`, embeds: [embed] });
      return;
    }
    
    const userId = userData.id;
    const actualUsername = userData.name;
    console.log(`[SNIPE] User ID: ${userId}`);
    
    // Get presence
    const presence = await getUserPresence(userId);
    
    if (!presence.online) {
      const avatar = await getUserAvatar(userId);
      const embed = new EmbedBuilder()
        .setTitle("Snipe Failed")
        .setDescription(`**${actualUsername}** is offline`)
        .setColor(0x2B2D31)
        .setThumbnail(avatar);
      await interaction.editReply({ content: `<@${discordUserId}>`, embeds: [embed] });
      return;
    }
    
    if (!presence.inGame) {
      const avatar = await getUserAvatar(userId);
      const embed = new EmbedBuilder()
        .setTitle("Snipe Failed")
        .setDescription(`**${actualUsername}** is online but not in a game`)
        .setColor(0x2B2D31)
        .setThumbnail(avatar);
      await interaction.editReply({ content: `<@${discordUserId}>`, embeds: [embed] });
      return;
    }
    
    if (presence.placeId && presence.placeId.toString() !== FAME_GAME_ID) {
      const avatar = await getUserAvatar(userId);
      const gameName = await getGameName(presence.placeId);
      const embed = new EmbedBuilder()
        .setTitle("Snipe Failed")
        .setDescription(`**${actualUsername}** is playing **${gameName}**, not ${FAME_GAME_NAME}`)
        .setColor(0x2B2D31)
        .setThumbnail(avatar);
      await interaction.editReply({ content: `<@${discordUserId}>`, embeds: [embed] });
      return;
    }
    
    const avatar = await getUserAvatar(userId);
    
    // Searching embed
    const searching = new EmbedBuilder()
      .setTitle("Searching for player")
      .setDescription(`Target: **${actualUsername}**\nGame: **${FAME_GAME_NAME}**\nStatus: Scanning all public servers...`)
      .setColor(0x2B2D31)
      .setThumbnail(avatar);
    
    await interaction.editReply({ content: `<@${discordUserId}>`, embeds: [searching] });
    
    // SCAN ALL SERVERS
    const result = await findUserInAllServers(userId);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    
    if (!result.found) {
      const embed = new EmbedBuilder()
        .setTitle("Snipe Failed")
        .setDescription(`Could not locate **${actualUsername}** in **${FAME_GAME_NAME}**`)
        .addFields(
          { name: "Servers Scanned", value: `${result.scanned}`, inline: true },
          { name: "Time", value: `${elapsed} seconds`, inline: true },
          { name: "Reason", value: "User may be in a private/VIP server", inline: false }
        )
        .setColor(0x2B2D31)
        .setThumbnail(avatar);
      await interaction.editReply({ content: `<@${discordUserId}>`, embeds: [embed] });
      return;
    }
    
    // SUCCESS!
    const joinLink = `https://www.roblox.com/games/${FAME_GAME_ID}?jobId=${result.jobId}`;
    
    const embed = new EmbedBuilder()
      .setTitle("Player Found")
      .setDescription(`Successfully located **${actualUsername}** in **${FAME_GAME_NAME}**`)
      .addFields(
        { name: "Server", value: `${result.players}/${result.maxPlayers} players`, inline: true },
        { name: "Search Time", value: `${elapsed} seconds`, inline: true },
        { name: "Servers Scanned", value: `${result.scanned}`, inline: true },
        { name: "Method", value: "Full Server Scan", inline: true }
      )
      .setColor(0x2B2D31)
      .setThumbnail(avatar)
      .setImage(avatar)
      .setFooter({ text: "Fame Sniper Bot" });
    
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setLabel("Join Game")
          .setURL(joinLink)
          .setStyle(ButtonStyle.Link)
      );
    
    await interaction.editReply({ content: `<@${discordUserId}>`, embeds: [embed], components: [row] });
    
    console.log(`[SNIPE] SUCCESS - Found ${actualUsername} in ${result.scanned} servers`);
    
    await logToWebhook("Snipe Successful", `${discordUserId} sniped ${actualUsername}`, "SUCCESS", [
      { name: "Target", value: actualUsername, inline: true },
      { name: "Server", value: `${result.players}/${result.maxPlayers}`, inline: true },
      { name: "Scanned", value: `${result.scanned} servers`, inline: true },
      { name: "Time", value: `${elapsed}s`, inline: true }
    ], avatar);
    
  } catch (error) {
    console.error("Error:", error);
    const errorEmbed = new EmbedBuilder()
      .setTitle("Error")
      .setDescription(error.message)
      .setColor(0x2B2D31);
    
    if (interaction.deferred) {
      await interaction.editReply({ embeds: [errorEmbed] });
    } else {
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  }
});

process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

client.login(TOKEN);
