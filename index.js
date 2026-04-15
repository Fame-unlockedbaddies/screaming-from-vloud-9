const http = require("http");
const { WebhookClient } = require("discord.js");
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

// YOUR WEBHOOK URL
const WEBHOOK_URL = "https://discord.com/api/webhooks/1493916503291203654/xRsw3M1K4nAJm6c6WVEY99yK1_4XC53cK0JRbvAylSfc6t9XK-Jsi9o4uEU_iaYkRjhP";

// Initialize webhook
let webhook = null;
try {
  webhook = new WebhookClient({ url: WEBHOOK_URL });
  console.log("✅ Webhook logging enabled");
} catch (error) {
  console.error("❌ Failed to initialize webhook:", error.message);
}

const FAME_GAME_ID = "121157515767845";
const FAME_GAME_NAME = "Fame";

// Your custom emojis - REPLACE "emoji_name" with your actual emoji names!
const SEARCH_EMOJI = "<:emoji_name:1493915783779324024>"; // CHANGE "emoji_name" to your scanning emoji's name!
const SERVER_EMOJI = "<:emoji_name:1493913869112967208>"; // CHANGE "emoji_name" to your server emoji's name!

// Pink color for embeds
const PINK_COLOR = 0xFF69B4;

// Webhook logging function with PINK EMBEDS
async function logToWebhook(title, description, color = PINK_COLOR, fields = [], thumbnail = null, errorDetails = null) {
  if (!webhook) return;
  
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setTimestamp();
  
  if (fields && fields.length > 0) {
    embed.addFields(fields);
  }
  
  if (thumbnail) {
    embed.setThumbnail(thumbnail);
  }
  
  if (errorDetails) {
    embed.addFields(
      { name: "🔍 Error Details", value: `\`\`\`js\n${errorDetails.slice(0, 500)}\`\`\``, inline: false }
    );
  }
  
  embed.setFooter({ text: "Fame Sniper Bot • Log System" });
  
  try {
    await webhook.send({ embeds: [embed] });
  } catch (error) {
    console.error("Webhook send failed:", error);
  }
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

// Simple cache to prevent rate limits
const userCache = new Map();
const CACHE_TTL = 3000;

// Rate limiting
let lastRequestTime = 0;
const REQUEST_DELAY = 200;

// Track bot stats
let botStats = {
  totalSnipes: 0,
  successfulSnipes: 0,
  failedSnipes: 0,
  startTime: Date.now(),
  lastError: null,
  lastErrorTime: null
};

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
    botStats.lastError = error.message;
    botStats.lastErrorTime = Date.now();
    await logToWebhook(
      "❌ API Error - User Lookup Failed",
      `Failed to get user ID for "${username}"`,
      PINK_COLOR,
      [
        { name: "Username", value: username, inline: true },
        { name: "Error Type", value: error.name, inline: true },
        { name: "Error Message", value: error.message, inline: false }
      ],
      null,
      error.stack
    );
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
    botStats.lastError = error.message;
    botStats.lastErrorTime = Date.now();
    await logToWebhook(
      "❌ Presence API Error",
      `Failed to get presence for user ID: ${userId}`,
      PINK_COLOR,
      [
        { name: "User ID", value: userId.toString(), inline: true },
        { name: "Error", value: error.message, inline: false }
      ],
      null,
      error.stack
    );
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
        await logToWebhook(
          "⚠️ Rate Limited - Roblox API",
          "The bot hit Roblox's rate limit. Waiting 2 seconds before continuing...",
          PINK_COLOR,
          [
            { name: "Attempt", value: `${attempt + 1}/20`, inline: true },
            { name: "Servers Scanned", value: `${serversScanned}`, inline: true }
          ]
        );
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      
      if (response.status === 403) {
        await logToWebhook(
          "🔒 Authentication Error",
          "Roblox API returned 403 - Cookie may be invalid or expired",
          PINK_COLOR,
          [
            { name: "Issue", value: "Your ROBLOX_COOKIE may be invalid or expired", inline: false },
            { name: "Fix", value: "Get a new cookie from your Roblox account", inline: false }
          ]
        );
        return { found: false, scanned: serversScanned, authError: true };
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
    botStats.lastError = error.message;
    botStats.lastErrorTime = Date.now();
    await logToWebhook(
      "❌ Server Search Error",
      `Error while scanning servers for user ${userId}`,
      PINK_COLOR,
      [
        { name: "Error", value: error.message, inline: false },
        { name: "Servers Scanned", value: `${serversScanned}`, inline: true }
      ],
      null,
      error.stack
    );
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
    await logToWebhook(
      "✅ Bot Online - Ready to Snipe!",
      "Fame Sniper Bot has started successfully and is ready to use.",
      PINK_COLOR,
      [
        { name: "🎮 Game", value: FAME_GAME_NAME, inline: true },
        { name: "⚡ Commands", value: "/snipe", inline: true },
        { name: "🟢 Status", value: "Online", inline: true }
      ]
    );
  } catch (err) {
    console.error("Command registration failed:", err);
    await logToWebhook(
      "❌ Command Registration Failed - Bot Won't Respond to Commands",
      "The bot failed to register slash commands with Discord. Users won't see /snipe.",
      PINK_COLOR,
      [
        { name: "Error", value: err.message, inline: false },
        { name: "Fix", value: "Check your TOKEN and CLIENT_ID environment variables", inline: false }
      ],
      null,
      err.stack
    );
  }
}

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  console.log(`Sniping game: ${FAME_GAME_NAME}`);
  
  await logToWebhook(
    "🤖 Bot Status - Online",
    `**${client.user.tag}** is now online and ready to snipe!`,
    PINK_COLOR,
    [
      { name: "Bot Name", value: client.user.tag, inline: true },
      { name: "Game", value: FAME_GAME_NAME, inline: true },
      { name: "Servers", value: `${client.guilds.cache.size} servers`, inline: true },
      { name: "Uptime", value: "Just started", inline: true }
    ],
    client.user.displayAvatarURL()
  );
  
  await registerCommands();
});

