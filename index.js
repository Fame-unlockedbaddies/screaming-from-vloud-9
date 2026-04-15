const http = require("http");
const express = require("express");
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
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  Partials,
  ApplicationIntegrationType,
  InteractionContextType
} = require("discord.js");

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const ROBLOX_COOKIE = process.env.ROBLOX_COOKIE;
const API_KEY = process.env.API_KEY || "your-secret-api-key-here";
const PORT = process.env.PORT || 3000;

if (!TOKEN || !CLIENT_ID) {
  console.error("Missing TOKEN or CLIENT_ID");
  process.exit(1);
}

const FAME_GAME_ID = "121157515767845";
const FAME_GAME_NAME = "Fame";
const FAME_UNIVERSE_ID = "9505697553";

// Cache for servers
let cachedServers = [];
let lastServerFetch = 0;
const SERVER_CACHE_TTL = 30000;

// User cache
const userCache = new Map();
const CACHE_TTL = 2000;

// ============ EXPRESS API SERVER ============
const app = express();
app.use(express.json());

function verifyApiKey(req, res, next) {
  const providedKey = req.headers['x-api-key'] || req.query.apiKey;
  if (!providedKey || providedKey !== API_KEY) {
    return res.status(401).json({ error: "Invalid or missing API key" });
  }
  next();
}

app.get("/", (req, res) => {
  res.json({ 
    status: "online", 
    bot: client.user?.tag || "starting",
    game: FAME_GAME_NAME,
    gameId: FAME_GAME_ID
  });
});

