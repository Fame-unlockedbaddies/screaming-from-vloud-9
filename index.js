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
  console.log("Webhook logging enabled");
} catch (error) {
  console.error("Failed to initialize webhook:", error.message);
}

const FAME_GAME_ID = "121157515767845";
const FAME_GAME_NAME = "Fame";

// Professional colors
const COLORS = {
  SUCCESS: 0x2B2D31,
  ERROR: 0x2B2D31,
  WARNING: 0x2B2D31,
  INFO: 0x2B2D31
};

// FIXED: Async webhook logging with error handling
async function logToWebhook(title, description, type = "INFO", fields = [], thumbnail = null, errorDetails = null) {
  if (!webhook) return;
  
  try {
    let footerText = "System Log";
    switch(type) {
      case "SUCCESS": footerText = "Operation Successful"; break;
      case "ERROR": footerText = "Critical Error"; break;
      case "WARNING": footerText = "System Notice"; break;
      default: footerText = "Information";
    }
    
    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor(COLORS.INFO)
      .setTimestamp()
      .setFooter({ text: footerText });
    
    if (fields && fields.length > 0) {
      embed.addFields(fields);
    }
    
    if (thumbnail) {
      embed.setThumbnail(thumbnail);
    }
    
    if (errorDetails) {
      embed.addFields({
        name: "Technical Details",
        value: `\`\`\`diff\n- ${errorDetails.slice(0, 400)}\n\`\`\``,
        inline: false
      });
    }
    
    await webhook.send({ embeds: [embed] });
  } catch (error) {
    console.error("Webhook send failed:", error.message);
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
      
      if (response.status === 403) {
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
      "System Initialization Complete",
      "Fame Sniper Bot has successfully started.",
      "SUCCESS",
      [
        { name: "Target Game", value: FAME_GAME_NAME, inline: true },
        { name: "Commands", value: "/snipe", inline: true },
        { name: "Status", value: "Operational", inline: true }
      ]
    );
  } catch (err) {
    console.error("Command registration failed:", err);
  }
}

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  console.log(`Sniping game: ${FAME_GAME_NAME}`);
  
  await logToWebhook(
    "System Online",
    `Bot ${client.user.tag} is now operational.`,
    "SUCCESS",
    [
      { name: "Bot", value: client.user.tag, inline: true },
      { name: "Game", value: FAME_GAME_NAME, inline: true },
      { name: "Servers", value: `${client.guilds.cache.size}`, inline: true }
    ],
    client.user.displayAvatarURL()
  );
  
  await registerCommands();
});

// Monitor bot disconnects
client.on("disconnect", async (event) => {
  console.log("Bot disconnected:", event);
  await logToWebhook(
    "Connection Interrupted",
    "Bot lost connection to Discord.",
    "WARNING",
    [
      { name: "Reason", value: event.reason || "Unknown", inline: false },
      { name: "Code", value: event.code?.toString() || "Unknown", inline: true }
    ]
  );
});

