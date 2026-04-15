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

// Your custom emojis - REPLACE "emoji_name" with your actual emoji names!
const SEARCH_EMOJI = "<:emoji_name:1493915783779324024>"; // CHANGE "emoji_name" to your scanning emoji's name!
const SERVER_EMOJI = "<:emoji_name:1493913869112967208>"; // CHANGE "emoji_name" to your server emoji's name!

// Pink color for embeds
const PINK_COLOR = 0xFF69B4;  // Hot Pink

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

// Simple cache to prevent rate limits
const userCache = new Map();
const CACHE_TTL = 3000;

// Rate limiting
let lastRequestTime = 0;
const REQUEST_DELAY = 200;

async function waitForRateLimit() {
  const now = Date.now();
  const timeSinceLast = now - lastRequestTime;
  if (timeSinceLast < REQUEST_DELAY) {
    await new Promise(r => setTimeout(r, REQUEST_DELAY - timeSinceLast));
  }
  lastRequestTime = Date.now();
}

// Get user ID from username
async function getUserId(username) {
  try {
    await waitForRateLimit();
    
    const exactRes = await fetch("https://users.roblox.com/v1/usernames/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usernames: [username] })
    });
    const exactData = await exactRes.json();
    
    if (exactData.data && exactData.data.length > 0) {
      return { id: exactData.data[0].id, name: exactData.data[0].name };
    }
    
    await waitForRateLimit();
    const searchRes = await fetch(`https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(username)}&limit=10`);
    const searchData = await searchRes.json();
    
    if (searchData.data && searchData.data.length > 0) {
      const match = searchData.data.find(u => u.name.toLowerCase() === username.toLowerCase());
      if (match) {
        return { id: match.id, name: match.name };
      }
      return { id: searchData.data[0].id, name: searchData.data[0].name };
    }
    
    return null;
  } catch (error) {
    console.error("getUserId error:", error);
    return null;
  }
}

// Get user presence with cookie
async function getUserPresence(userId) {
  try {
    await waitForRateLimit();
    
    const response = await fetch("https://presence.roblox.com/v1/presence/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": `.ROBLOSECURITY=${ROBLOX_COOKIE}`
      },
      body: JSON.stringify({ userIds: [userId] })
    });
    
    const data = await response.json();
    
    if (data.userPresences && data.userPresences.length > 0) {
      const presence = data.userPresences[0];
      
      if (presence.userPresenceType === 2) {
        return {
          online: true,
          inGame: true,
          placeId: presence.placeId,
          gameId: presence.gameId,
          lastLocation: presence.lastLocation
        };
      } else if (presence.userPresenceType === 1) {
        return {
          online: true,
          inGame: false,
          placeId: null
        };
      } else {
        return {
          online: false,
          inGame: false,
          placeId: null
        };
      }
    }
    
    return { online: false, inGame: false, placeId: null };
  } catch (error) {
    console.error("getUserPresence error:", error);
    return { online: false, inGame: false, placeId: null };
  }
}

// Get user avatar
async function getUserAvatar(userId) {
  try {
    await waitForRateLimit();
    const response = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=720x720&format=Png&isCircular=false`);
    const data = await response.json();
    return data.data?.[0]?.imageUrl || null;
  } catch (error) {
    return null;
  }
}

// Get game name from place ID
async function getGameName(placeId) {
  if (!placeId) return "Unknown";
  try {
    await waitForRateLimit();
    const response = await fetch(`https://games.roblox.com/v1/games?universeIds=${placeId}`);
    const data = await response.json();
    return data.data?.[0]?.name || "Unknown Game";
  } catch (error) {
    return "Unknown Game";
  }
}

