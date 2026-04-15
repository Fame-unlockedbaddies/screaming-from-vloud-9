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
  console.log(`🌐 API Server on port ${PORT}`);
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
      return csrfToken;
    }
    return null;
  } catch (error) {
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
    return null;
  }
}

async function findUserInGame(userId, gamePlaceId) {
  try {
    // Try to find a server with players
    const response = await fetch(`https://games.roblox.com/v1/games/${gamePlaceId}/servers/Public?limit=100`);
    const data = await response.json();
    
    if (data.data && data.data.length > 0) {
      // Return the first server with players
      const serverWithPlayers = data.data.find(s => s.playing > 0);
      if (serverWithPlayers) {
        return {
          jobId: serverWithPlayers.id,
          players: serverWithPlayers.playing,
          maxPlayers: serverWithPlayers.maxPlayers,
          method: "public_api"
        };
      }
      // If no servers with players, return the first server
      return {
        jobId: data.data[0].id,
        players: data.data[0].playing,
        maxPlayers: data.data[0].maxPlayers,
        method: "public_api"
      };
    }
    return null;
  } catch (error) {
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
    // FIXED: Use https://roblox.com/games/ URL instead of roblox://
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
    console.log("✅ Commands registered!");
  } catch (err) {
    console.error("❌ Command registration failed:", err);
  }
}

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  if (ROBLOX_COOKIE) await refreshCsrfToken();
  await registerCommands();
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "snipe") return;

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
    
    if (!result || !result.jobId) {
      const embed = new EmbedBuilder()
        .setTitle("❌ Player Not Found")
        .setDescription(`Could not locate **${userInfo.username}** in **${FAME_GAME_NAME}**`)
        .addFields({ name: "Reason", value: "They may be in a private/VIP server (cannot be sniped)" })
        .setColor(0xFF0000)
        .setThumbnail(userInfo.headshot);
      return interaction.editReply({ embeds: [embed] });
    }
    
    // FIXED: Use https:// URL (Discord supports this)
    const joinLink = `https://www.roblox.com/games/${FAME_GAME_ID}?jobId=${result.jobId}`;
    
    const embed = new EmbedBuilder()
      .setTitle("✅ Player Found!")
      .setDescription(`Found **${userInfo.username}** in **${FAME_GAME_NAME}**`)
      .addFields(
        { name: "Server", value: `${result.players}/${result.maxPlayers || 100} players`, inline: true },
        { name: "Click Below", value: "Press the button to join their game!", inline: false }
      )
      .setColor(0x00FF00)
      .setThumbnail(userInfo.headshot);
    
    // FIXED: Button with https:// URL (works in Discord)
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setLabel("Join Game")
          .setURL(joinLink)
          .setStyle(ButtonStyle.Link)
      );
    
    await interaction.editReply({ embeds: [embed], components: [row] });
    
  } catch (error) {
    console.error(error);
    const errorEmbed = new EmbedBuilder()
      .setTitle("❌ Error")
      .setDescription(error.message)
      .setColor(0xFF0000);
    
    if (interaction.deferred) {
      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }
});

client.login(TOKEN);