client.on("error", async (error) => {
  console.error("Client error:", error);
  await logToWebhook(
    "Client Runtime Error",
    "Discord client encountered an error.",
    "ERROR",
    [
      { name: "Error", value: error.message, inline: false }
    ]
  );
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "snipe") return;

  const startTime = Date.now();
  botStats.totalSnipes++;
  
  // FIXED: Use a variable to track if we've replied
  let hasReplied = false;
  
  try {
    await interaction.deferReply();
    hasReplied = true;
    
    const username = interaction.options.getString("username");
    const discordUserId = interaction.user.id;
    const discordUserTag = interaction.user.tag;
    
    console.log(`[SNIPE] Looking up user: ${username} by ${discordUserTag}`);
    
    // Send webhook log ASYNC (don't await to avoid blocking)
    logToWebhook(
      "Snipe Request Received",
      `User ${discordUserTag} requested snipe on ${username}.`,
      "INFO",
      [
        { name: "Target", value: username, inline: true },
        { name: "Requester", value: discordUserTag, inline: true }
      ]
    ).catch(e => console.error("Webhook error:", e.message));
    
    // Step 1: Get user ID
    const userData = await getUserId(username);
    if (!userData) {
      botStats.failedSnipes++;
      const embed = new EmbedBuilder()
        .setTitle("User Not Found")
        .setDescription(`Could not find "${username}" on Roblox`)
        .setColor(0x2B2D31)
        .setFooter({ text: "Fame Sniper Bot" });
      await interaction.editReply({ content: `<@${discordUserId}>`, embeds: [embed] });
      return;
    }
    
    const userId = userData.id;
    const actualUsername = userData.name;
    console.log(`[SNIPE] Found user: ${actualUsername} (${userId})`);
    
    // Step 2: Get user presence
    const presence = await getUserPresence(userId);
    
    // Step 3: Check if offline
    if (!presence.online) {
      botStats.failedSnipes++;
      const avatar = await getUserAvatar(userId);
      const embed = new EmbedBuilder()
        .setTitle("Snipe Failed")
        .setDescription(`**${actualUsername}** is currently Offline`)
        .addFields(
          { name: "Status", value: "Offline", inline: true },
          { name: "Tip", value: "Try again when they come online", inline: true }
        )
        .setColor(0x2B2D31)
        .setThumbnail(avatar)
        .setFooter({ text: "Fame Sniper Bot" });
      await interaction.editReply({ content: `<@${discordUserId}>`, embeds: [embed] });
      return;
    }
    
    // Step 4: Check if online but not in game
    if (!presence.inGame) {
      botStats.failedSnipes++;
      const avatar = await getUserAvatar(userId);
      const embed = new EmbedBuilder()
        .setTitle("Snipe Failed")
        .setDescription(`**${actualUsername}** is online but not in a game`)
        .addFields(
          { name: "Status", value: "Online (Idle)", inline: true },
          { name: "Tip", value: "Wait for them to join a game", inline: true }
        )
        .setColor(0x2B2D31)
        .setThumbnail(avatar)
        .setFooter({ text: "Fame Sniper Bot" });
      await interaction.editReply({ content: `<@${discordUserId}>`, embeds: [embed] });
      return;
    }
    
    // Step 5: Check if they're in Fame
    if (presence.placeId && presence.placeId.toString() !== FAME_GAME_ID) {
      botStats.failedSnipes++;
      const avatar = await getUserAvatar(userId);
      const gameName = await getGameName(presence.placeId);
      const embed = new EmbedBuilder()
        .setTitle("Snipe Failed")
        .setDescription(`**${actualUsername}** is in a different game`)
        .addFields(
          { name: "Current Game", value: gameName, inline: true },
          { name: "Target Game", value: FAME_GAME_NAME, inline: true }
        )
        .setColor(0x2B2D31)
        .setThumbnail(avatar)
        .setFooter({ text: "Fame Sniper Bot" });
      await interaction.editReply({ content: `<@${discordUserId}>`, embeds: [embed] });
      return;
    }
    
    // Step 6: Get avatar for later
    const avatar = await getUserAvatar(userId);
    
    // Step 7: Searching embed
    const searching = new EmbedBuilder()
      .setTitle("Searching Operation")
      .setDescription(`Target: **${actualUsername}**\nGame: **${FAME_GAME_NAME}**\nStatus: Scanning public servers...`)
      .setColor(0x2B2D31)
      .setThumbnail(avatar)
      .setFooter({ text: "Fame Sniper Bot • Search in Progress" });
    
    await interaction.editReply({ content: `<@${discordUserId}>`, embeds: [searching] });
    
    // Step 8: Find user in servers
    const result = await findUserInFameServers(userId);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    
    if (!result.found) {
      botStats.failedSnipes++;
      const embed = new EmbedBuilder()
        .setTitle("Snipe Failed")
        .setDescription(`Could not locate **${actualUsername}** in **${FAME_GAME_NAME}**`)
        .addFields(
          { name: "Servers Scanned", value: `${result.scanned}`, inline: true },
          { name: "Time", value: `${elapsed} seconds`, inline: true },
          { name: "Analysis", value: "User may be in a private server", inline: false }
        )
        .setColor(0x2B2D31)
        .setThumbnail(avatar)
        .setFooter({ text: "Fame Sniper Bot" });
      await interaction.editReply({ content: `<@${discordUserId}>`, embeds: [embed] });
      return;
    }
    
    // Step 9: SUCCESS
    botStats.successfulSnipes++;
    const joinLink = `https://www.roblox.com/games/${FAME_GAME_ID}?jobId=${result.jobId}`;
    
    const embed = new EmbedBuilder()
      .setTitle("Snipe Operation Successful")
      .setDescription(`Target **${actualUsername}** located in **${FAME_GAME_NAME}**`)
      .addFields(
        { name: "Server Status", value: `${result.players} / ${result.maxPlayers} players`, inline: true },
        { name: "Search Duration", value: `${elapsed} seconds`, inline: true },
        { name: "Method", value: "Public API Scan", inline: true }
      )
      .setColor(0x2B2D31)
      .setThumbnail(avatar)
      .setImage(avatar)
      .setFooter({ text: "Fame Sniper Bot • Join via button below" })
      .setTimestamp();
    
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setLabel("Join Server")
          .setURL(joinLink)
          .setStyle(ButtonStyle.Link)
      );
    
    await interaction.editReply({ content: `<@${discordUserId}>`, embeds: [embed], components: [row] });
    
    // Send success webhook (don't await)
    logToWebhook(
      "Snipe Operation Successful",
      `${discordUserTag} successfully sniped ${actualUsername}.`,
      "SUCCESS",
      [
        { name: "Target", value: actualUsername, inline: true },
        { name: "Server", value: `${result.players}/${result.maxPlayers}`, inline: true },
        { name: "Time", value: `${elapsed}s`, inline: true }
      ],
      avatar
    ).catch(e => console.error("Webhook error:", e.message));
    
  } catch (error) {
    console.error("Snipe error:", error);
    botStats.failedSnipes++;
    
    const errorEmbed = new EmbedBuilder()
      .setTitle("Runtime Error")
      .setDescription(`An error occurred: ${error.message}`)
      .setColor(0x2B2D31)
      .setFooter({ text: "Fame Sniper Bot" });
    
    // Only reply if we haven't already
    if (!hasReplied) {
      if (interaction.deferred) {
        await interaction.editReply({ embeds: [errorEmbed] });
      } else {
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      }
    }
    
    logToWebhook(
      "Runtime Error",
      `Error: ${error.message}`,
      "ERROR",
      [],
      null,
      error.stack
    ).catch(e => console.error("Webhook error:", e.message));
  }
});