// Find user in Fame servers
async function findUserInFameServers(userId) {
  let cursor = "";
  let serversScanned = 0;
  const userIdStr = userId.toString();
  
  console.log(`[SEARCH] Looking for user ${userIdStr} in ${FAME_GAME_NAME}`);
  
  try {
    for (let attempt = 0; attempt < 20; attempt++) {
      await waitForRateLimit();
      const url = `https://games.roblox.com/v1/games/${FAME_GAME_ID}/servers/Public?limit=100${cursor ? `&cursor=${cursor}` : ""}`;
      const response = await fetch(url);
      
      if (response.status === 429) {
        console.log("[SEARCH] Rate limited, waiting...");
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      
      const data = await response.json();
      if (!data.data || data.data.length === 0) break;
      
      for (const server of data.data) {
        serversScanned++;
        
        if (server.playing && Array.isArray(server.playing)) {
          if (server.playing.map(p => p.toString()).includes(userIdStr)) {
            console.log(`[SEARCH] FOUND user after ${serversScanned} servers`);
            return {
              found: true,
              jobId: server.id,
              players: server.playing.length,
              maxPlayers: server.maxPlayers,
              scanned: serversScanned
            };
          }
        }
      }
      
      cursor = data.nextPageCursor;
      if (!cursor) break;
    }
    
    console.log(`[SEARCH] NOT FOUND after ${serversScanned} servers`);
    return { found: false, scanned: serversScanned };
  } catch (error) {
    console.error("[SEARCH] Error:", error);
    return { found: false, scanned: serversScanned, error: true };
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
    console.log("Commands registered!");
  } catch (err) {
    console.error("Command registration failed:", err);
  }
}

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  console.log(`Sniping game: ${FAME_GAME_NAME}`);
  await registerCommands();
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "snipe") return;

  const startTime = Date.now();
  
  try {
    await interaction.deferReply();
    
    const username = interaction.options.getString("username");
    const discordUserId = interaction.user.id;
    
    console.log(`[SNIPE] Looking up user: ${username}`);
    
    // Step 1: Get user ID
    const userData = await getUserId(username);
    if (!userData) {
      const embed = new EmbedBuilder()
        .setTitle("❌ User Not Found")
        .setDescription(`Could not find "${username}" on Roblox`)
        .setColor(PINK_COLOR)
        .setFooter({ text: "Fame Sniper Bot" });
      return interaction.editReply({ content: `<@${discordUserId}>`, embeds: [embed] });
    }
    
    const userId = userData.id;
    const actualUsername = userData.name;
    console.log(`[SNIPE] Found user: ${actualUsername} (${userId})`);
    
    // Step 2: Get user presence
    const presence = await getUserPresence(userId);
    console.log(`[SNIPE] Presence: online=${presence.online}, inGame=${presence.inGame}, placeId=${presence.placeId}`);
    
    // Step 3: Check if offline
    if (!presence.online) {
      const avatar = await getUserAvatar(userId);
      const embed = new EmbedBuilder()
        .setTitle("❌ Snipe Failed")
        .setDescription(`**${actualUsername}** is currently Offline`)
        .addFields(
          { name: "Status", value: "Offline", inline: true },
          { name: "Tip", value: "Try again when they come online!", inline: true }
        )
        .setColor(PINK_COLOR)
        .setThumbnail(avatar)
        .setFooter({ text: "Fame Sniper Bot" });
      return interaction.editReply({ content: `<@${discordUserId}>`, embeds: [embed] });
    }
    
    // Step 4: Check if online but not in game
    if (!presence.inGame) {
      const avatar = await getUserAvatar(userId);
      const embed = new EmbedBuilder()
        .setTitle("❌ Snipe Failed")
        .setDescription(`**${actualUsername}** is online but not in a game`)
        .addFields(
          { name: "Status", value: "Online", inline: true },
          { name: "Tip", value: "Wait for them to join a game!", inline: true }
        )
        .setColor(PINK_COLOR)
        .setThumbnail(avatar)
        .setFooter({ text: "Fame Sniper Bot" });
      return interaction.editReply({ content: `<@${discordUserId}>`, embeds: [embed] });
    }
    
    // Step 5: Check if they're in Fame
    if (presence.placeId && presence.placeId.toString() !== FAME_GAME_ID) {
      const avatar = await getUserAvatar(userId);
      const gameName = await getGameName(presence.placeId);
      const embed = new EmbedBuilder()
        .setTitle("❌ Snipe Failed")
        .setDescription(`**${actualUsername}** is in a different game`)
        .addFields(
          { name: "Current Game", value: gameName, inline: true },
          { name: "Target Game", value: FAME_GAME_NAME, inline: true },
          { name: "Tip", value: `They need to be in ${FAME_GAME_NAME} to snipe!`, inline: false }
        )
        .setColor(PINK_COLOR)
        .setThumbnail(avatar)
        .setFooter({ text: "Fame Sniper Bot" });
      return interaction.editReply({ content: `<@${discordUserId}>`, embeds: [embed] });
    }
    
    // Step 6: Get avatar for later
    const avatar = await getUserAvatar(userId);
    
    // Step 7: PINK SEARCHING EMBED WITH YOUR CUSTOM SCANNING EMOJI
    const searching = new EmbedBuilder()
      .setTitle(`${SEARCH_EMOJI} Searching for player...`)
      .setDescription(`${SERVER_EMOJI} Looking for **${actualUsername}** in **${FAME_GAME_NAME}**\n\n🔄 Scanning public servers...`)
      .setColor(PINK_COLOR)
      .setThumbnail(avatar)
      .setFooter({ text: "Fame Sniper Bot • Please wait" });
    
    await interaction.editReply({ content: `<@${discordUserId}>`, embeds: [searching] });
    
    // Step 8: Find user in servers
    const result = await findUserInFameServers(userId);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    
    if (!result.found) {
      const embed = new EmbedBuilder()
        .setTitle("❌ Snipe Failed")
        .setDescription(`Could not locate **${actualUsername}** in **${FAME_GAME_NAME}**`)
        .addFields(
          { name: "📊 Servers Scanned", value: `${result.scanned} servers`, inline: true },
          { name: "⏱️ Time", value: `${elapsed} seconds`, inline: true },
          { name: "❓ Possible Reason", value: "User may be in a private/VIP server", inline: false }
        )
        .setColor(PINK_COLOR)
        .setThumbnail(avatar)
        .setFooter({ text: "Fame Sniper Bot" });
      return interaction.editReply({ content: `<@${discordUserId}>`, embeds: [embed] });
    }
    
    // Step 9: PINK SUCCESS EMBED
    const joinLink = `https://www.roblox.com/games/${FAME_GAME_ID}?jobId=${result.jobId}`;
    
    const embed = new EmbedBuilder()
      .setTitle("✅ Player Found!")
      .setDescription(`✨ Successfully found **${actualUsername}** in **${FAME_GAME_NAME}** ✨`)
      .addFields(
        { name: "🎮 Server Status", value: `**${result.players}/${result.maxPlayers}** players`, inline: true },
        { name: "⏱️ Search Time", value: `**${elapsed}** seconds`, inline: true },
        { name: "🔧 Method", value: "public_api", inline: true },
        { name: "🖥️ Server ID", value: `\`${result.jobId.slice(0, 20)}...\``, inline: false }
      )
      .setColor(PINK_COLOR)
      .setThumbnail(avatar)
      .setImage(avatar)
      .setFooter({ text: "Fame Sniper Bot • Click Join to play!" })
      .setTimestamp();
    
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setLabel("🎮 Join Game")
          .setURL(joinLink)
          .setStyle(ButtonStyle.Link)
      );
    
    await interaction.editReply({ content: `<@${discordUserId}>`, embeds: [embed], components: [row] });
    
  } catch (error) {
    console.error("Snipe error:", error);
    const errorEmbed = new EmbedBuilder()
      .setTitle("❌ Error")
      .setDescription(`An error occurred: ${error.message}`)
      .setColor(PINK_COLOR)
      .setFooter({ text: "Fame Sniper Bot" });
    
    if (interaction.deferred) {
      await interaction.editReply({ embeds: [errorEmbed] });
    } else {
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  }
});

process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

client.login(TOKEN);
