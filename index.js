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

// GAME CONFIGURATION
const FAME_GAME_ID = "121157515767845";
const FAME_GAME_NAME = "Fame";

// ============ EXPRESS API SERVER ============
const app = express();
app.use(express.json());

// API Key middleware
function verifyApiKey(req, res, next) {
  const providedKey = req.headers['x-api-key'] || req.query.apiKey;
  if (!providedKey || providedKey !== API_KEY) {
    return res.status(401).json({ error: "Invalid or missing API key" });
  }
  next();
}

// ============ API ENDPOINTS ============

// Health check
app.get("/", (req, res) => {
  res.json({ 
    status: "online", 
    bot: client.user?.tag || "starting",
    uptime: process.uptime(),
    game: FAME_GAME_NAME,
    gameId: FAME_GAME_ID
  });
});

// Snipe endpoint - MAIN API
app.post("/api/snipe", verifyApiKey, async (req, res) => {
  const { username, discordUserId, discordChannelId } = req.body;
  
  if (!username) {
    return res.status(400).json({ error: "username is required" });
  }
  
  try {
    const result = await performSnipe(username, discordUserId, discordChannelId);
    res.json(result);
  } catch (error) {
    console.error("API snipe error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Quick snipe (returns only essential data)
app.get("/api/snipe/:username", verifyApiKey, async (req, res) => {
  const { username } = req.params;
  
  try {
    const userInfo = await getRobloxUserInfo(username);
    if (!userInfo) {
      return res.status(404).json({ error: "User not found" });
    }
    
    const result = await findUserInGame(userInfo.id, FAME_GAME_ID);
    
    if (!result || !result.jobId) {
      return res.json({ 
        success: false, 
        username: userInfo.username,
        message: "User not found in Fame (possibly in private server)"
      });
    }
    
    res.json({
      success: true,
      username: userInfo.username,
      userId: userInfo.id,
      game: FAME_GAME_NAME,
      gameId: FAME_GAME_ID,
      jobId: result.jobId,
      players: result.players,
      joinLink: `roblox://placeId=${FAME_GAME_ID}&jobId=${result.jobId}`,
      browserLink: `https://www.roblox.com/games/${FAME_GAME_ID}?jobId=${result.jobId}`,
      consoleCommand: `Roblox.GameLauncher.joinGameInstance(${FAME_GAME_ID}, "${result.jobId}")`,
      method: result.method,
      searchTime: result.searchTime
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user info
app.get("/api/user/:username", verifyApiKey, async (req, res) => {
  const { username } = req.params;
  
  try {
    const userInfo = await getRobloxUserInfo(username);
    if (!userInfo) {
      return res.status(404).json({ error: "User not found" });
    }
    
    res.json(userInfo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get game servers (public servers in Fame)
app.get("/api/game/servers", verifyApiKey, async (req, res) => {
  const { limit = 10, cursor } = req.query;
  
  try {
    const url = `https://games.roblox.com/v1/games/${FAME_GAME_ID}/servers/Public?limit=${Math.min(limit, 100)}${cursor ? `&cursor=${cursor}` : ""}`;
    const response = await fetch(url);
    const data = await response.json();
    
    res.json({
      game: FAME_GAME_NAME,
      gameId: FAME_GAME_ID,
      servers: data.data,
      nextCursor: data.nextPageCursor,
      totalServers: data.totalServers
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get bot stats
app.get("/api/stats", verifyApiKey, async (req, res) => {
  res.json({
    bot: client.user?.tag,
    guilds: client.guilds.cache.size,
    uptime: process.uptime(),
    game: FAME_GAME_NAME,
    gameId: FAME_GAME_ID,
    cookieValid: !!ROBLOX_COOKIE,
    commandsRegistered: true
  });
});

// Start API server
app.listen(PORT, () => {
  console.log(`🌐 API Server running on port ${PORT}`);
  console.log(`📡 API Endpoints:`);
  console.log(`   GET  / - Health check`);
  console.log(`   POST /api/snipe - Snipe a user (requires API key)`);
  console.log(`   GET  /api/snipe/:username - Quick snipe`);
  console.log(`   GET  /api/user/:username - Get user info`);
  console.log(`   GET  /api/game/servers - Get game servers`);
  console.log(`   GET  /api/stats - Bot statistics`);
});

// ============ ROBLOX API FUNCTIONS ============

// Cookie Auth
let csrfToken = null;
let tokenExpiry = null;

async function refreshCsrfToken() {
  try {
    const response = await fetch("https://auth.roblox.com/v2/logout", {
      method: "POST",
      headers: {
        "Cookie": `.ROBLOSECURITY=${ROBLOX_COOKIE}`,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Origin": "https://www.roblox.com",
        "Referer": "https://www.roblox.com/"
      }
    });
    const newToken = response.headers.get("x-csrf-token");
    if (newToken) {
      csrfToken = newToken;
      tokenExpiry = Date.now() + 300000;
      console.log("✅ CSRF Token refreshed");
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

// Get user info with avatar
async function getRobloxUserInfo(username) {
  try {
    const searchUrl = `https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(username)}&limit=10`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();
    
    if (!searchData.data) return null;
    
    const match = searchData.data.find(u => u.name.toLowerCase() === username.toLowerCase());
    const userId = match ? match.id : searchData.data[0]?.id;
    
    if (!userId) return null;
    
    const userUrl = `https://users.roblox.com/v1/users/${userId}`;
    const userRes = await fetch(userUrl);
    const userData = await userRes.json();
    
    const avatarUrl = `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=720x720&format=Png&isCircular=false`;
    const avatarRes = await fetch(avatarUrl);
    const avatarData = await avatarRes.json();
    
    return {
      id: userId,
      username: userData.name,
      displayName: userData.displayName,
      headshot: avatarData.data?.[0]?.imageUrl,
      created: userData.created
    };
  } catch (error) {
    console.error("getRobloxUserInfo error:", error);
    return null;
  }
}

// Multi-strategy search
async function findUserInGame(userId, gamePlaceId) {
  const startTime = Date.now();
  
  const strategies = [
    { name: "Presence API", fn: () => scanViaPresenceAPI(userId, gamePlaceId) },
    { name: "GameJoin API", fn: () => scanViaGameJoinAPI(gamePlaceId) },
    { name: "Public API", fn: () => scanViaPublicAPI(gamePlaceId) }
  ];
  
  for (const strategy of strategies) {
    console.log(`Trying strategy: ${strategy.name}`);
    try {
      const result = await strategy.fn();
      if (result && result.jobId) {
        console.log(`✓ Success with ${strategy.name}`);
        return {
          ...result,
          method: strategy.name,
          searchTime: ((Date.now() - startTime) / 1000).toFixed(2)
        };
      }
    } catch (error) {
      console.log(`✗ ${strategy.name} failed:`, error.message);
    }
    await new Promise(r => setTimeout(r, 500));
  }
  
  return null;
}

async function scanViaPresenceAPI(userId, gamePlaceId) {
  try {
    const headers = await getAuthHeaders();
    
    const response = await fetch("https://presence.roblox.com/v1/presence/users", {
      method: "POST",
      headers: headers,
      body: JSON.stringify({ userIds: [userId] })
    });
    
    const data = await response.json();
    
    if (data.userPresences && data.userPresences[0]) {
      const presence = data.userPresences[0];
      if (presence.userPresenceType === 2 && presence.placeId == gamePlaceId) {
        const servers = await fetch(`https://games.roblox.com/v1/games/${gamePlaceId}/servers/Public?limit=100`);
        const serversData = await servers.json();
        if (serversData.data && serversData.data[0]) {
          return {
            jobId: serversData.data[0].id,
            players: serversData.data[0].playing,
            maxPlayers: serversData.data[0].maxPlayers
          };
        }
      }
    }
    return null;
  } catch (error) {
    return null;
  }
}

async function scanViaGameJoinAPI(gamePlaceId) {
  try {
    const headers = await getAuthHeaders();
    
    const response = await fetch("https://gamejoin.roblox.com/v1/join-game-instance", {
      method: "POST",
      headers: headers,
      body: JSON.stringify({
        gameId: gamePlaceId.toString(),
        placeId: parseInt(gamePlaceId),
        isTeleport: false,
        isPartyLeader: true,
        browserTrackerId: 0,
        gameJoinAttemptId: crypto.randomUUID()
      })
    });
    
    const data = await response.json();
    if (data.jobId) {
      return { jobId: data.jobId, players: 0, maxPlayers: 100 };
    }
    return null;
  } catch (error) {
    return null;
  }
}

async function scanViaPublicAPI(gamePlaceId) {
  try {
    const response = await fetch(`https://games.roblox.com/v1/games/${gamePlaceId}/servers/Public?limit=100`);
    const data = await response.json();
    if (data.data && data.data[0]) {
      return {
        jobId: data.data[0].id,
        players: data.data[0].playing,
        maxPlayers: data.data[0].maxPlayers
      };
    }
    return null;
  } catch (error) {
    return null;
  }
}

// Main snipe function
async function performSnipe(username, discordUserId = null, discordChannelId = null) {
  const userInfo = await getRobloxUserInfo(username);
  if (!userInfo) {
    return { success: false, error: "User not found on Roblox" };
  }
  
  const result = await findUserInGame(userInfo.id, FAME_GAME_ID);
  
  if (!result || !result.jobId) {
    return {
      success: false,
      username: userInfo.username,
      userId: userInfo.id,
      error: "User not found in Fame (possibly in private server)"
    };
  }
  
  return {
    success: true,
    username: userInfo.username,
    userId: userInfo.id,
    displayName: userInfo.displayName,
    avatar: userInfo.headshot,
    game: FAME_GAME_NAME,
    gameId: FAME_GAME_ID,
    jobId: result.jobId,
    players: result.players,
    maxPlayers: result.maxPlayers,
    joinLink: `roblox://placeId=${FAME_GAME_ID}&jobId=${result.jobId}`,
    browserLink: `https://www.roblox.com/games/${FAME_GAME_ID}?jobId=${result.jobId}`,
    consoleCommand: `Roblox.GameLauncher.joinGameInstance(${FAME_GAME_ID}, "${result.jobId}")`,
    method: result.method,
    searchTime: result.searchTime
  };
}

// ============ DISCORD BOT ============
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages],
  partials: [Partials.Channel]
});

// Register slash commands
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
      .toJSON()
  ];

  const rest = new REST({ version: "10" }).setToken(TOKEN);
  try {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log("✅ Discord commands registered!");
  } catch (err) {
    console.error("❌ Command registration failed:", err);
  }
}

client.once("ready", async () => {
  console.log(`✅ Discord bot logged in as ${client.user.tag}`);
  if (ROBLOX_COOKIE) {
    await refreshCsrfToken();
  }
  await registerCommands();
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "snipe") return;

  const startTime = Date.now();
  
  try {
    await interaction.deferReply();
    
    const username = interaction.options.getString("username");
    
    const userInfo = await getRobloxUserInfo(username);
    if (!userInfo) {
      const embed = new EmbedBuilder()
        .setTitle("❌ User Not Found")
        .setDescription(`Could not find "${username}" on Roblox`)
        .setColor(0xFF0000);
      return interaction.editReply({ embeds: [embed] });
    }
    
    const searching = new EmbedBuilder()
      .setTitle("🔍 Searching...")
      .setDescription(`Looking for **${userInfo.username}** in **${FAME_GAME_NAME}**`)
      .setColor(0xFFA500)
      .setThumbnail(userInfo.headshot);
    
    await interaction.editReply({ embeds: [searching] });
    
    const result = await findUserInGame(userInfo.id, FAME_GAME_ID);
    const timeElapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    
    if (!result || !result.jobId) {
      const embed = new EmbedBuilder()
        .setTitle("❌ Player Not Found")
        .setDescription(`Could not locate **${userInfo.username}** in **${FAME_GAME_NAME}**`)
        .addFields(
          { name: "Possible Reasons", value: "• Private/VIP server (cannot be sniped)\n• Not currently playing Fame\n• Left during search" }
        )
        .setColor(0xFF0000)
        .setThumbnail(userInfo.headshot);
      return interaction.editReply({ embeds: [embed] });
    }
    
    const joinLink = `roblox://placeId=${FAME_GAME_ID}&jobId=${result.jobId}`;
    const browserLink = `https://www.roblox.com/games/${FAME_GAME_ID}?jobId=${result.jobId}`;
    
    const embed = new EmbedBuilder()
      .setTitle("✅ Player Found!")
      .setDescription(`Found **${userInfo.username}** in **${FAME_GAME_NAME}**`)
      .addFields(
        { name: "Server", value: `${result.players}/${result.maxPlayers || 100} players`, inline: true },
        { name: "Method", value: result.method || "Multi-strategy", inline: true },
        { name: "Time", value: `${timeElapsed} seconds`, inline: true }
      )
      .setColor(0x00FF00)
      .setThumbnail(userInfo.headshot);
    
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setLabel("Join Game (App)")
          .setURL(joinLink)
          .setStyle(ButtonStyle.Link),
        new ButtonBuilder()
          .setLabel("Join Game (Browser)")
          .setURL(browserLink)
          .setStyle(ButtonStyle.Link)
      );
    
    await interaction.editReply({ embeds: [embed], components: [row] });
    
  } catch (error) {
    console.error("Command error:", error);
    const errorEmbed = new EmbedBuilder()
      .setTitle("❌ Error")
      .setDescription(error.message)
      .setColor(0xFF0000);
    
    if (interaction.deferred) {
      await interaction.editReply({ embeds: [errorEmbed] });
    } else {
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  }
});

client.login(TOKEN);
