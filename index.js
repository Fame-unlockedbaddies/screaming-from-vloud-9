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

const FAME_GAME_ID = "121157515767845";
const FAME_GAME_NAME = "Fame";

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
  const { limit = 10, cursor } = req.query;
  try {
    const url = `https://games.roblox.com/v1/games/${FAME_GAME_ID}/servers/Public?limit=${Math.min(limit, 100)}${cursor ? `&cursor=${cursor}` : ""}`;
    const response = await fetch(url);
    const data = await response.json();
    res.json({
      game: FAME_GAME_NAME,
      gameId: FAME_GAME_ID,
      servers: data.data,
      nextCursor: data.nextPageCursor
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
  console.log(`🌐 API Server running on port ${PORT}`);
});

// ============ ROBLOX FUNCTIONS ============

let csrfToken = null;
let tokenExpiry = null;

async function refreshCsrfToken() {
  try {
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

async function getRobloxUserInfo(username) {
  try {
    const searchUrl = `https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(username)}&limit=10`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();
    
    if (!searchData.data || searchData.data.length === 0) return null;
    
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

async function findUserInGame(userId, gamePlaceId) {
  try {
    let cursor = "";
    let attempts = 0;
    
    while (attempts < 20) {
      const url = `https://games.roblox.com/v1/games/${gamePlaceId}/servers/Public?limit=100${cursor ? `&cursor=${cursor}` : ""}`;
      const response = await fetch(url);
      
      if (response.status === 429) {
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      
      const data = await response.json();
      
      if (!data.data || data.data.length === 0) break;
      
      for (const server of data.data) {
        let playerList = [];
        
        if (server.playing) {
          if (Array.isArray(server.playing)) {
            playerList = server.playing;
          } else if (typeof server.playing === 'object') {
            playerList = Object.values(server.playing);
          } else if (typeof server.playing === 'number') {
            // If playing is just a count, we can't match by ID
            // Just return any server with players
            if (server.playing > 0) {
              return {
                jobId: server.id,
                players: server.playing,
                maxPlayers: server.maxPlayers || 100,
                method: "public_api"
              };
            }
          }
        }
        
        if (server.playerTokens && Array.isArray(server.playerTokens)) {
          playerList = [...playerList, ...server.playerTokens];
        }
        
        if (playerList.includes(userId.toString()) || playerList.includes(userId)) {
          return {
            jobId: server.id,
            players: server.playing ? (Array.isArray(server.playing) ? server.playing.length : server.playing) : 0,
            maxPlayers: server.maxPlayers || 100,
            method: "public_api"
          };
        }
      }
      
      cursor = data.nextPageCursor || "";
      if (!cursor) break;
      attempts++;
      await new Promise(r => setTimeout(r, 100));
    }
    
    // If we couldn't find by ID, return the first server with players
    const firstPage = await fetch(`https://games.roblox.com/v1/games/${gamePlaceId}/servers/Public?limit=100`);
    const firstData = await firstPage.json();
    if (firstData.data && firstData.data.length > 0) {
      const serverWithPlayers = firstData.data.find(s => s.playing > 0);
      if (serverWithPlayers) {
        return {
          jobId: serverWithPlayers.id,
          players: serverWithPlayers.playing,
          maxPlayers: serverWithPlayers.maxPlayers || 100,
          method: "public_api_fallback"
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error("findUserInGame error:", error);
    return null;
  }
}

async function performSnipe(username) {
  const userInfo = await getRobloxUserInfo(username);
  if (!userInfo) {
    return { success: false, error: "User not found on Roblox" };
  }
  
  const result = await findUserInGame(userInfo.id, FAME_GAME_ID);
  
  if (!result || !result.jobId) {
    return {
      success: false,
      username: userInfo.username,
      error: "User not found in Fame (possibly in private server)"
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
    joinLink: `https://www.roblox.com/games/${FAME_GAME_ID}?jobId=${result.jobId}`,
    method: result.method
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
  console.log(`🎮 Sniping game: ${FAME_GAME_NAME} (${FAME_GAME_ID})`);
  if (ROBLOX_COOKIE) {
    await refreshCsrfToken();
    console.log("✅ Roblox cookie loaded");
  } else {
    console.warn("⚠️ No ROBLOX_COOKIE set!");
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
    
    // Get user info with avatar
    const userInfo = await getRobloxUserInfo(username);
    if (!userInfo) {
      const embed = new EmbedBuilder()
        .setTitle("❌ User Not Found")
        .setDescription(`Could not find "${username}" on Roblox`)
        .setColor(0xFF0000);
      return interaction.editReply({ embeds: [embed] });
    }
    
    // Searching embed with avatar
    const searching = new EmbedBuilder()
      .setTitle("🔍 Searching for player...")
      .setDescription(`Looking for **${userInfo.username}** in **${FAME_GAME_NAME}**`)
      .addFields(
        { name: "Game", value: FAME_GAME_NAME, inline: true },
        { name: "Status", value: "Scanning public servers...", inline: true }
      )
      .setColor(0xFFA500)
      .setThumbnail(userInfo.headshot);
    
    await interaction.editReply({ embeds: [searching] });
    
    // Find the user
    const result = await findUserInGame(userInfo.id, FAME_GAME_ID);
    const timeElapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    
    if (!result || !result.jobId) {
      const embed = new EmbedBuilder()
        .setTitle("❌ Could Not Find Player")
        .setDescription(`Could not locate **${userInfo.username}** in **${FAME_GAME_NAME}**`)
        .addFields(
          { name: "Possible Reasons", value: 
            "• They are in a **Private/VIP Server** (cannot be sniped)\n" +
            "• They are not playing Fame right now\n" +
            "• They left the game during search"
          },
          { name: "Time Spent", value: `${timeElapsed} seconds`, inline: true }
        )
        .setColor(0xFF0000)
        .setThumbnail(userInfo.headshot);
      return interaction.editReply({ embeds: [embed] });
    }
    
    // SUCCESS! Create join link (using https:// so Discord accepts it)
    const joinLink = `https://www.roblox.com/games/${FAME_GAME_ID}?jobId=${result.jobId}`;
    
    const embed = new EmbedBuilder()
      .setTitle("✅ Player Found!")
      .setDescription(`Successfully found **${userInfo.username}** in **${FAME_GAME_NAME}**`)
      .addFields(
        { name: "Server Status", value: `${result.players}/${result.maxPlayers} players`, inline: true },
        { name: "Search Time", value: `${timeElapsed} seconds`, inline: true },
        { name: "Method", value: result.method || "Public Server Scan", inline: true }
      )
      .setColor(0x00FF00)
      .setThumbnail(userInfo.headshot)
      .setFooter({ text: "Click the button below to join their game!" });
    
    // Button with https:// URL (Discord accepts this)
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setLabel("Join Game")
          .setURL(joinLink)
          .setStyle(ButtonStyle.Link)
      );
    
    await interaction.editReply({ embeds: [embed], components: [row] });
    
  } catch (error) {
    console.error("Command error:", error);
    const errorEmbed = new EmbedBuilder()
      .setTitle("❌ Error")
      .setDescription(`An error occurred: ${error.message}`)
      .setColor(0xFF0000);
    
    if (interaction.deferred) {
      await interaction.editReply({ embeds: [errorEmbed] });
    } else {
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  }
});

// Error handling
process.on("unhandledRejection", (error) => {
  console.error("Unhandled rejection:", error);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
});

// Start the bot
client.login(TOKEN);
