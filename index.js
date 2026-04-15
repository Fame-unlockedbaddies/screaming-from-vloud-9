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

// Role configuration - REPLACE WITH YOUR ACTUAL ROLE ID
const FOUNDER_ROLE_ID = "YOUR_FOUNDER_ROLE_ID"; // Replace with your actual Founder role ID
const FOUNDER_ROLE_MENTION = `<@&${FOUNDER_ROLE_ID}>`;

if (!TOKEN || !CLIENT_ID) {
  console.error("Missing TOKEN or CLIENT_ID");
  process.exit(1);
}

const WEBHOOK_URL = "https://discord.com/api/webhooks/1493916503291203654/xRsw3M1K4nAJm6c6WVEY99yK1_4XC53cK0JRbvAylSfc6t9XK-Jsi9o4uEU_iaYkRjhP";

let webhook = null;
try {
  webhook = new WebhookClient({ url: WEBHOOK_URL });
  console.log("Advanced webhook logging enabled");
} catch (error) {
  console.error("Webhook failed:", error.message);
}

const FAME_GAME_ID = "121157515767845";
const FAME_GAME_NAME = "Fame";

// Track if bot is restarting
let isRestarting = false;

// Advanced logging function with Founder role ping
async function logToWebhook(title, description, type = "INFO", fields = [], thumbnail = null, errorStack = null, pingFounder = false) {
  if (!webhook) return;
  
  try {
    let color = 0x2B2D31;
    let footerText = "Fame Sniper Bot";
    let founderPing = "";
    
    switch(type) {
      case "SUCCESS":
        color = 0x00FF00;
        footerText = "Operation Successful";
        break;
      case "ERROR":
        color = 0xFF0000;
        footerText = "Critical Error - Founder Intervention Required";
        if (pingFounder) founderPing = `${FOUNDER_ROLE_MENTION} `;
        break;
      case "WARNING":
        color = 0xFFA500;
        footerText = "System Warning";
        break;
      case "DEPLOY":
        color = 0x9B59B6;
        footerText = "Code Deployment - Bot Restarting";
        if (pingFounder) founderPing = `${FOUNDER_ROLE_MENTION} `;
        break;
      case "REQUEST":
        color = 0x5865F2;
        footerText = "Founder Action Required";
        if (pingFounder) founderPing = `${FOUNDER_ROLE_MENTION} `;
        break;
      default:
        color = 0x2B2D31;
        footerText = "System Log";
    }
    
    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor(color)
      .setTimestamp()
      .setFooter({ text: `${footerText} • Bot: ${client.user?.tag || "Starting"}` });
    
    if (fields && fields.length > 0) {
      embed.addFields(fields);
    }
    
    if (thumbnail) {
      embed.setThumbnail(thumbnail);
    }
    
    if (errorStack) {
      embed.addFields({
        name: "Technical Details",
        value: `\`\`\`diff\n- ${errorStack.slice(0, 400)}\n\`\`\``,
        inline: false
      });
    }
    
    // Send with founder ping if required
    await webhook.send({ content: founderPing || undefined, embeds: [embed] });
  } catch (error) {
    console.error("Webhook error:", error.message);
  }
}

// Send deployment notification with Founder ping
async function notifyDeployment() {
  isRestarting = true;
  await logToWebhook(
    "🔄 CODE DEPLOYMENT IN PROGRESS",
    `**Founder** is redeploying/updating the bot's code. The bot will restart shortly.`,
    "DEPLOY",
    [
      { name: "Status", value: "Restarting...", inline: true },
      { name: "Action", value: "Code update in progress", inline: false }
    ],
    null,
    null,
    true // Ping Founder role
  );
  console.log("Deployment notification sent with Founder ping");
}

// Send error that requires Founder fix with ping
async function notifyFounderError(errorType, errorMessage, errorStack, command = null) {
  await logToWebhook(
    `🚨 CRITICAL ERROR - FOUNDER ACTION REQUIRED`,
    `**Founder** needs to fix the following issue:`,
    "ERROR",
    [
      { name: "Error Type", value: errorType, inline: true },
      { name: "Error Message", value: errorMessage, inline: false },
      { name: "Command", value: command || "N/A", inline: true },
      { name: "Time", value: new Date().toLocaleString(), inline: true },
      { name: "Required Action", value: `Founder must review and fix this error immediately.`, inline: false }
    ],
    null,
    errorStack,
    true // Ping Founder role
  );
}

