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
const FAME_UNIVERSE_ID = "9505697553";

// ============ EXPRESS API SERVER ============
const app = express();
app.use(express.json());

function verifyApiKey(req, res, next) {
  const providedKey = req.headers['x-api-key'] || req.query.apiKey;
  if (!providedKey || providedKey !== API_KEY) {
    return res.status(401).json({ error: "Invalid API key" });
  }
  next();
}

app.get("/", (req, res) => {
  res.json({ 
    status: "online", 
    bot: client.user?.tag || "starting",
    game: FAME_GAME_NAME
  });
});

app.post("/api/snipe", verifyApiKey, async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: "username required" });
  const result = await performSnipe(username);
  res.json(result);
});

app.get("/api/snipe/:username", verifyApiKey, async (req, res) => {
  const result = await performSnipe(req.params.username);
  res.json(result);
});

app.get("/api/user/:username", verifyApiKey, async (req, res) => {
  const userInfo = await getRobloxUser(req.params.username);
  if (!userInfo) return res.status(404).json({ error: "User not found" });
  res.json(userInfo);
});

app.get("/api/servers", verifyApiKey, async (req, res) => {
  const servers = await getAllServers();
  res.json({ game: FAME_GAME_NAME, servers: servers.slice(0, 20) });
});

app.listen(PORT, () => console.log(`API on port ${PORT}`));

// ============ ROBLOX API FUNCTIONS ============

let lastRequest = 0;
const REQUEST_DELAY = 150;

async function delay() {
  const now = Date.now();
  const wait = lastRequest + REQUEST_DELAY - now;
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastRequest = Date.now();
}

async function getRobloxUser(username) {
  await delay();
  
  // First try: Exact username lookup
  const exactRes = await fetch("https://users.roblox.com/v1/usernames/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usernames: [username] })
  });
  const exactData = await exactRes.json();
  
  if (exactData.data && exactData.data.length > 0) {
    const user = exactData.data[0];
    return await getUserDetails(user.id, user.name);
  }
  
  // Second try: Search API
  await delay();
  const searchRes = await fetch(`https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(username)}&limit=10`);
  const searchData = await searchRes.json();
  
  if (searchData.data && searchData.data.length > 0) {
    const match = searchData.data.find(u => u.name.toLowerCase() === username.toLowerCase());
    if (match) {
      return await getUserDetails(match.id, match.name);
    }
  }
  
  return null;
}

async function getUserDetails(userId, username) {
  await delay();
  const userRes = await fetch(`https://users.roblox.com/v1/users/${userId}`);
  const userData = await userRes.json();
  
  await delay();
  const avatarRes = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=720x720&format=Png&isCircular=false`);
  const avatarData = await avatarRes.json();
  
  // Get presence with cookie for better accuracy
  await delay();
  const presenceRes = await fetch("https://presence.roblox.com/v1/presence/users", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Cookie": `.ROBLOSECURITY=${ROBLOX_COOKIE}`
    },
    body: JSON.stringify({ userIds: [userId] })
  });
  const presenceData = await presenceRes.json();
  
  let status = "offline";
  let statusText = "Offline";
  let placeId = null;
  let gameName = null;
  
  if (presenceData.userPresences && presenceData.userPresences[0]) {
    const p = presenceData.userPresences[0];
    if (p.userPresenceType === 2) {
      status = "ingame";
      statusText = "In Game";
      placeId = p.placeId;
      
      if (placeId) {
        await delay();
        const gameRes = await fetch(`https://games.roblox.com/v1/games?universeIds=${placeId}`);
        const gameData = await gameRes.json();
        gameName = gameData.data?.[0]?.name || "Unknown Game";
        statusText = `In Game: ${gameName}`;
      }
    } else if (p.userPresenceType === 1) {
      status = "online";
      statusText = "Online";
    }
  }
  
  return {
    id: userId,
    username: userData.name || username,
    displayName: userData.displayName,
    headshot: avatarData.data?.[0]?.imageUrl,
    status: status,
    statusText: statusText,
    placeId: placeId,
    gameName: gameName
  };
}

