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
const PORT = process.env.PORT || 3000;

if (!TOKEN || !CLIENT_ID) {
  console.error("Missing TOKEN or CLIENT_ID");
  process.exit(1);
}

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

// Convert username to user ID
async function usernameToId(username) {
  const url = `https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(username)}&limit=10`;
  const res = await fetch(url);
  const data = await res.json();
  
  if (!data.data) return null;
  
  const match = data.data.find(u => u.name.toLowerCase() === username.toLowerCase());
  return match ? match.id : data.data[0]?.id || null;
}

// Get user's current game
async function getCurrentGame(userId) {
  const res = await fetch("https://presence.roblox.com/v1/presence/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userIds: [userId] })
  });
  const data = await res.json();
  
  if (!data.userPresences || data.userPresences.length === 0) return null;
  
  const presence = data.userPresences[0];
  return {
    placeId: presence.placeId,
    gameId: presence.gameId,
    status: presence.userPresenceType
  };
}

// Find user in game servers
async function findUserServer(userId, placeId) {
  let cursor = "";
  let attempts = 0;
  
  while (attempts < 15) {
    const url = `https://games.roblox.com/v1/games/${placeId}/servers/Public?limit=100${cursor ? `&cursor=${cursor}` : ""}`;
    const res = await fetch(url);
    
    if (res.status === 429) {
      await new Promise(r => setTimeout(r, 2000));
      continue;
    }
    
    const data = await res.json();
    if (!data.data) break;
    
    for (const server of data.data) {
      if (server.playing && server.playing.includes(userId.toString())) {
        return {
          jobId: server.id,
          players: server.playing.length,
          maxPlayers: server.maxPlayers
        };
      }
    }
    
    cursor = data.nextPageCursor || "";
    if (!cursor) break;
    attempts++;
    await new Promise(r => setTimeout(r, 150));
  }
  
  return null;
}

// Register slash commands (NOW WORKS IN DMS AND GROUP CHATS)
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
        ApplicationIntegrationType.GuildInstall,  // Servers
        ApplicationIntegrationType.UserInstall    // DMs and Group Chats
      ])
      .setContexts([
        InteractionContextType.Guild,              // Servers
        InteractionContextType.BotDM,              // DMs with bot
        InteractionContextType.PrivateChannel      // Group DMs
      ])
      .toJSON()
  ];

  const rest = new REST({ version: "10" }).setToken(TOKEN);
  
  try {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log("Commands registered! (Works in DMs, group chats, and servers)");
  } catch (err) {
    console.error("Failed to register commands:", err);
  }
}

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await registerCommands();
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "snipe") return;

  const startTime = Date.now();
  await interaction.deferReply();
  
  const username = interaction.options.getString("username");
  
  // Step 1: Get user ID
  const userId = await usernameToId(username);
  if (!userId) {
    const embed = new EmbedBuilder()
      .setTitle("❌ User Not Found")
      .setDescription(`Could not find "${username}" on Roblox`)
      .setColor(0xFF0000);
    return interaction.editReply({ embeds: [embed] });
  }
  
  // Step 2: Get current game
  const game = await getCurrentGame(userId);
  if (!game || game.status !== 2 || !game.placeId) {
    const embed = new EmbedBuilder()
      .setTitle("❌ User Not In Game")
      .setDescription(`${username} is not currently playing any game`)
      .setColor(0xFF0000);
    return interaction.editReply({ embeds: [embed] });
  }
  
  // Step 3: Get game name
  let gameName = "Unknown Game";
  try {
    const gameRes = await fetch(`https://games.roblox.com/v1/games?universeIds=${game.placeId}`);
    const gameData = await gameRes.json();
    if (gameData.data && gameData.data[0]) {
      gameName = gameData.data[0].name;
    }
  } catch (e) {}
  
  // Step 4: Send searching message
  const searching = new EmbedBuilder()
    .setTitle("🔍 Searching...")
    .setDescription(`Looking for ${username} in ${gameName}...`)
    .setColor(0xFFA500);
  
  await interaction.editReply({ embeds: [searching] });
  
  // Step 5: Find their server
  const server = await findUserServer(userId, game.placeId);
  const timeElapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  
  if (!server) {
    const embed = new EmbedBuilder()
      .setTitle("❌ Could Not Find Player")
      .setDescription(`${username} might be in a private server or left the game`)
      .setColor(0xFF0000);
    return interaction.editReply({ embeds: [embed] });
  }
  
  // Step 6: Success! Create join buttons
  const joinLink = `roblox://placeId=${game.placeId}&jobId=${server.jobId}`;
  const browserLink = `https://www.roblox.com/games/${game.placeId}?jobId=${server.jobId}`;
  
  const embed = new EmbedBuilder()
    .setTitle("✅ Player Found!")
    .setDescription(`Search completed! The player was found using their public join data.`)
    .addFields(
      { name: "Game", value: `${gameName} [${game.placeId}]`, inline: false },
      { name: "Sniped in", value: `${timeElapsed} seconds • ${new Date().toLocaleTimeString()}`, inline: false }
    )
    .setColor(0x00FF00);
  
  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setLabel("Join Game")
        .setURL(joinLink)
        .setStyle(ButtonStyle.Link),
      new ButtonBuilder()
        .setLabel("Join via Browser")
        .setURL(browserLink)
        .setStyle(ButtonStyle.Link)
    );
  
  await interaction.editReply({ embeds: [embed], components: [row] });
});

client.login(TOKEN);