// Monitor bot disconnects
client.on("disconnect", async (event) => {
  console.log("Bot disconnected:", event);
  await logToWebhook(
    "⚠️ Bot Disconnected",
    "The bot has lost connection to Discord!",
    PINK_COLOR,
    [
      { name: "Reason", value: event.reason || "Unknown", inline: false },
      { name: "Code", value: event.code?.toString() || "Unknown", inline: true }
    ]
  );
});

client.on("error", async (error) => {
  console.error("Client error:", error);
  botStats.lastError = error.message;
  botStats.lastErrorTime = Date.now();
  await logToWebhook(
    "💥 Discord Client Error",
    "The Discord client encountered an error",
    PINK_COLOR,
    [
      { name: "Error", value: error.message, inline: false },
      { name: "Type", value: error.name, inline: true }
    ],
    null,
    error.stack
  );
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "snipe") return;

  const startTime = Date.now();
  botStats.totalSnipes++;
  
  try {
    await interaction.deferReply();
    
    const username = interaction.options.getString("username");
    const discordUserId = interaction.user.id;
    const discordUserTag = interaction.user.tag;
    
    console.log(`[SNIPE] Looking up user: ${username} by ${discordUserTag}`);
    await logToWebhook(
      "🔍 Snipe Command Executed",
      `${discordUserTag} is looking for **${username}** in ${FAME_GAME_NAME}`,
      PINK_COLOR,
      [
        { name: "Target Username", value: username, inline: true },
        { name: "Requested By", value: discordUserTag, inline: true },
        { name: "User ID", value: discordUserId, inline: true }
      ]
    );
    
    // Step 1: Get user ID
    const userData = await getUserId(username);
    if (!userData) {
      botStats.failedSnipes++;
      const embed = new EmbedBuilder()
        .setTitle("❌ User Not Found")
        .setDescription(`Could not find "${username}" on Roblox`)
        .setColor(PINK_COLOR)
        .setFooter({ text: "Fame Sniper Bot" });
      await interaction.editReply({ content: `<@${discordUserId}>`, embeds: [embed] });
      await logToWebhook(
        "❌ Snipe Failed - User Not Found",
        `User "${username}" does not exist on Roblox`,
        PINK_COLOR,
        [
          { name: "Searched Username", value: username, inline: true },
          { name: "Searched By", value: discordUserTag, inline: true },
          { name: "Failure Reason", value: "Roblox username does not exist", inline: false }
        ]
      );
      return;
    }
    
    const userId = userData.id;
    const actualUsername = userData.name;
    console.log(`[SNIPE] Found user: ${actualUsername} (${userId})`);
    
    // Step 2: Get user presence
    const presence = await getUserPresence(userId);
    console.log(`[SNIPE] Presence: online=${presence.online}, inGame=${presence.inGame}, placeId=${presence.placeId}`);
    
    // Step 3: Check if offline
    if (!presence.online) {
      botStats.failedSnipes++;
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
      await interaction.editReply({ content: `<@${discordUserId}>`, embeds: [embed] });
      await logToWebhook(
        "❌ Snipe Failed - Target Offline",
        `${actualUsername} is currently offline`,
        PINK_COLOR,
        [
          { name: "Target", value: actualUsername, inline: true },
          { name: "Status", value: "Offline", inline: true },
          { name: "Searched By", value: discordUserTag, inline: true }
        ]
      );
      return;
    }
    
    // Step 4: Check if online but not in game
    if (!presence.inGame) {
      botStats.failedSnipes++;
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
      await interaction.editReply({ content: `<@${discordUserId}>`, embeds: [embed] });
      await logToWebhook(
        "❌ Snipe Failed - Not In Game",
        `${actualUsername} is online but not playing any game`,
        PINK_COLOR,
        [
          { name: "Target", value: actualUsername, inline: true },
          { name: "Status", value: "Online (No Game)", inline: true },
          { name: "Searched By", value: discordUserTag, inline: true }
        ]
      );
      return;
    }
    
    // Step 5: Check if they're in Fame
    if (presence.placeId && presence.placeId.toString() !== FAME_GAME_ID) {
      botStats.failedSnipes++;
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
      await interaction.editReply({ content: `<@${discordUserId}>`, embeds: [embed] });
      await logToWebhook(
        "❌ Snipe Failed - Wrong Game",
        `${actualUsername} is playing ${gameName}, not ${FAME_GAME_NAME}`,
        PINK_COLOR,
        [
          { name: "Target", value: actualUsername, inline: true },
          { name: "Current Game", value: gameName, inline: true },
          { name: "Required Game", value: FAME_GAME_NAME, inline: true }
        ]
      );
      return;
    }
    
    // Step 6: Get avatar for later
    const avatar = await getUserAvatar(userId);
    
    // Step 7: PINK SEARCHING EMBED
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
      botStats.failedSnipes++;
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
      await interaction.editReply({ content: `<@${discordUserId}>`, embeds: [embed] });
      await logToWebhook(
        "❌ Snipe Failed - Not Found in Servers",
        `${actualUsername} is in ${FAME_GAME_NAME} but their specific server could not be found`,
        PINK_COLOR,
        [
          { name: "Target", value: actualUsername, inline: true },
          { name: "Servers Scanned", value: `${result.scanned}`, inline: true },
          { name: "Time Taken", value: `${elapsed}s`, inline: true },
          { name: "Likely Cause", value: "Private/VIP Server (cannot be sniped)", inline: false }
        ]
      );
      return;
    }
    
    // Step 9: SUCCESS!
    botStats.successfulSnipes++;
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
    
    await logToWebhook(
      "✅ SNIPE SUCCESSFUL!",
      `${discordUserTag} successfully sniped **${actualUsername}** in ${FAME_GAME_NAME}!`,
      PINK_COLOR,
      [
        { name: "🎯 Player Sniped", value: actualUsername, inline: true },
        { name: "🎮 Server", value: `${result.players}/${result.maxPlayers} players`, inline: true },
        { name: "⏱️ Time", value: `${elapsed}s`, inline: true },
        { name: "📊 Servers Scanned", value: `${result.scanned}`, inline: true }
      ],
      avatar
    );
    
  } catch (error) {
    console.error("Snipe error:", error);
    botStats.failedSnipes++;
    botStats.lastError = error.message;
    botStats.lastErrorTime = Date.now();
    
    const errorEmbed = new EmbedBuilder()
      .setTitle("❌ Error")
      .setDescription(`An error occurred: ${error.message}`)
      .setColor(PINK_COLOR)
      .setFooter({ text: "Fame Sniper Bot" });
    
    await logToWebhook(
      "💥 CRITICAL ERROR - Snipe Command Failed",
      "An unexpected error occurred while processing the snipe command",
      PINK_COLOR,
      [
        { name: "Error Type", value: error.name, inline: true },
        { name: "Error Message", value: error.message, inline: false },
        { name: "Command", value: "/snipe", inline: true }
      ],
      null,
      error.stack
    );
    
    if (interaction.deferred) {
      await interaction.editReply({ embeds: [errorEmbed] });
    } else {
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  }
});