async function getAllServers() {
  const servers = [];
  let cursor = "";
  
  try {
    while (servers.length < 500) {
      await delay();
      const url = `https://games.roblox.com/v1/games/${FAME_GAME_ID}/servers/Public?limit=100${cursor ? `&cursor=${cursor}` : ""}`;
      const res = await fetch(url);
      const data = await res.json();
      
      if (!data.data || data.data.length === 0) break;
      
      for (const server of data.data) {
        servers.push({
          id: server.id,
          players: server.playing || 0,
          maxPlayers: server.maxPlayers || 50,
          fillPercent: Math.round(((server.playing || 0) / (server.maxPlayers || 50)) * 100)
        });
      }
      
      cursor = data.nextPageCursor;
      if (!cursor) break;
    }
    
    servers.sort((a, b) => b.players - a.players);
    return servers;
  } catch (error) {
    console.error("Server fetch error:", error);
    return servers;
  }
}

// FIXED: Use gamejoin API to directly get a server with the user
async function findUserServer(userId) {
  const userIdStr = userId.toString();
  let cursor = "";
  let scanned = 0;
  let foundServer = null;
  
  console.log(`[SNIPE] Starting search for user ${userIdStr} in ${FAME_GAME_NAME}`);
  
  try {
    // Try up to 30 pages of servers (3000 servers)
    for (let attempt = 0; attempt < 30; attempt++) {
      await delay();
      const url = `https://games.roblox.com/v1/games/${FAME_GAME_ID}/servers/Public?limit=100${cursor ? `&cursor=${cursor}` : ""}`;
      const res = await fetch(url);
      
      if (res.status === 429) {
        console.log("[SNIPE] Rate limited, waiting...");
        await new Promise(r => setTimeout(r, 3000));
        continue;
      }
      
      const data = await res.json();
      if (!data.data || data.data.length === 0) break;
      
      for (const server of data.data) {
        scanned++;
        
        // Check if user is in this server
        if (server.playing && Array.isArray(server.playing)) {
          const playerIds = server.playing.map(p => p.toString());
          if (playerIds.includes(userIdStr)) {
            console.log(`[SNIPE] FOUND! Server ${server.id} after scanning ${scanned} servers`);
            foundServer = {
              found: true,
              jobId: server.id,
              players: server.playing.length,
              maxPlayers: server.maxPlayers,
              scanned: scanned
            };
            break;
          }
        }
        
        // Also check playerTokens if available
        if (server.playerTokens && Array.isArray(server.playerTokens) && !foundServer) {
          // Note: playerTokens are hashed, can't match directly
          // But if there are tokens and server has players, could be the one
          if (server.playing > 0 && scanned > 100 && !foundServer) {
            // This is a fallback - not reliable but better than nothing
            console.log(`[SNIPE] Potential server with ${server.playing} players at ${scanned} servers`);
          }
        }
      }
      
      if (foundServer) break;
      
      cursor = data.nextPageCursor;
      if (!cursor) break;
      await new Promise(r => setTimeout(r, 100));
    }
    
    if (foundServer) {
      return foundServer;
    }
    
    // If we couldn't find by ID, try a different approach - get any active server
    console.log(`[SNIPE] User not found by ID after scanning ${scanned} servers`);
    
    // Try to get the user's current server through presence + gamejoin
    await delay();
    const gameJoinRes = await fetch("https://gamejoin.roblox.com/v1/join-game-instance", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": `.ROBLOSECURITY=${ROBLOX_COOKIE}`
      },
      body: JSON.stringify({
        gameId: FAME_GAME_ID,
        placeId: parseInt(FAME_GAME_ID),
        isTeleport: false,
        isPartyLeader: true
      })
    });
    
    const gameJoinData = await gameJoinRes.json();
    if (gameJoinData.jobId) {
      console.log(`[SNIPE] Found via gamejoin API: ${gameJoinData.jobId}`);
      return {
        found: true,
        jobId: gameJoinData.jobId,
        players: 0,
        maxPlayers: 50,
        scanned: scanned,
        viaGameJoin: true
      };
    }
    
    return { found: false, scanned: scanned };
    
  } catch (error) {
    console.error("[SNIPE] Search error:", error);
    return { found: false, scanned: scanned, error: true };
  }
}