// Periodic health check (every 10 minutes)
setInterval(async () => {
  const uptimeMinutes = Math.floor((Date.now() - botStats.startTime) / 1000 / 60);
  const successRate = botStats.totalSnipes > 0 
    ? Math.round((botStats.successfulSnipes / botStats.totalSnipes) * 100) 
    : 0;
  
  await logToWebhook(
    "System Health Report",
    "Bot is operational.",
    "INFO",
    [
      { name: "Uptime", value: `${uptimeMinutes} minutes`, inline: true },
      { name: "Total Snipes", value: `${botStats.totalSnipes}`, inline: true },
      { name: "Success Rate", value: `${successRate}%`, inline: true },
      { name: "Status", value: "Operational", inline: true }
    ]
  );
}, 600000);

// Error handlers
process.on("unhandledRejection", async (error) => {
  console.error("Unhandled rejection:", error);
  await logToWebhook(
    "Unhandled Promise Rejection",
    error.message,
    "ERROR",
    [],
    null,
    error.stack
  );
});

process.on("uncaughtException", async (error) => {
  console.error("Uncaught exception:", error);
  await logToWebhook(
    "Uncaught Exception",
    error.message,
    "ERROR",
    [],
    null,
    error.stack
  );
  process.exit(1);
});

client.login(TOKEN);