// Periodic health check (every 5 minutes)
setInterval(async () => {
  const uptimeMinutes = Math.floor((Date.now() - botStats.startTime) / 1000 / 60);
  const uptimeHours = Math.floor(uptimeMinutes / 60);
  const uptimeDays = Math.floor(uptimeHours / 24);
  
  let uptimeString = "";
  if (uptimeDays > 0) uptimeString += `${uptimeDays}d `;
  if (uptimeHours % 24 > 0) uptimeString += `${uptimeHours % 24}h `;
  uptimeString += `${uptimeMinutes % 60}m`;
  
  await logToWebhook(
    "💖 Bot Health Check - All Systems Operational",
    "The bot is running normally and monitoring for issues.",
    PINK_COLOR,
    [
      { name: "📊 Uptime", value: uptimeString, inline: true },
      { name: "🎯 Total Snipes", value: `${botStats.totalSnipes}`, inline: true },
      { name: "✅ Successful", value: `${botStats.successfulSnipes}`, inline: true },
      { name: "❌ Failed", value: `${botStats.failedSnipes}`, inline: true },
      { name: "📈 Success Rate", value: `${botStats.totalSnipes > 0 ? Math.round((botStats.successfulSnipes / botStats.totalSnipes) * 100) : 0}%`, inline: true },
      { name: "🟢 Status", value: "Online", inline: true }
    ]
  );
}, 300000); // Every 5 minutes

// Log process events
process.on("unhandledRejection", async (error) => {
  console.error("Unhandled rejection:", error);
  botStats.lastError = error.message;
  botStats.lastErrorTime = Date.now();
  await logToWebhook(
    "⚠️ UNHANDLED PROMISE REJECTION",
    "The bot encountered an unhandled promise rejection. This may indicate a bug.",
    PINK_COLOR,
    [
      { name: "Error", value: error.message, inline: false },
      { name: "Type", value: error.name, inline: true }
    ],
    null,
    error.stack
  );
});

process.on("uncaughtException", async (error) => {
  console.error("Uncaught exception:", error);
  botStats.lastError = error.message;
  botStats.lastErrorTime = Date.now();
  await logToWebhook(
    "💥 UNCAUGHT EXCEPTION - BOT MAY CRASH",
    "An uncaught exception occurred. The bot may restart soon.",
    PINK_COLOR,
    [
      { name: "Error", value: error.message, inline: false },
      { name: "Type", value: error.name, inline: true }
    ],
    null,
    error.stack
  );
  process.exit(1);
});

client.login(TOKEN);