app.post("/api/snipe", verifyApiKey, async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: "username is required" });
  
  try {
    const result = await performSnipe(username);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/snipe/:username", verifyApiKey, async (req, res) => {
  const { username } = req.params;
  try {
    const result = await performSnipe(username);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/user/:username", verifyApiKey, async (req, res) => {
  const { username } = req.params;
  try {
    const userInfo = await getRobloxUserInfo(username);
    if (!userInfo) return res.status(404).json({ error: "User not found" });
    res.json(userInfo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/game/servers", verifyApiKey, async (req, res) => {
  const { limit = 10, region = "all" } = req.query;
  try {
    let servers = await getAllFameServers();
    if (region !== "all") {
      servers = servers.filter(s => s.region === region);
    }
    servers = servers.slice(0, parseInt(limit));
    res.json({
      game: FAME_GAME_NAME,
      gameId: FAME_GAME_ID,
      servers: servers,
      totalServers: servers.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/stats", verifyApiKey, async (req, res) => {
  res.json({
    bot: client.user?.tag,
    guilds: client.guilds.cache.size,
    uptime: process.uptime(),
    game: FAME_GAME_NAME
  });
});

app.listen(PORT, () => {
  console.log(`API Server running on port ${PORT}`);
});

// ============ ROBLOX FUNCTIONS ============

let csrfToken = null;
let tokenExpiry = null;
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 100;

async function rateLimitWait() {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise(r => setTimeout(r, MIN_REQUEST_INTERVAL - timeSinceLastRequest));
  }
  lastRequestTime = Date.now();
}

async function refreshCsrfToken() {
  try {
    await rateLimitWait();
    const response = await fetch("https://auth.roblox.com/v2/logout", {
      method: "POST",
      headers: {
        "Cookie": `.ROBLOSECURITY=${ROBLOX_COOKIE}`,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });
    const newToken = response.headers.get("x-csrf-token");
    if (newToken) {
      csrfToken = newToken;
      tokenExpiry = Date.now() + 300000;
      console.log("CSRF Token refreshed");
      return csrfToken;
    }
    return null;
  } catch (error) {
    console.error("CSRF refresh error:", error);
    return null;
  }
}

async function getAuthHeaders() {
  if (!csrfToken || Date.now() >= tokenExpiry) {
    await refreshCsrfToken();
  }
  return {
    "Content-Type": "application/json",
    "Cookie": `.ROBLOSECURITY=${ROBLOX_COOKIE}`,
    "x-csrf-token": csrfToken,
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
  };
}

async function getGameIcon() {
  try {
    const response = await fetch(`https://thumbnails.roblox.com/v1/games/icons?universeIds=${FAME_UNIVERSE_ID}&size=512x512&format=Png&isCircular=false`);
    const data = await response.json();
    return data.data?.[0]?.imageUrl || null;
  } catch (error) {
    console.error("Failed to fetch game icon:", error);
    return null;
  }
}

function getServerRegion(serverId) {
  const id = serverId.toLowerCase();
  
  if (id.includes('us-east') || id.startsWith('0')) return "US East";
  if (id.includes('us-west') || id.startsWith('1')) return "US West";
  if (id.includes('us-central') || id.startsWith('6')) return "US Central";
  if (id.includes('eu') || id.startsWith('2')) return "Europe";
  if (id.includes('asia') || id.startsWith('3')) return "Asia";
  if (id.includes('au') || id.startsWith('4')) return "Australia";
  if (id.includes('br') || id.startsWith('5')) return "Brazil";
  
  if (id.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}/)) {
    const hash = parseInt(id.substring(0, 8), 16);
    const regionIndex = hash % 7;
    const regions = ["US East", "US West", "Europe", "Asia", "Australia", "Brazil", "US Central"];
    return regions[regionIndex];
  }
  
  return "US East";
}

function getRegionFlag(region) {
  const flagMap = {
    "US East": "🇺🇸",
    "US West": "🇺🇸",
    "US Central": "🇺🇸",
    "Europe": "🇪🇺",
    "Asia": "🌏",
    "Australia": "🇦🇺",
    "Brazil": "🇧🇷"
  };
  return flagMap[region] || "🌍";
}

function getRegionPing(region) {
  const pingMap = {
    "US East": "30-60ms",
    "US West": "50-80ms",
    "US Central": "40-70ms",
    "Europe": "80-120ms",
    "Asia": "150-200ms",
    "Australia": "180-250ms",
    "Brazil": "120-160ms"
  };
  return pingMap[region] || "60-120ms";
}

async function getAllFameServers(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedServers.length > 0 && (now - lastServerFetch) < SERVER_CACHE_TTL) {
    return cachedServers;
  }
  
  let servers = [];
  let cursor = "";
  let attempts = 0;
  
  try {
    while (attempts < 15 && servers.length < 200) {
      await rateLimitWait();
      const url = `https://games.roblox.com/v1/games/${FAME_GAME_ID}/servers/Public?limit=100${cursor ? `&cursor=${cursor}` : ""}`;
      const response = await fetch(url);
      
      if (response.status === 429) {
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      
      const data = await response.json();
      
      if (!data.data || data.data.length === 0) break;
      
      for (const server of data.data) {
        const region = getServerRegion(server.id);
        servers.push({
          id: server.id,
          players: server.playing || 0,
          maxPlayers: server.maxPlayers || 50,
          region: region,
          ping: getRegionPing(region),
          flag: getRegionFlag(region),
          fillPercentage: Math.round(((server.playing || 0) / (server.maxPlayers || 50)) * 100)
        });
      }
      
      cursor = data.nextPageCursor || "";
      if (!cursor) break;
      attempts++;
      await new Promise(r => setTimeout(r, 50));
    }
    
    servers.sort((a, b) => b.players - a.players);
    
    cachedServers = servers;
    lastServerFetch = now;
    
    console.log(`Cached ${servers.length} Fame servers`);
    return servers;
  } catch (error) {
    console.error("getAllFameServers error:", error);
    return cachedServers.length > 0 ? cachedServers : [];
  }
}

async function getGameName(placeId) {
  if (!placeId) return "Unknown Game";
  
  try {
    await rateLimitWait();
    const response = await fetch(`https://games.roblox.com/v1/games?universeIds=${placeId}`);
    const data = await response.json();
    if (data.data && data.data[0] && data.data[0].name) {
      return data.data[0].name;
    }
    return "Unknown Game";
  } catch (error) {
    return "Unknown Game";
  }
}

async function getUserPresence(userId, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      await rateLimitWait();
      const presenceUrl = "https://presence.roblox.com/v1/presence/users";
      const presenceRes = await fetch(presenceUrl, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Cookie": `.ROBLOSECURITY=${ROBLOX_COOKIE}`
        },
        body: JSON.stringify({ userIds: [userId] })
      });
      
      const presenceData = await presenceRes.json();
      
      if (presenceData.userPresences && presenceData.userPresences[0]) {
        const presence = presenceData.userPresences[0];
        
        if (presence.userPresenceType === 2) {
          const gameName = await getGameName(presence.placeId);
          return {
            status: "ingame",
            statusText: `In Game: ${gameName}`,
            placeId: presence.placeId,
            gameId: presence.gameId,
            gameName: gameName
          };
        } else if (presence.userPresenceType === 1) {
          return {
            status: "online",
            statusText: "Online (not in game)",
            placeId: null,
            gameName: null
          };
        } else if (presence.userPresenceType === 3) {
          return {
            status: "online",
            statusText: "In Roblox Studio",
            placeId: null,
            gameName: null
          };
        } else {
          return {
            status: "offline",
            statusText: "Offline",
            placeId: null,
            gameName: null
          };
        }
      }
    } catch (error) {
      console.error(`Presence attempt ${i + 1} failed:`, error);
      if (i < retries - 1) {
        await new Promise(r => setTimeout(r, 500));
      }
    }
  }
  return { status: "offline", statusText: "Offline", placeId: null, gameName: null };
}