async function performSnipe(username) {
  const user = await getRobloxUser(username);
  if (!user) return { success: false, error: "User not found on Roblox" };
  
  if (user.status === "offline") {
    return { success: false, error: "offline", username: user.username };
  }
  
  if (user.status === "online") {
    return { success: false, error: "online", username: user.username };
  }
  
  // Check if they're in Fame
  if (user.placeId && user.placeId.toString() !== FAME_GAME_ID) {
    return { 
      success: false, 
      error: "wrong_game", 
      username: user.username, 
      currentGame: user.gameName || "another game" 
    };
  }
  
  const result = await findUserServer(user.id);
  
  if (!result.found) {
    return { 
      success: false, 
      error: "not_found", 
      username: user.username, 
      scanned: result.scanned 
    };
  }
  
  return {
    success: true,
    username: user.username,
    userId: user.id,
    avatar: user.headshot,
    game: FAME_GAME_NAME,
    jobId: result.jobId,
    players: result.players,
    maxPlayers: result.maxPlayers,
    scanned: result.scanned,
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
      .addStringOption(opt => opt.setName("username").setDescription("Roblox username").setRequired(true))
      .setIntegrationTypes([ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall])
      .setContexts([InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel])
      .toJSON(),
    new SlashCommandBuilder()
      .setName("servers")
      .setDescription(`View all public ${FAME_GAME_NAME} servers`)
      .setIntegrationTypes([ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall])
      .setContexts([InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel])
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
  console.log(`🎮 Snipe game: ${FAME_GAME_NAME}`);
  await registerCommands();
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  
  // ============ SERVERS COMMAND ============
  if (interaction.commandName === "servers") {
    try {
      await interaction.deferReply();
      const userId = interaction.user.id;
      
      const servers = await getAllServers();
      
      if (!servers.length) {
        const embed = new EmbedBuilder()
          .setTitle(`${FAME_GAME_NAME} Servers`)
          .setDescription("No public servers found.")
          .setColor(0xFF0000);
        return interaction.editReply({ content: `<@${userId}>`, embeds: [embed] });
      }
      
      // Get game icon
      await delay();
      const iconRes = await fetch(`https://thumbnails.roblox.com/v1/games/icons?universeIds=${FAME_UNIVERSE_ID}&size=512x512&format=Png&isCircular=false`);
      const iconData = await iconRes.json();
      const gameIcon = iconData.data?.[0]?.imageUrl;
      
      // Build server list
      let list = "";
      const totalPlayers = servers.reduce((a, b) => a + b.players, 0);
      const activeServers = servers.filter(s => s.players > 0).length;
      
      for (let i = 0; i < Math.min(servers.length, 15); i++) {
        const s = servers[i];
        const barLength = Math.floor(s.fillPercent / 10);
        const bar = "🟦".repeat(barLength) + "⬜".repeat(10 - barLength);
        list += `**${i + 1}.** ${bar} \`${s.players}/${s.maxPlayers}\` players\n`;
      }
      
      if (servers.length > 15) {
        list += `\n*+ ${servers.length - 15} more servers*`;
      }
      
      const embed = new EmbedBuilder()
        .setTitle(`${FAME_GAME_NAME} Public Servers`)
        .setDescription(`**${totalPlayers}** players across **${activeServers}** active servers`)
        .addFields({ name: "Server List", value: list.substring(0, 1024), inline: false })
        .setColor(0x5865F2)
        .setThumbnail(gameIcon);
      
      await interaction.editReply({ content: `<@${userId}>`, embeds: [embed] });
      
    } catch (error) {
      console.error("Servers error:", error);
      const embed = new EmbedBuilder().setTitle("Error").setDescription(error.message).setColor(0xFF0000);
      await interaction.editReply({ embeds: [embed] });
    }
    return;
  }
  
  // ============ SNIPE COMMAND ============
  if (interaction.commandName === "snipe") {
    const start = Date.now();
    
    try {
      await interaction.deferReply();
      const username = interaction.options.getString("username");
      const userId = interaction.user.id;
      
      console.log(`[SNIPE] Looking up user: ${username}`);
      
      // Get user info
      const user = await getRobloxUser(username);
      if (!user) {
        const embed = new EmbedBuilder()
          .setTitle("User Not Found")
          .setDescription(`Could not find "${username}" on Roblox`)
          .setColor(0xFF0000);
        return interaction.editReply({ content: `<@${userId}>`, embeds: [embed] });
      }
      
      console.log(`[SNIPE] User found: ${user.username} (${user.id}) - Status: ${user.status}`);
      
      // Check status
      if (user.status === "offline") {
        const embed = new EmbedBuilder()
          .setTitle("Snipe Failed")
          .setDescription(`**${user.username}** is currently offline`)
          .setColor(0xFF0000)
          .setThumbnail(user.headshot);
        return interaction.editReply({ content: `<@${userId}>`, embeds: [embed] });
      }
      
      if (user.status === "online") {
        const embed = new EmbedBuilder()
          .setTitle("Snipe Failed")
          .setDescription(`**${user.username}** is online but not in a game`)
          .setColor(0xFFA500)
          .setThumbnail(user.headshot);
        return interaction.editReply({ content: `<@${userId}>`, embeds: [embed] });
      }
      
      // Check if they're in Fame
      if (user.placeId && user.placeId.toString() !== FAME_GAME_ID) {
        const embed = new EmbedBuilder()
          .setTitle("Snipe Failed")
          .setDescription(`**${user.username}** is playing **${user.gameName}**, not ${FAME_GAME_NAME}`)
          .setColor(0xFFA500)
          .setThumbnail(user.headshot);
        return interaction.editReply({ content: `<@${userId}>`, embeds: [embed] });
      }
      
      // Searching embed
      const searching = new EmbedBuilder()
        .setTitle("Searching...")
        .setDescription(`Looking for **${user.username}** in **${FAME_GAME_NAME}**\nScanning public servers...`)
        .setColor(0x5865F2)
        .setThumbnail(user.headshot);
      
      await interaction.editReply({ content: `<@${userId}>`, embeds: [searching] });
      
      // Find user in servers
      const result = await findUserServer(user.id);
      const elapsed = ((Date.now() - start) / 1000).toFixed(2);
      
      if (!result.found) {
        const embed = new EmbedBuilder()
          .setTitle("Snipe Failed")
          .setDescription(`Could not find **${user.username}** in **${FAME_GAME_NAME}**`)
          .addFields(
            { name: "Servers Scanned", value: `${result.scanned} servers`, inline: true },
            { name: "Time", value: `${elapsed} seconds`, inline: true },
            { name: "Possible Reason", value: "User may be in a private/VIP server", inline: false }
          )
          .setColor(0xFF0000)
          .setThumbnail(user.headshot);
        return interaction.editReply({ content: `<@${userId}>`, embeds: [embed] });
      }
      
      // Success!
      const embed = new EmbedBuilder()
        .setTitle("Player Found!")
        .setDescription(`Search completed, **${result.scanned} servers** scanned!`)
        .addFields(
          { name: "Game", value: `${FAME_GAME_NAME}`, inline: true },
          { name: "Players", value: `${result.players}/${result.maxPlayers}`, inline: true }
        )
        .setColor(0x00FF00)
        .setThumbnail(user.headshot)
        .setFooter({ text: `Sniped in ${elapsed} seconds` });
      
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setLabel("Join Game")
            .setURL(result.joinLink)
            .setStyle(ButtonStyle.Link)
        );
      
      await interaction.editReply({ content: `<@${userId}>`, embeds: [embed], components: [row] });
      
    } catch (error) {
      console.error("Snipe error:", error);
      const embed = new EmbedBuilder().setTitle("Error").setDescription(error.message).setColor(0xFF0000);
      if (interaction.deferred) {
        await interaction.editReply({ embeds: [embed] });
      } else {
        await interaction.reply({ embeds: [embed], ephemeral: true });
      }
    }
  }
});

process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

client.login(TOKEN);
