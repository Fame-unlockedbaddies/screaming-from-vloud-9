const http = require("http");
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  ApplicationIntegrationType,
  InteractionContextType,
  Partials,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

/* ---------------- ENV ---------------- */
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const PORT = process.env.PORT || 3000;

if (!TOKEN || !CLIENT_ID) {
  console.error("❌ Missing TOKEN or CLIENT_ID");
  process.exit(1);
}

/* ---------------- KEEP ALIVE SERVER (REQUIRED FOR RENDER) ---------------- */
http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Bot is running");
}).listen(PORT, () => {
  console.log("🌐 Listening on port", PORT);
});

/* ---------------- DISCORD CLIENT ---------------- */
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
  partials: [Partials.Channel],
});

/* ---------------- HELPER: GET USER ID FROM USERNAME ---------------- */
async function getUserId(username) {
  try {
    const response = await fetch(`https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(username)}&limit=1`);
    const data = await response.json();
    
    if (!data.data || data.data.length === 0) return null;
    
    // Check for exact match
    const exactMatch = data.data.find(user => user.name.toLowerCase() === username.toLowerCase());
    if (exactMatch) return exactMatch.id;
    
    return data.data[0]?.id || null;
  } catch (error) {
    console.error("Error fetching user ID:", error);
    return null;
  }
}

/* ---------------- HELPER: GET USER PRESENCE (CURRENT GAME) ---------------- */
async function getUserPresence(userId) {
  try {
    const response = await fetch("https://presence.roblox.com/v1/presence/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userIds: [userId] })
    });
    const data = await response.json();
    
    if (!data.userPresences || data.userPresences.length === 0) return null;
    
    const presence = data.userPresences[0];
    return {
      placeId: presence.placeId,
      gameName: presence.gameId ? "Game" : "Not in game",
      lastLocation: presence.lastLocation,
      userPresenceType: presence.userPresenceType
    };
  } catch (error) {
    console.error("Error fetching presence:", error);
    return null;
  }
}