async function getUserIdFromUsername(username) {
  try {
    await rateLimitWait();
    const searchUrl = `https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(username)}&limit=10`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();
    
    if (searchData.data && searchData.data.length > 0) {
      const exactMatch = searchData.data.find(u => u.name.toLowerCase() === username.toLowerCase());
      if (exactMatch) {
        return exactMatch.id;
      }
      return searchData.data[0].id;
    }
    
    await rateLimitWait();
    const directUrl = "https://users.roblox.com/v1/usernames/users";
    const directRes = await fetch(directUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usernames: [username] })
    });
    const directData = await directRes.json();
    
    if (directData.data && directData.data.length > 0) {
      return directData.data[0].id;
    }
    
    return null;
  } catch (error) {
    console.error("getUserIdFromUsername error:", error);
    return null;
  }
}

async function getRobloxUserInfo(username, bypassCache = false) {
  const cacheKey = username.toLowerCase();
  
  if (!bypassCache && userCache.has(cacheKey)) {
    const cached = userCache.get(cacheKey);
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`Using cached data for ${username}`);
      return cached.data;
    }
    userCache.delete(cacheKey);
  }
  
  try {
    const userId = await getUserIdFromUsername(username);
    if (!userId) {
      console.log(`User not found: ${username}`);
      return null;
    }
    
    console.log(`Found user ID for ${username}: ${userId}`);
    
    await rateLimitWait();
    const userUrl = `https://users.roblox.com/v1/users/${userId}`;
    const userRes = await fetch(userUrl);
    const userData = await userRes.json();
    
    if (!userData || !userData.id) {
      return null;
    }
    
    await rateLimitWait();
    const avatarUrl = `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=720x720&format=Png&isCircular=false`;
    const avatarRes = await fetch(avatarUrl);
    const avatarData = await avatarRes.json();
    
    const presence = await getUserPresence(userId);
    
    const result = {
      id: userId,
      username: userData.name,
      displayName: userData.displayName,
      headshot: avatarData.data?.[0]?.imageUrl,
      created: userData.created,
      status: presence.status,
      statusText: presence.statusText,
      placeId: presence.placeId,
      gameName: presence.gameName
    };
    
    userCache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });
    
    return result;
  } catch (error) {
    console.error("getRobloxUserInfo error:", error);
    return null;
  }
}

