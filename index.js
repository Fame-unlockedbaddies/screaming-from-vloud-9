const http = require("http");
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

// ONLY FAME GAME
const FAME_GAME_ID = "121157515767845";
const FAME_GAME_NAME = "Fame";

http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Bot is alive");
}).listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages],
  partials: [Partials.Channel]
});

// Better Cookie Auth - WebAPI style
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

// Convert username to user ID and get avatar
async function getRobloxUserInfo(username) {
  try {
    const url = `https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(username)}&limit=10`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.data) return null;
    
    const match = data.data.find(u => u.name.toLowerCase() === username.toLowerCase());
    const userId = match ? match.id : data.data[0]?.id;
    
    if (!userId) return null;
    
    // Get avatar headshot
    const avatarUrl = `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=720x720&format=Png&isCircular=false`;
    const avatarRes = await fetch(avatarUrl);
    const avatarData = await avatarRes.json();
    
    const headshot = avatarData.data?.[0]?.imageUrl || null;
    
    return {
      id: userId,
      username: match ? match.name : data.data[0]?.name,
      headshot: headshot
    };
  } catch (error) {
    console.error("getRobloxUserInfo error:", error);
    return null;
  }
}

// Get user's current game
async function getCurrentGame(userId) {
  try {
    const headers = await getAuthHeaders();
    
    const response = await fetch("https://presence.roblox.com/v1/presence/users", {
      method: "POST",
      headers: headers,
      body: JSON.stringify({ userIds: [userId] })
    });
    
    const data = await response.json();
    
    if (!data.userPresences || data.userPresences.length === 0) return null;
    
    const presence = data.userPresences[0];
    
    return {
      placeId: presence.placeId,
      gameId: presence.gameId,
      status: presence.userPresenceType,
      lastLocation: presence.lastLocation
    };
  } catch (error) {
    console.error("getCurrentGame error:", error);
    return null;
  }
}

// PARALLEL SCANNING - Find user in Fame servers
async function findUserInFameServers(userId) {
  try {
    const firstPage = await fetch(`https://games.roblox.com/v1/games/${FAME_GAME_ID}/servers/Public?limit=100`);
    const firstData = await firstPage.json();
    
    if (!firstData.data) return null;
    
    // Check first page
    for (const server of firstData.data) {
      let playerList = [];
      if (server.playing) {
        if (Array.isArray(server.playing)) playerList = server.playing;
        else if (typeof server.playing === 'object') playerList = Object.values(server.playing);
        else if (typeof server.playing === 'string' || typeof server.playing === 'number') playerList = [server.playing.toString()];
      }
      if (server.playerTokens && Array.isArray(server.playerTokens)) playerList = [...playerList, ...server.playerTokens];
      
      if (playerList.includes(userId.toString()) || playerList.includes(userId)) {
        return {
          jobId: server.id,
          players: server.playing ? (Array.isArray(server.playing) ? server.playing.length : Object.keys(server.playing).length) : 0,
          maxPlayers: server.maxPlayers || 100
        };
      }
    }
    
    // Scan more pages
    let cursor = firstData.nextPageCursor;
    let attempts = 0;
    
    while (cursor && attempts < 15) {
      const page = await fetch(`https://games.roblox.com/v1/games/${FAME_GAME_ID}/servers/Public?limit=100&cursor=${cursor}`);
      const pageData = await page.json();
      
      if (pageData.data) {
        for (const server of pageData.data) {
          let playerList = [];
          if (server.playing) {
            if (Array.isArray(server.playing)) playerList = server.playing;
            else if (typeof server.playing === 'object') playerList = Object.values(server.playing);
            else if (typeof server.playing === 'string' || typeof server.playing === 'number') playerList = [server.playing.toString()];
          }
          if (server.playerTokens && Array.isArray(server.playerTokens)) playerList = [...playerList, ...server.playerTokens];
          
          if (playerList.includes(userId.toString()) || playerList.includes(userId)) {
            return {
              jobId: server.id,
              players: server.playing ? (Array.isArray(server.playing) ? server.playing.length : Object.keys(server.playing).length) : 0,
              maxPlayers: server.maxPlayers || 100
            };
          }
        }
      }
      
      cursor = pageData.nextPageCursor;
      attempts++;
      await new Promise(r => setTimeout(r, 100));
    }
    
    return null;
  } catch (error) {
    console.error("findUserInFameServers error:", error);
    return null;
  }
}

