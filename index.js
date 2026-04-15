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

// Get CSRF token
async function getCsrfToken() {
  try {
    const response = await fetch("https://auth.roblox.com/v2/logout", {
      method: "POST",
      headers: {
        "Cookie": `.ROBLOSECURITY=${ROBLOX_COOKIE}`
      }
    });
    const csrfToken = response.headers.get("x-csrf-token");
    return csrfToken;
  } catch (error) {
    console.error("CSRF error:", error);
    return null;
  }
}

// Convert username to user ID
async function usernameToId(username) {
  try {
    const url = `https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(username)}&limit=10`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.data) return null;
    const match = data.data.find(u => u.name.toLowerCase() === username.toLowerCase());
    return match ? match.id : data.data[0]?.id || null;
  } catch (error) {
    console.error("usernameToId error:", error);
    return null;
  }
}

// Get user's current game with proper auth
async function getCurrentGame(userId) {
  try {
    const csrfToken = await getCsrfToken();
    
    const response = await fetch("https://presence.roblox.com/v1/presence/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": `.ROBLOSECURITY=${ROBLOX_COOKIE}`,
        "x-csrf-token": csrfToken
      },
      body: JSON.stringify({ userIds: [userId] })
    });
    
    const data = await response.json();
    
    if (!data.userPresences || data.userPresences.length === 0) return null;
    
    const presence = data.userPresences[0];
    
    console.log(`Presence for ${userId}:`, {
      type: presence.userPresenceType,
      placeId: presence.placeId,
      hasCookie: !!ROBLOX_COOKIE
    });
    
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

// FIXED: Find user in game servers - handles both array and object formats
async function findUserServer(userId, placeId) {
  try {
    let cursor = "";
    let attempts = 0;
    
    while (attempts < 20) {
      const url = `https://games.roblox.com/v1/games/${placeId}/servers/Public?limit=100${cursor ? `&cursor=${cursor}` : ""}`;
      const res = await fetch(url);
      
      if (res.status === 429) {
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      
      const data = await res.json();
      if (!data.data) break;
      
      for (const server of data.data) {
        // FIX: Check if playing exists and handle both array and object formats
        let playerList = [];
        
        if (server.playing) {
          // If playing is an array
          if (Array.isArray(server.playing)) {
            playerList = server.playing;
          } 
          // If playing is an object with player IDs
          else if (typeof server.playing === 'object') {
            playerList = Object.values(server.playing);
          }
          // If playing is a string or number
          else if (typeof server.playing === 'string' || typeof server.playing === 'number') {
            playerList = [server.playing.toString()];
          }
        }
        
        // Also check playerTokens if available (older API format)
        if (server.playerTokens && Array.isArray(server.playerTokens)) {
          playerList = [...playerList, ...server.playerTokens];
        }
        
        // Convert userId to string for comparison
        const userIdStr = userId.toString();
        
        if (playerList.includes(userIdStr) || playerList.includes(userId)) {
          console.log(`Found user in server: ${server.id}`);
          return {
            jobId: server.id,
            players: server.playing ? (Array.isArray(server.playing) ? server.playing.length : Object.keys(server.playing).length) : 0,
            maxPlayers: server.maxPlayers || 100
          };
        }
      }
      
      cursor = data.nextPageCursor || "";
      if (!cursor) break;
      attempts++;
      await new Promise(r => setTimeout(r, 100));
    }
    
    return null;
  } catch (error) {
    console.error("findUserServer error:", error);
    return null;
  }
}

// Register slash commands
async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName("snipe")
      .setDescription("Find a Roblox player and join their game")
      .addStringOption(opt => 
        opt.setName("username")
          .setDescription("Roblox username")
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
  await registerCommands();
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "snipe") return;

  const startTime = Date.now();
  
  try {
    await interaction.deferReply();
    
    const username = interaction.options.getString("username");
    
    // Get user ID
    const userId = await usernameToId(username);
    if (!userId) {
      const embed = new EmbedBuilder()
        .setTitle("❌ User Not Found")
        .setDescription(`Could not find "${username}" on Roblox`)
        .setColor(0xFF0000);
      return interaction.editReply({ embeds: [embed] });
    }
    
    // Get current game
    const game = await getCurrentGame(userId);
    
    if (!game || game.status !== 2 || !game.placeId) {
      const embed = new EmbedBuilder()
        .setTitle("❌ Cannot Snipe")
        .setDescription(`${username} is not in a public game or has privacy settings enabled.`)
        .addFields(
          { name: "Status", value: game?.status === 2 ? "In Game (Private/VIP Server)" : "Not in game", inline: true },
          { name: "Note", value: "Private servers cannot be sniped - this is a Roblox limitation.", inline: false }
        )
        .setColor(0xFF0000);
      return interaction.editReply({ embeds: [embed] });
    }
    
    // Get game name
    let gameName = "Unknown Game";
    try {
      const gameRes = await fetch(`https://games.roblox.com/v1/games?universeIds=${game.placeId}`);
      const gameData = await gameRes.json();
      if (gameData.data && gameData.data[0]) {
        gameName = gameData.data[0].name;
      }
    } catch (e) {}
    
    // Searching embed
    const searching = new EmbedBuilder()
      .setTitle("🔍 Searching for player...")
      .setDescription(`Looking for **${username}** in **${gameName}**\nScanning public servers...`)
      .setColor(0xFFA500);
    
    await interaction.editReply({ embeds: [searching] });
    
    // Find server
    const server = await findUserServer(userId, game.placeId);
    const timeElapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    
    if (!server) {
      const embed = new EmbedBuilder()
        .setTitle("❌ Could Not Find Player")
        .setDescription(`Could not locate ${username} in any public server.`)
        .addFields(
          { name: "Possible Reasons", value: 
            "• They are in a **Private/VIP Server** (cannot be sniped)\n" +
            "• They left the game during search\n" +
            "• The game has too many servers to scan fully"
          }
        )
        .setColor(0xFF0000);
      return interaction.editReply({ embeds: [embed] });
    }
    
    // Success!
    const joinLink = `roblox://placeId=${game.placeId}&jobId=${server.jobId}`;
    const browserLink = `https://www.roblox.com/games/${game.placeId}?jobId=${server.jobId}`;
    
    const embed = new EmbedBuilder()
      .setTitle("✅ Player Found!")
      .setDescription(`Search completed! Found **${username}** in a public server.`)
      .addFields(
        { name: "Game", value: `${gameName}`, inline: false },
        { name: "Server", value: `${server.players}/${server.maxPlayers} players`, inline: true },
        { name: "Time", value: `${timeElapsed} seconds`, inline: true }
      )
      .setColor(0x00FF00);
    
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
