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

const FAME_GAME_ID = "121157515767845";
const FAME_GAME_NAME = "Fame";

// Keep alive server for Render
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

// Convert username to user ID and get avatar
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
    
    const headshot = avatarData.data?.[0]?.imageUrl || null;
    
    return {
      id: userId,
      username: userData.name,
      displayName: userData.displayName,
      headshot: headshot,
      created: userData.created
    };
  } catch (error) {
    console.error("getRobloxUserInfo error:", error);
    return null;
  }
}

// Get user's current game with auth
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
      status: presence.userPresenceType
    };
  } catch (error) {
    console.error("getCurrentGame error:", error);
    return null;
  }
}

// Find user in game servers
async function findUserInFameServers(userId) {
  let cursor = "";
  let serversScanned = 0;
  let attempts = 0;
  
  try {
    while (attempts < 30) {
      const url = `https://games.roblox.com/v1/games/${FAME_GAME_ID}/servers/Public?limit=100${cursor ? `&cursor=${cursor}` : ""}`;
      const response = await fetch(url);
      
      if (response.status === 429) {
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
        
        if (playerIds.includes(userId.toString())) {
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
    console.error("findUserInFameServers error:", error);
    return { found: false, error: true, serversScanned: serversScanned };
  }
}

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
    console.log("Commands registered for Fame game!");
  } catch (err) {
    console.error("Command registration failed:", err);
  }
}

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  if (ROBLOX_COOKIE) {
    await refreshCsrfToken();
    console.log("Roblox cookie loaded");
  } else {
    console.warn("No ROBLOX_COOKIE set!");
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
    const userId = interaction.user.id;
    
    // Get user info with avatar
    const userInfo = await getRobloxUserInfo(username);
    if (!userInfo) {
      const embed = new EmbedBuilder()
        .setTitle("User Not Found")
        .setDescription(`Could not find "${username}" on Roblox`)
        .setColor(0xFF0000);
      return interaction.editReply({ content: `<@${userId}>`, embeds: [embed] });
    }
    
    // Get current game
    const game = await getCurrentGame(userInfo.id);
    
    if (!game || game.status !== 2 || !game.placeId) {
      const embed = new EmbedBuilder()
        .setTitle("Cannot Snipe")
        .setDescription(`${userInfo.username} is not in a public game or has privacy settings enabled.`)
        .addFields(
          { name: "Status", value: game?.status === 2 ? "In Game (Private/VIP Server)" : "Not in game", inline: true },
          { name: "Note", value: "Private servers cannot be sniped - this is a Roblox limitation.", inline: false }
        )
        .setColor(0xFF0000)
        .setThumbnail(userInfo.headshot);
      return interaction.editReply({ content: `<@${userId}>`, embeds: [embed] });
    }
    
    // Check if they're in Fame
    if (game.placeId.toString() !== FAME_GAME_ID) {
      let gameName = "Unknown Game";
      try {
        const gameRes = await fetch(`https://games.roblox.com/v1/games?universeIds=${game.placeId}`);
        const gameData = await gameRes.json();
        if (gameData.data && gameData.data[0]) {
          gameName = gameData.data[0].name;
        }
      } catch (e) {}
      
      const embed = new EmbedBuilder()
        .setTitle("Snipe Failed")
        .setDescription(`**${userInfo.username}** is in a different game`)
        .addFields(
          { name: "Current Game", value: gameName, inline: true },
          { name: "Target Game", value: FAME_GAME_NAME, inline: true }
        )
        .setColor(0xFFA500)
        .setThumbnail(userInfo.headshot);
      return interaction.editReply({ content: `<@${userId}>`, embeds: [embed] });
    }
    
    // Searching embed
    const searching = new EmbedBuilder()
      .setTitle("Searching...")
      .setDescription(`Looking for **${userInfo.username}** in **${FAME_GAME_NAME}**\nScanning public servers...`)
      .setColor(0x5865F2)
      .setThumbnail(userInfo.headshot);
    
    await interaction.editReply({ content: `<@${userId}>`, embeds: [searching] });
    
    // Find user in Fame servers
    const result = await findUserInFameServers(userInfo.id);
    const timeElapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    
    if (!result.found) {
      const embed = new EmbedBuilder()
        .setTitle("Snipe Failed")
        .setDescription(`Could not locate **${userInfo.username}** in **${FAME_GAME_NAME}**`)
        .addFields(
          { name: "Servers Scanned", value: `${result.serversScanned} servers`, inline: true },
          { name: "Time", value: `${timeElapsed} seconds`, inline: true },
          { name: "Possible Reason", value: "User may be in a private/VIP server", inline: false }
        )
        .setColor(0xFF0000)
        .setThumbnail(userInfo.headshot);
      return interaction.editReply({ content: `<@${userId}>`, embeds: [embed] });
    }
    
    // SUCCESS! - This produces the exact output you want
    const joinLink = `https://www.roblox.com/games/${FAME_GAME_ID}?jobId=${result.jobId}`;
    
    const embed = new EmbedBuilder()
      .setTitle("Player Found!")
      .setDescription(`Successfully found **${userInfo.username}** in **${FAME_GAME_NAME}**`)
      .addFields(
        { name: "Server Status", value: `${result.players}/${result.maxPlayers} players`, inline: false },
        { name: "Search Time", value: `${timeElapsed} seconds`, inline: true },
        { name: "Method", value: "public_api", inline: true }
      )
      .setColor(0x00FF00)
      .setThumbnail(userInfo.headshot)
      .setImage(userInfo.headshot);
    
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setLabel("Join Game")
          .setURL(joinLink)
          .setStyle(ButtonStyle.Link)
      );
    
    await interaction.editReply({ content: `<@${userId}>`, embeds: [embed], components: [row] });
    
  } catch (error) {
    console.error("Command error:", error);
    const errorEmbed = new EmbedBuilder()
      .setTitle("Error")
      .setDescription(`An error occurred: ${error.message}`)
      .setColor(0xFF0000);
    
    if (interaction.deferred) {
      await interaction.editReply({ embeds: [errorEmbed] });
    } else {
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  }
});

process.on("unhandledRejection", (error) => {
  console.error("Unhandled rejection:", error);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
});

client.login(TOKEN);