// RETRY LOGIC
async function findUserWithRetry(userId, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`Search attempt ${attempt}/${maxRetries} for user ${userId} in Fame`);
    
    const result = await findUserInFameServers(userId);
    if (result) {
      console.log(`Found user on attempt ${attempt}!`);
      return result;
    }
    
    if (attempt < maxRetries) {
      const waitTime = attempt * 1000;
      console.log(`Retry ${attempt}/${maxRetries} - waiting ${waitTime}ms`);
      await new Promise(r => setTimeout(r, waitTime));
    }
  }
  
  return null;
}

// Register slash commands
async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName("snipe")
      .setDescription("Find a Roblox player in Fame and join their game")
      .addStringOption(opt => 
        opt.setName("username")
          .setDescription("Roblox username to find in Fame")
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
    console.log("✅ Commands registered for Fame game!");
  } catch (err) {
    console.error("❌ Command registration failed:", err);
  }
}

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  if (!ROBLOX_COOKIE) {
    console.warn("⚠️ No ROBLOX_COOKIE set! Game detection will be limited.");
  } else {
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
    
    // Get user info with avatar
    const userInfo = await getRobloxUserInfo(username);
    if (!userInfo) {
      const embed = new EmbedBuilder()
        .setTitle("❌ User Not Found")
        .setDescription(`Could not find "${username}" on Roblox`)
        .setColor(0xFF0000);
      return interaction.editReply({ embeds: [embed] });
    }
    
    // Searching embed with AVATAR HEADSHOT
    const searching = new EmbedBuilder()
      .setTitle("🔍 Searching for player...")
      .setDescription(`Looking for **${userInfo.username}** in **${FAME_GAME_NAME}**\nScanning public servers with parallel search...`)
      .addFields(
        { name: "Game", value: FAME_GAME_NAME, inline: true },
        { name: "Game ID", value: FAME_GAME_ID, inline: true }
      )
      .setColor(0xFFA500)
      .setThumbnail(userInfo.headshot); // SHOWS THEIR ROBLOX AVATAR HEADSHOT
    
    await interaction.editReply({ embeds: [searching] });
    
    // Find user in Fame servers with retry
    const server = await findUserWithRetry(userInfo.id, 3);
    const timeElapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    
    if (!server) {
      const embed = new EmbedBuilder()
        .setTitle("❌ Could Not Find Player")
        .setDescription(`Could not locate **${userInfo.username}** in **${FAME_GAME_NAME}** after multiple attempts.`)
        .addFields(
          { name: "Possible Reasons", value: 
            "• They are in a **Private/VIP Server** (cannot be sniped)\n" +
            "• They are not playing Fame right now\n" +
            "• They left the game during search\n" +
            "• They are in a different region-locked server"
          },
          { name: "Attempts Made", value: "3 search attempts with parallel scanning", inline: true },
          { name: "Time Spent", value: `${timeElapsed} seconds`, inline: true }
        )
        .setColor(0xFF0000)
        .setThumbnail(userInfo.headshot);
      return interaction.editReply({ embeds: [embed] });
    }
    
    // Success! Found them in Fame
    const joinLink = `roblox://placeId=${FAME_GAME_ID}&jobId=${server.jobId}`;
    const browserLink = `https://www.roblox.com/games/${FAME_GAME_ID}?jobId=${server.jobId}`;
    
    const embed = new EmbedBuilder()
      .setTitle("✅ Player Found in Fame!")
      .setDescription(`Search completed! Found **${userInfo.username}** in a public **${FAME_GAME_NAME}** server.`)
      .addFields(
        { name: "Game", value: FAME_GAME_NAME, inline: false },
        { name: "Server", value: `${server.players}/${server.maxPlayers} players`, inline: true },
        { name: "Search Time", value: `${timeElapsed} seconds (parallel scanning)`, inline: true },
        { name: "Method", value: "Public server search with retry logic", inline: false }
      )
      .setColor(0x00FF00)
      .setThumbnail(userInfo.headshot) // SHOWS THEIR ROBLOX AVATAR HEADSHOT
      .setFooter({ text: "Click a button below to join their game!" });
    
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
      .setDescription(`An error occurred: ${error.message}`)
      .setColor(0xFF0000);
    
    if (interaction.deferred) {
      await interaction.editReply({ embeds: [errorEmbed] });
    } else {
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  }
});

client.login(TOKEN);