// Keep alive server
http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/deploy') {
    await notifyDeployment();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "deployment notification sent" }));
  } else {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Bot is alive");
  }
}).listen(PORT, () => console.log(`Server on port ${PORT}`));

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages],
  partials: [Partials.Channel]
});

let lastRequest = 0;
const REQUEST_DELAY = 150;

async function rateLimit() {
  const now = Date.now();
  const wait = lastRequest + REQUEST_DELAY - now;
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastRequest = Date.now();
}

// Get user ID and info
async function getUserId(username) {
  try {
    await rateLimit();
    const res = await fetch("https://users.roblox.com/v1/usernames/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usernames: [username] })
    });
    const data = await res.json();
    if (data.data && data.data.length > 0) {
      return { id: data.data[0].id, name: data.data[0].name };
    }
    return null;
  } catch (error) {
    await notifyFounderError("API User Lookup Failed", error.message, error.stack, "getUserId");
    return null;
  }
}

// Get user presence
async function getUserPresence(userId) {
  try {
    await rateLimit();
    const res = await fetch("https://presence.roblox.com/v1/presence/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": `.ROBLOSECURITY=${ROBLOX_COOKIE}`
      },
      body: JSON.stringify({ userIds: [userId] })
    });
    const data = await res.json();
    if (data.userPresences && data.userPresences[0]) {
      const p = data.userPresences[0];
      if (p.userPresenceType === 2) {
        return { online: true, inGame: true, placeId: p.placeId };
      } else if (p.userPresenceType === 1) {
        return { online: true, inGame: false, placeId: null };
      }
    }
    return { online: false, inGame: false, placeId: null };
  } catch (error) {
    await notifyFounderError("Presence API Failed", error.message, error.stack, "getUserPresence");
    return { online: false, inGame: false, placeId: null };
  }
}

// Get user avatar
async function getUserAvatar(userId) {
  try {
    await rateLimit();
    const res = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=720x720&format=Png&isCircular=false`);
    const data = await res.json();
    return data.data?.[0]?.imageUrl || null;
  } catch (error) {
    return null;
  }
}

// Get game name
async function getGameName(placeId) {
  if (!placeId) return "Unknown";
  try {
    await rateLimit();
    const res = await fetch(`https://games.roblox.com/v1/games?universeIds=${placeId}`);
    const data = await res.json();
    return data.data?.[0]?.name || "Unknown Game";
  } catch (error) {
    return "Unknown Game";
  }
}