async function findUserInServers(userId, gamePlaceId) {
  let cursor = "";
  let serversScanned = 0;
  let attempts = 0;
  const userIdStr = userId.toString();
  
  console.log(`Searching for user ${userIdStr} in game ${gamePlaceId}`);
  
  try {
    while (attempts < 30) {
      await rateLimitWait();
      const url = `https://games.roblox.com/v1/games/${gamePlaceId}/servers/Public?limit=100${cursor ? `&cursor=${cursor}` : ""}`;
      const response = await fetch(url);
      
      if (response.status === 429) {
        console.log("Rate limited, waiting 2 seconds...");
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      
      const data = await response.json();
      
      if (!data.data || data.data.length === 0) break;
      
      for (const server of data.data) {
        serversScanned++;
        
        let playerIds = [];
        
        if (server.playing && Array.isArray(server.playing)) {
          playerIds = server.playing.map(p => p.toString());
        }
        
        if (playerIds.includes(userIdStr)) {
          console.log(`Found user in server after scanning ${serversScanned} servers`);
          return {
            found: true,
            jobId: server.id,
            players: server.playing,
            maxPlayers: server.maxPlayers,
            serversScanned: serversScanned
          };
        }
      }
      
      cursor = data.nextPageCursor || "";
      if (!cursor) break;
      attempts++;
      await new Promise(r => setTimeout(r, 100));
    }
    
    console.log(`User not found after scanning ${serversScanned} servers`);
    return {
      found: false,
      serversScanned: serversScanned
    };
    
  } catch (error) {
    console.error("findUserInServers error:", error);
    return { found: false, error: true, serversScanned: serversScanned };
  }
}

async function performSnipe(username) {
  const userInfo = await getRobloxUserInfo(username, true);
  if (!userInfo) {
    return { success: false, error: "User not found on Roblox" };
  }
  
  if (userInfo.status === "offline") {
    return {
      success: false,
      error: "offline",
      username: userInfo.username,
      statusText: userInfo.statusText
    };
  }
  
  if (userInfo.status === "online") {
    return {
      success: false,
      error: "online_not_ingame",
      username: userInfo.username,
      statusText: userInfo.statusText
    };
  }
  
  if (userInfo.placeId && userInfo.placeId.toString() !== FAME_GAME_ID) {
    return {
      success: false,
      error: "wrong_game",
      username: userInfo.username,
      statusText: `In ${userInfo.gameName || "a different game"} (not ${FAME_GAME_NAME})`,
      currentGame: userInfo.gameName
    };
  }
  
  const result = await findUserInServers(userInfo.id, FAME_GAME_ID);
  
  if (!result.found) {
    return {
      success: false,
      error: "not_found_in_servers",
      username: userInfo.username,
      serversScanned: result.serversScanned,
      statusText: "In Fame but server not found (possibly private server)"
    };
  }
  
  return {
    success: true,
    username: userInfo.username,
    userId: userInfo.id,
    avatar: userInfo.headshot,
    game: FAME_GAME_NAME,
    gameId: FAME_GAME_ID,
    jobId: result.jobId,
    players: result.players,
    maxPlayers: result.maxPlayers,
    serversScanned: result.serversScanned,
    joinLink: `https://www.roblox.com/games/${FAME_GAME_ID}?jobId=${result.jobId}`
  };
}

// ============ DISCORD BOT ============
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages],
  partials: [Partials.Channel]
});

async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName("snipe")
      .setDescription(`Find a player in ${FAME_GAME_NAME} and join their game`)
      .addStringOption(opt => 
        opt.setName("username")
          .setDescription("Roblox username to find")
          .setRequired(true)
      )
      .setIntegrationTypes([
        ApplicationIntegrationType.GuildInstall,
        ApplicationIntegrationType.UserInstall
      ])
      .setContexts([
        InteractionContextType.Guild,
        InteractionContextType.BotDM,
        InteractionContextType.PrivateChannel
      ])
      .toJSON(),
    
    new SlashCommandBuilder()
      .setName("servers")
      .setDescription(`View all public ${FAME_GAME_NAME} servers with player counts and regions`)
      .setIntegrationTypes([
        ApplicationIntegrationType.GuildInstall,
        ApplicationIntegrationType.UserInstall
      ])
      .setContexts([
        InteractionContextType.Guild,
        InteractionContextType.BotDM,
        InteractionContextType.PrivateChannel
      ])
      .toJSON()
  ];

  const rest = new REST({ version: "10" }).setToken(TOKEN);
  try {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log("Discord commands registered!");
  } catch (err) {
    console.error("Command registration failed:", err);
  }
}