/* ---------------- HELPER: GET GAME NAME FROM PLACE ID ---------------- */
async function getGameName(placeId) {
  if (!placeId) return "Unknown Game";
  
  try {
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

/* ---------------- HELPER: FIND USER IN SERVERS (THE "SNIPE" LOGIC) ---------------- */
async function findUserInServers(userId, placeId, username) {
  let cursor = "";
  let attempts = 0;
  const maxServersToScan = 500; // Limit to avoid rate limits
  let serversScanned = 0;
  
  try {
    while (attempts < 20 && serversScanned < maxServersToScan) { // Max 20 pages
      const url = `https://games.roblox.com/v1/games/${placeId}/servers/Public?limit=100${cursor ? `&cursor=${cursor}` : ""}`;
      const response = await fetch(url);
      
      if (response.status === 429) {
        // Rate limited - wait 2 seconds
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }
      
      const data = await response.json();
      
      if (!data.data || data.data.length === 0) break;
      
      for (const server of data.data) {
        serversScanned++;
        
        // Check if user is in this server
        if (server.playing && server.playing.includes(userId)) {
          return {
            found: true,
            jobId: server.id,
            players: server.playing.length,
            maxPlayers: server.maxPlayers,
            serverName: server.name || "Public Server"
          };
        }
        
        if (serversScanned >= maxServersToScan) break;
      }
      
      cursor = data.nextPageCursor || "";
      attempts++;
      
      // Add small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return { found: false, serversScanned };
  } catch (error) {
    console.error("Error scanning servers:", error);
    return { found: false, error: true };
  }
}

/* ---------------- REGISTER SLASH COMMANDS ---------------- */
async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName("snipe")
      .setDescription("Find and join a specific Roblox player's game server")
      .addStringOption(option =>
        option.setName("username")
          .setDescription("Roblox username to find")
          .setRequired(true)
      )
      .addStringOption(option =>
        option.setName("gameid")
          .setDescription("Optional: Specific game ID to search in (overrides current game)")
          .setRequired(false)
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
    console.log("🔄 Registering slash commands...");
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log("✅ Slash commands registered");
  } catch (err) {
    console.error("❌ Command registration failed:", err);
  }
}

/* ---------------- READY ---------------- */
client.once("ready", async () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
  await registerCommands();
});

/* ---------------- COMMAND HANDLER ---------------- */
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "snipe") {
    // Defer reply immediately (scanning can take time)
    await interaction.deferReply();
    
    const username = interaction.options.getString("username");
    const customGameId = interaction.options.getString("gameid");
    
    // Step 1: Get User ID from username
    const userId = await getUserId(username);
    if (!userId) {
      const embed = new EmbedBuilder()
        .setTitle("❌ User Not Found")
        .setDescription(`Could not find Roblox user: **${username}**`)
        .setColor(0xff3333);
      return interaction.editReply({ embeds: [embed] });
    }
    
    // Step 2: Get user's current presence
    let presence = null;
    if (!customGameId) {
      presence = await getUserPresence(userId);
      
      if (!presence || presence.userPresenceType !== 2) {
        const embed = new EmbedBuilder()
          .setTitle("❌ User Not In Game")
          .setDescription(`**${username}** is currently not playing any game on Roblox.`)
          .addFields(
            { name: "Status", value: presence?.userPresenceType === 1 ? "Online" : "Offline", inline: true }
          )
          .setColor(0xff3333);
        return interaction.editReply({ embeds: [embed] });
      }
      
      if (!presence.placeId) {
        const embed = new EmbedBuilder()
          .setTitle("❌ Cannot Detect Game")
          .setDescription(`**${username}** is online but their current game cannot be detected.`)
          .setColor(0xff3333);
        return interaction.editReply({ embeds: [embed] });
      }
    }
    
    const placeId = customGameId || presence.placeId;
    const gameName = customGameId ? "Custom Game ID" : await getGameName(placeId);
    
    // Send searching embed
    const searchingEmbed = new EmbedBuilder()
      .setTitle("🔍 Searching For Player")
      .setDescription(`Looking for **${username}** in ${gameName}...\nThis may take up to 30 seconds.`)
      .setColor(0xffaa00);
    
    await interaction.editReply({ embeds: [searchingEmbed] });
    
    // Step 3: Search through servers
    const result = await findUserInServers(userId, placeId, username);
    
    if (result.found) {
      const joinLink = `roblox://placeId=${placeId}&jobId=${result.jobId}`;
      const webJoinLink = `https://www.roblox.com/games/${placeId}?jobId=${result.jobId}`;
      
      const embed = new EmbedBuilder()
        .setTitle("🎯 Player Found!")
        .setDescription(`Successfully found **${username}** in **${gameName}**`)
        .addFields(
          { name: "Server Status", value: `${result.players}/${result.maxPlayers} players`, inline: true },
          { name: "Server Type", value: result.serverName, inline: true },
          { name: "Search Results", value: `Scanned ${result.serversScanned || "?"} servers`, inline: true }
        )
        .setColor(0x00ff99)
        .setFooter({ text: "Click the button below to join! (Requires Roblox installed)" });
      
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setLabel("Join on PC (Roblox App)")
            .setURL(joinLink)
            .setStyle(ButtonStyle.Link),
          new ButtonBuilder()
            .setLabel("Join in Browser")
            .setURL(webJoinLink)
            .setStyle(ButtonStyle.Link)
        );
      
      return interaction.editReply({ embeds: [embed], components: [row] });
    } else {
      const embed = new EmbedBuilder()
        .setTitle("❌ Player Not Found")
        .setDescription(`Could not find **${username}** in ${gameName}`)
        .addFields(
          { name: "Possible Reasons", value: 
            "• User is in a private/VIP server\n" +
            "• User left the game during search\n" +
            "• Game has too many servers (rate limited)\n" +
            "• User is in a different region-locked server"
          },
          { name: "Servers Scanned", value: `${result.serversScanned || 0} public servers`, inline: true }
        )
        .setColor(0xff3333);
      
      return interaction.editReply({ embeds: [embed] });
    }
  }
});

/* ---------------- ERROR HANDLING ---------------- */
process.on("unhandledRejection", (error) => {
  console.error("Unhandled promise rejection:", error);
});

/* ---------------- LOGIN ---------------- */
client.login(TOKEN);