// SCAN ALL SERVERS
async function findUserInAllServers(userId) {
  let cursor = "";
  let serversScanned = 0;
  let totalServers = 0;
  const userIdStr = userId.toString();
  
  console.log(`[SCAN] Starting full scan for user ${userIdStr}`);
  
  try {
    const firstPage = await fetch(`https://games.roblox.com/v1/games/${FAME_GAME_ID}/servers/Public?limit=100`);
    const firstData = await firstPage.json();
    
    if (firstData.totalServers) {
      totalServers = firstData.totalServers;
      console.log(`[SCAN] Total servers: ${totalServers}`);
    }
    
    if (firstData.data) {
      for (const server of firstData.data) {
        serversScanned++;
        if (server.playing && Array.isArray(server.playing)) {
          if (server.playing.map(p => p.toString()).includes(userIdStr)) {
            console.log(`[SCAN] FOUND on page 1 after ${serversScanned} servers`);
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
    }
    
    cursor = firstData.nextPageCursor;
    let pageNum = 2;
    
    while (cursor && serversScanned < 5000) {
      await rateLimit();
      const url = `https://games.roblox.com/v1/games/${FAME_GAME_ID}/servers/Public?limit=100&cursor=${cursor}`;
      const res = await fetch(url);
      
      if (res.status === 429) {
        console.log("[SCAN] Rate limited, waiting...");
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      
      const data = await res.json();
      if (!data.data || data.data.length === 0) break;
      
      for (const server of data.data) {
        serversScanned++;
        
        if (server.playing && Array.isArray(server.playing)) {
          if (server.playing.map(p => p.toString()).includes(userIdStr)) {
            console.log(`[SCAN] FOUND on page ${pageNum} after ${serversScanned} servers`);
            return {
              found: true,
              jobId: server.id,
              players: server.playing.length,
              maxPlayers: server.maxPlayers,
              scanned: serversScanned,
              pageFound: pageNum
            };
          }
        }
      }
      
      cursor = data.nextPageCursor;
      pageNum++;
    }
    
    console.log(`[SCAN] Complete - Scanned ${serversScanned} servers, user not found`);
    return { found: false, scanned: serversScanned };
    
  } catch (error) {
    console.error("[SCAN] Error:", error);
    await notifyFounderError("Server Scan Failed", error.message, error.stack, "findUserInAllServers");
    return { found: false, scanned: serversScanned, error: true };
  }
}

// Register snipe command
async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName("snipe")
      .setDescription(`Find a player in ${FAME_GAME_NAME} and join their game`)
      .addStringOption(opt => opt.setName("username").setDescription("Roblox username").setRequired(true))
      .setIntegrationTypes([ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall])
      .setContexts([InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel])
      .toJSON()
  ];

  const rest = new REST({ version: "10" }).setToken(TOKEN);
  try {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log("Snipe command registered!");
    await logToWebhook(
      "✅ Bot Successfully Started", 
      `The bot has been successfully deployed and is now operational.`,
      "SUCCESS",
      [
        { name: "Game", value: FAME_GAME_NAME, inline: true },
        { name: "Command", value: "/snipe", inline: true },
        { name: "Status", value: "Online and Ready", inline: true }
      ]
    );
  } catch (err) {
    console.error("Command registration failed:", err);
    await notifyFounderError("Command Registration Failed", err.message, err.stack, "registerCommands");
  }
}

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  console.log(`Sniping game: ${FAME_GAME_NAME}`);
  
  if (!isRestarting) {
    await logToWebhook(
      "🤖 Bot Online", 
      `The bot has started successfully. Ready to snipe!`,
      "SUCCESS",
      [
        { name: "Bot Name", value: client.user.tag, inline: true },
        { name: "Game", value: FAME_GAME_NAME, inline: true }
      ],
      client.user.displayAvatarURL()
    );
  } else {
    await logToWebhook(
      "✅ Bot Restart Complete", 
      `The bot has finished redeploying and is back online.`,
      "SUCCESS",
      [
        { name: "Bot Name", value: client.user.tag, inline: true },
        { name: "Status", value: "Operational", inline: true }
      ],
      client.user.displayAvatarURL()
    );
    isRestarting = false;
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
    const discordUserId = interaction.user.id;
    
    console.log(`[SNIPE] Request for user: ${username}`);
    
    // Get user ID
    const userData = await getUserId(username);
    if (!userData) {
      const embed = new EmbedBuilder()
        .setTitle("User Not Found")
        .setDescription(`Could not find "${username}" on Roblox`)
        .setColor(0x2B2D31);
      await interaction.editReply({ content: `<@${discordUserId}>`, embeds: [embed] });
      
      await logToWebhook(
        "⚠️ Snipe Failed - User Not Found",
        `User "${username}" does not exist on Roblox.`,
        "WARNING",
        [
          { name: "Requested User", value: username, inline: true },
          { name: "Requester", value: interaction.user.tag, inline: true }
        ]
      );
      return;
    }
    
    const userId = userData.id;
    const actualUsername = userData.name;
    
    // Check presence
    const presence = await getUserPresence(userId);
    
    if (!presence.online) {
      const avatar = await getUserAvatar(userId);
      const embed = new EmbedBuilder()
        .setTitle("Snipe Failed")
        .setDescription(`**${actualUsername}** is currently offline`)
        .addFields(
          { name: "Status", value: "Offline", inline: true },
          { name: "Tip", value: "Try again when they come online", inline: true }
        )
        .setColor(0x2B2D31)
        .setThumbnail(avatar);
      await interaction.editReply({ content: `<@${discordUserId}>`, embeds: [embed] });
      return;
    }
    
    if (!presence.inGame) {
      const avatar = await getUserAvatar(userId);
      const embed = new EmbedBuilder()
        .setTitle("Snipe Failed")
        .setDescription(`**${actualUsername}** is online but not in a game`)
        .addFields(
          { name: "Status", value: "Online (Idle)", inline: true },
          { name: "Tip", value: "Wait for them to join a game", inline: true }
        )
        .setColor(0x2B2D31)
        .setThumbnail(avatar);
      await interaction.editReply({ content: `<@${discordUserId}>`, embeds: [embed] });
      return;
    }
    
    if (presence.placeId && presence.placeId.toString() !== FAME_GAME_ID) {
      const avatar = await getUserAvatar(userId);
      const gameName = await getGameName(presence.placeId);
      const embed = new EmbedBuilder()
        .setTitle("Snipe Failed")
        .setDescription(`**${actualUsername}** is playing **${gameName}**, not ${FAME_GAME_NAME}`)
        .addFields(
          { name: "Current Game", value: gameName, inline: true },
          { name: "Target Game", value: FAME_GAME_NAME, inline: true }
        )
        .setColor(0x2B2D31)
        .setThumbnail(avatar);
      await interaction.editReply({ content: `<@${discordUserId}>`, embeds: [embed] });
      return;
    }
    
    const avatar = await getUserAvatar(userId);
    
    const searching = new EmbedBuilder()
      .setTitle("Searching for player")
      .setDescription(`Target: **${actualUsername}**\nGame: **${FAME_GAME_NAME}**\nStatus: Scanning all public servers...`)
      .setColor(0x2B2D31)
      .setThumbnail(avatar);
    
    await interaction.editReply({ content: `<@${discordUserId}>`, embeds: [searching] });
    
    const result = await findUserInAllServers(userId);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    
    if (!result.found) {
      const embed = new EmbedBuilder()
        .setTitle("Snipe Failed")
        .setDescription(`Could not locate **${actualUsername}** in **${FAME_GAME_NAME}**`)
        .addFields(
          { name: "Servers Scanned", value: `${result.scanned}`, inline: true },
          { name: "Time", value: `${elapsed} seconds`, inline: true },
          { name: "Reason", value: "User may be in a private/VIP server", inline: false }
        )
        .setColor(0x2B2D31)
        .setThumbnail(avatar);
      await interaction.editReply({ content: `<@${discordUserId}>`, embeds: [embed] });
      return;
    }
    
    // SUCCESS
    const joinLink = `https://www.roblox.com/games/${FAME_GAME_ID}?jobId=${result.jobId}`;
    
    const embed = new EmbedBuilder()
      .setTitle("Player Found")
      .setDescription(`Successfully located **${actualUsername}** in **${FAME_GAME_NAME}**`)
      .addFields(
        { name: "Server", value: `${result.players}/${result.maxPlayers} players`, inline: true },
        { name: "Search Time", value: `${elapsed} seconds`, inline: true },
        { name: "Servers Scanned", value: `${result.scanned}`, inline: true }
      )
      .setColor(0x2B2D31)
      .setThumbnail(avatar)
      .setImage(avatar);
    
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setLabel("Join Game")
          .setURL(joinLink)
          .setStyle(ButtonStyle.Link)
      );
    
    await interaction.editReply({ content: `<@${discordUserId}>`, embeds: [embed], components: [row] });
    
    await logToWebhook(
      "🎯 Snipe Successful",
      `${interaction.user.tag} successfully sniped ${actualUsername}!`,
      "SUCCESS",
      [
        { name: "Target", value: actualUsername, inline: true },
        { name: "Server", value: `${result.players}/${result.maxPlayers}`, inline: true },
        { name: "Scanned", value: `${result.scanned} servers`, inline: true },
        { name: "Time", value: `${elapsed}s`, inline: true }
      ],
      avatar
    );
    
  } catch (error) {
    console.error("Error:", error);
    
    // Notify Founder about the error with ping
    await notifyFounderError(
      "Snipe Command Runtime Error",
      error.message,
      error.stack,
      "/snipe"
    );
    
    const errorEmbed = new EmbedBuilder()
      .setTitle("Error")
      .setDescription(`An error occurred: ${error.message}\n\n**Founder** has been notified.`)
      .setColor(0x2B2D31);
    
    if (interaction.deferred) {
      await interaction.editReply({ embeds: [errorEmbed] });
    } else {
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  }
});

// Monitor process events
process.on("unhandledRejection", async (error) => {
  console.error("Unhandled rejection:", error);
  await notifyFounderError("Unhandled Promise Rejection", error.message, error.stack);
});

process.on("uncaughtException", async (error) => {
  console.error("Uncaught exception:", error);
  await notifyFounderError("Uncaught Exception", error.message, error.stack);
  process.exit(1);
});

client.login(TOKEN);