client.once("ready", async () => {
  console.log(`Discord bot logged in as ${client.user.tag}`);
  console.log(`Sniping game: ${FAME_GAME_NAME} (${FAME_GAME_ID})`);
  if (ROBLOX_COOKIE) {
    await refreshCsrfToken();
    console.log("Roblox cookie loaded");
  } else {
    console.warn("No ROBLOX_COOKIE set!");
  }
  await registerCommands();
});

// ============ MAIN COMMAND HANDLER ============
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  
  // /servers command
  if (interaction.commandName === "servers") {
    try {
      await interaction.deferReply();
      const userId = interaction.user.id;
      const allServers = await getAllFameServers();
      
      if (!allServers || allServers.length === 0) {
        const embed = new EmbedBuilder()
          .setTitle(`Servers for 🔓 ${FAME_GAME_NAME}`)
          .setDescription("No public servers found at the moment.")
          .setColor(0xFF0000);
        return interaction.editReply({ content: `<@${userId}>`, embeds: [embed] });
      }
      
      const gameIcon = await getGameIcon();
      let serverList = "";
      const displayServers = allServers.slice(0, 15);
      
      for (let i = 0; i < displayServers.length; i++) {
        const server = displayServers[i];
        const fillPercent = server.fillPercentage;
        let statusEmoji = "🟢";
        if (fillPercent < 30) statusEmoji = "🔴";
        else if (fillPercent < 70) statusEmoji = "🟡";
        
        serverList += `${statusEmoji} ${server.flag} **#${i}**\n`;
        serverList += `    Players: ${server.players}/${server.maxPlayers}\n`;
        serverList += `    Ping: ${server.ping}\n\n`;
      }
      
      if (allServers.length > 15) {
        serverList += `*and ${allServers.length - 15} more servers...*`;
      }
      
      const totalPlayers = allServers.reduce((sum, s) => sum + s.players, 0);
      const totalMaxPlayers = allServers.reduce((sum, s) => sum + s.maxPlayers, 0);
      
      const embed = new EmbedBuilder()
        .setTitle(`Servers for 🔓 ${FAME_GAME_NAME}`)
        .setDescription(`**Server Region:** All\n*Use the dropdown below to filter by region.*`)
        .addFields(
          { name: "Total Players", value: `${totalPlayers}/${totalMaxPlayers}`, inline: true },
          { name: "Active Servers", value: `${allServers.length}`, inline: true },
          { name: "Server List", value: serverList.substring(0, 1024), inline: false }
        )
        .setColor(0x2B2D31)
        .setThumbnail(gameIcon || "https://www.roblox.com/asset-thumbnail/image?assetId=121157515767845&width=420&height=420&format=png");
      
      const regions = [...new Set(allServers.map(s => s.region))];
      const regionOptions = [
        new StringSelectMenuOptionBuilder()
          .setLabel("All Regions")
          .setValue("all")
          .setDescription(`Show all servers (${allServers.length} total)`)
          .setEmoji("🌍"),
        ...regions.map(region => {
          const count = allServers.filter(s => s.region === region).length;
          let flagEmoji = "🌍";
          if (region.includes("US")) flagEmoji = "🇺🇸";
          else if (region === "Europe") flagEmoji = "🇪🇺";
          else if (region === "Asia") flagEmoji = "🌏";
          else if (region === "Australia") flagEmoji = "🇦🇺";
          else if (region === "Brazil") flagEmoji = "🇧🇷";
          
          return new StringSelectMenuOptionBuilder()
            .setLabel(region)
            .setValue(region)
            .setDescription(`${count} servers available`)
            .setEmoji(flagEmoji);
        })
      ];
      
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("server_region_filter")
        .setPlaceholder("Filter Servers by Region")
        .addOptions(regionOptions);
      
      const row = new ActionRowBuilder().addComponents(selectMenu);
      
      await interaction.editReply({
        content: `<@${userId}>`,
        embeds: [embed],
        components: [row]
      });
      
      const filter = (i) => i.customId === "server_region_filter" && i.user.id === userId;
      const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });
      
      collector.on("collect", async (menuInteraction) => {
        const selectedRegion = menuInteraction.values[0];
        const filteredServers = selectedRegion === "all" ? allServers : allServers.filter(s => s.region === selectedRegion);
        const regionName = selectedRegion === "all" ? "All" : selectedRegion;
        
        let filteredList = "";
        const displayFiltered = filteredServers.slice(0, 15);
        
        for (let i = 0; i < displayFiltered.length; i++) {
          const server = displayFiltered[i];
          const fillPercent = server.fillPercentage;
          let statusEmoji = "🟢";
          if (fillPercent < 30) statusEmoji = "🔴";
          else if (fillPercent < 70) statusEmoji = "🟡";
          
          filteredList += `${statusEmoji} ${server.flag} **#${i}**\n`;
          filteredList += `    Players: ${server.players}/${server.maxPlayers}\n`;
          filteredList += `    Ping: ${server.ping}\n\n`;
        }
        
        if (filteredServers.length > 15) {
          filteredList += `*and ${filteredServers.length - 15} more servers...*`;
        }
        
        if (filteredServers.length === 0) {
          filteredList = "No servers found in this region.";
        }
        
        const filteredTotalPlayers = filteredServers.reduce((sum, s) => sum + s.players, 0);
        const filteredTotalMax = filteredServers.reduce((sum, s) => sum + s.maxPlayers, 0);
        
        const updatedEmbed = new EmbedBuilder()
          .setTitle(`Servers for 🔓 ${FAME_GAME_NAME}`)
          .setDescription(`**Server Region:** ${regionName}\n*Use the dropdown below to filter by region.*`)
          .addFields(
            { name: "Total Players", value: `${filteredTotalPlayers}/${filteredTotalMax}`, inline: true },
            { name: "Active Servers", value: `${filteredServers.length}`, inline: true },
            { name: "Server List", value: filteredList.substring(0, 1024), inline: false }
          )
          .setColor(0x2B2D31)
          .setThumbnail(gameIcon || "https://www.roblox.com/asset-thumbnail/image?assetId=121157515767845&width=420&height=420&format=png");
        
        const updatedSelectMenu = new StringSelectMenuBuilder()
          .setCustomId("server_region_filter")
          .setPlaceholder(`Filtered: ${regionName}`)
          .addOptions(regionOptions);
        
        const updatedRow = new ActionRowBuilder().addComponents(updatedSelectMenu);
        
        await menuInteraction.update({
          embeds: [updatedEmbed],
          components: [updatedRow]
        });
      });
      
    } catch (error) {
      console.error("Servers command error:", error);
      const errorEmbed = new EmbedBuilder()
        .setTitle("Error")
        .setDescription(`Failed to fetch servers: ${error.message}`)
        .setColor(0xFF0000);
      
      if (interaction.deferred) {
        await interaction.editReply({ embeds: [errorEmbed] });
      } else {
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      }
    }
    return;
  }
  
  // /snipe command
  if (interaction.commandName !== "snipe") return;

  const startTime = Date.now();
  
  try {
    await interaction.deferReply();
    
    const username = interaction.options.getString("username");
    const userId = interaction.user.id;
    
    userCache.delete(username.toLowerCase());
    
    const userInfo = await getRobloxUserInfo(username, true);
    if (!userInfo) {
      const embed = new EmbedBuilder()
        .setTitle("User Not Found")
        .setDescription(`Could not find "${username}" on Roblox. Make sure the username is spelled correctly.`)
        .setColor(0xFF0000);
      return interaction.editReply({ content: `<@${userId}>`, embeds: [embed] });
    }
    
    console.log(`User status for ${username}: ${userInfo.status} - ${userInfo.statusText}`);
    
    if (userInfo.status === "offline") {
      const embed = new EmbedBuilder()
        .setTitle("Snipe Failed")
        .setDescription(`**${userInfo.username}** is currently Offline`)
        .addFields(
          { name: "Status", value: "Offline", inline: true },
          { name: "Tip", value: "Try again when they come online!", inline: true }
        )
        .setColor(0xFF0000)
        .setThumbnail(userInfo.headshot);
      return interaction.editReply({ content: `<@${userId}>`, embeds: [embed] });
    }
    
    if (userInfo.status === "online") {
      const embed = new EmbedBuilder()
        .setTitle("Snipe Failed")
        .setDescription(`**${userInfo.username}** is online but not in a game`)
        .addFields(
          { name: "Status", value: "Online", inline: true },
          { name: "Tip", value: "Wait for them to join a game!", inline: true }
        )
        .setColor(0xFFA500)
        .setThumbnail(userInfo.headshot);
      return interaction.editReply({ content: `<@${userId}>`, embeds: [embed] });
    }
    
    if (userInfo.placeId && userInfo.placeId.toString() !== FAME_GAME_ID) {
      const embed = new EmbedBuilder()
        .setTitle("Snipe Failed")
        .setDescription(`**${userInfo.username}** is in a different game`)
        .addFields(
          { name: "Current Game", value: userInfo.gameName || "Unknown Game", inline: true },
          { name: "Target Game", value: FAME_GAME_NAME, inline: true },
          { name: "Tip", value: `They need to be in ${FAME_GAME_NAME} to snipe!`, inline: false }
        )
        .setColor(0xFFA500)
        .setThumbnail(userInfo.headshot);
      return interaction.editReply({ content: `<@${userId}>`, embeds: [embed] });
    }
    
    // Loading animation
    const loadingFrames = ["⬜⬜⬜⬜", "🟦⬜⬜⬜", "🟦🟦⬜⬜", "🟦🟦🟦⬜", "🟦🟦🟦🟦"];
    let frameIndex = 0;
    
    const searchingEmbed = new EmbedBuilder()
      .setTitle("Searching...")
      .setDescription(`Looking for **${userInfo.username}** in **${FAME_GAME_NAME}**\n\n${loadingFrames[0]}\nScanning public servers...`)
      .setColor(0x5865F2)
      .setThumbnail(userInfo.headshot);
    
    await interaction.editReply({ content: `<@${userId}>`, embeds: [searchingEmbed] });
    
    const animationInterval = setInterval(async () => {
      frameIndex = (frameIndex + 1) % loadingFrames.length;
      const updatedEmbed = new EmbedBuilder()
        .setTitle("Searching...")
        .setDescription(`Looking for **${userInfo.username}** in **${FAME_GAME_NAME}**\n\n${loadingFrames[frameIndex]}\nScanning public servers...`)
        .setColor(0x5865F2)
        .setThumbnail(userInfo.headshot);
      
      await interaction.editReply({ content: `<@${userId}>`, embeds: [updatedEmbed] });
    }, 300);
    
    const result = await findUserInServers(userInfo.id, FAME_GAME_ID);
    clearInterval(animationInterval);
    
    const timeElapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    
    if (!result.found) {
      const recheck = await getRobloxUserInfo(username, true);
      
      if (recheck && (recheck.status === "offline" || recheck.status === "online")) {
        const embed = new EmbedBuilder()
          .setTitle("Snipe Failed")
          .setDescription(`**${userInfo.username}** left the game during the search`)
          .addFields(
            { name: "Servers Scanned", value: `${result.serversScanned} servers`, inline: true },
            { name: "Time", value: `${timeElapsed} seconds`, inline: true },
            { name: "Status Now", value: recheck.status === "offline" ? "Offline" : "Online", inline: true }
          )
          .setColor(0xFF0000)
          .
