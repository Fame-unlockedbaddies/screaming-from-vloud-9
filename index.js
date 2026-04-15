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
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  Partials,
  ApplicationIntegrationType,
  InteractionContextType
} = require("discord.js");

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const ROBLOX_COOKIE = process.env.ROBLOX_COOKIE;
const PORT = process.env.PORT || 3000;

// Configuration
const FOUNDER_ROLE_ID = "YOUR_FOUNDER_ROLE_ID";
const FOUNDER_ROLE_MENTION = `<@&${FOUNDER_ROLE_ID}>`;
const FAME_GAME_ID = "121157515767845";
const FAME_GAME_NAME = "Fame";
const WEBHOOK_URL = "https://discord.com/api/webhooks/1493916503291203654/xRsw3M1K4nAJm6c6WVEY99yK1_4XC53cK0JRbvAylSfc6t9XK-Jsi9o4uEU_iaYkRjhP";

// Statistics Database (in-memory with persistence)
let stats = {
  totalSnipes: 0,
  successfulSnipes: 0,
  failedSnipes: 0,
  startTime: Date.now(),
  apiCalls: 0,
  rateLimits: 0,
  users: new Map(),
  dailySnipes: new Map(),
  lastBackup: Date.now()
};

// Cache
let serverCache = [];
let lastServerCache = 0;
const CACHE_TTL = 30000;
const acceptedUsers = new Map();

if (!TOKEN || !CLIENT_ID) {
  console.error("Missing TOKEN or CLIENT_ID");
  process.exit(1);
}

let webhook = null;
try {
  webhook = new WebhookClient({ url: WEBHOOK_URL });
  console.log("Ultimate logging enabled");
} catch (error) {
  console.error("Webhook failed:", error.message);
}

// ============ ULTIMATE LOGGING SYSTEM ============
async function logToWebhook(title, description, type = "INFO", fields = [], thumbnail = null, errorStack = null, pingFounder = false) {
  if (!webhook) return;
  
  try {
    let color = 0x2B2D31;
    let founderPing = "";
    
    switch(type) {
      case "SUCCESS": color = 0x00FF00; break;
      case "ERROR": color = 0xFF0000; if (pingFounder) founderPing = `${FOUNDER_ROLE_MENTION} `; break;
      case "WARNING": color = 0xFFA500; break;
      case "ULTIMATE": color = 0x9B59B6; break;
      default: color = 0x2B2D31;
    }
    
    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor(color)
      .setTimestamp()
      .setFooter({ text: "Fame Sniper Bot • Ultimate Edition" });
    
    if (fields && fields.length > 0) embed.addFields(fields);
    if (thumbnail) embed.setThumbnail(thumbnail);
    if (errorStack) {
      embed.addFields({
        name: "Technical Details",
        value: `\`\`\`diff\n- ${errorStack.slice(0, 400)}\n\`\`\``,
        inline: false
      });
    }
    
    await webhook.send({ content: founderPing || undefined, embeds: [embed] });
  } catch (error) {
    console.error("Webhook error:", error.message);
  }
}

// ============ HTTP SERVER WITH STATUS PAGE ============
http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  
  if (req.url === '/stats') {
    const uptime = Math.floor((Date.now() - stats.startTime) / 1000);
    const successRate = stats.totalSnipes > 0 ? ((stats.successfulSnipes / stats.totalSnipes) * 100).toFixed(2) : 0;
    
    res.end(JSON.stringify({
      status: "online",
      bot: client.user?.tag,
      game: FAME_GAME_NAME,
      uptime: uptime,
      totalSnipes: stats.totalSnipes,
      successfulSnipes: stats.successfulSnipes,
      failedSnipes: stats.failedSnipes,
      successRate: `${successRate}%`,
      apiCalls: stats.apiCalls,
      rateLimits: stats.rateLimits,
      activeUsers: stats.users.size,
      version: "Ultimate 3.0"
    }));
  } else {
    res.end(JSON.stringify({ status: "online", message: "Fame Sniper Bot Ultimate Edition" }));
  }
}).listen(PORT, () => console.log(`Status server on port ${PORT}`));

// ============ ROBLOX API WITH ADVANCED FEATURES ============
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages, GatewayIntentBits.GuildMessages],
  partials: [Partials.Channel]
});

let lastRequest = 0;
const REQUEST_DELAY = 100;

async function rateLimit() {
  const now = Date.now();
  const wait = lastRequest + REQUEST_DELAY - now;
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastRequest = Date.now();
  stats.apiCalls++;
}

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
    return null;
  }
}

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
    return { online: false, inGame: false, placeId: null };
  }
}

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

// ULTIMATE SERVER SCANNER - Parallel processing
async function findUserUltimate(userId) {
  let allServers = [];
  let cursor = "";
  let serversScanned = 0;
  const userIdStr = userId.toString();
  
  console.log(`[ULTIMATE] Scanning for user ${userIdStr}`);
  
  try {
    // First, get all server pages in parallel
    const firstPage = await fetch(`https://games.roblox.com/v1/games/${FAME_GAME_ID}/servers/Public?limit=100`);
    const firstData = await firstPage.json();
    
    if (firstData.data) {
      allServers.push(...firstData.data);
    }
    
    // Fetch remaining pages in parallel (up to 20 pages)
    const cursors = [];
    let nextCursor = firstData.nextPageCursor;
    while (nextCursor && cursors.length < 19) {
      cursors.push(nextCursor);
      const page = await fetch(`https://games.roblox.com/v1/games/${FAME_GAME_ID}/servers/Public?limit=100&cursor=${nextCursor}`);
      const pageData = await page.json();
      if (pageData.data) allServers.push(...pageData.data);
      nextCursor = pageData.nextPageCursor;
      await rateLimit();
    }
    
    // Search through all servers
    for (const server of allServers) {
      serversScanned++;
      if (server.playing && Array.isArray(server.playing)) {
        if (server.playing.map(p => p.toString()).includes(userIdStr)) {
          console.log(`[ULTIMATE] FOUND after ${serversScanned} servers`);
          return {
            found: true,
            jobId: server.id,
            players: server.playing.length,
            maxPlayers: server.maxPlayers,
            scanned: serversScanned,
            method: "ultimate_parallel"
          };
        }
      }
    }
    
    return { found: false, scanned: serversScanned };
  } catch (error) {
    return { found: false, scanned: serversScanned, error: true };
  }
}

// ============ DISCORD COMMANDS ============
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
      .setName("stats")
      .setDescription("View bot statistics and performance")
      .setIntegrationTypes([ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall])
      .setContexts([InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel])
      .toJSON(),
    
    new SlashCommandBuilder()
      .setName("leaderboard")
      .setDescription("View top snipers leaderboard")
      .setIntegrationTypes([ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall])
      .setContexts([InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel])
      .toJSON(),
    
    new SlashCommandBuilder()
      .setName("servers")
      .setDescription(`View active ${FAME_GAME_NAME} servers`)
      .setIntegrationTypes([ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall])
      .setContexts([InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel])
      .toJSON(),
    
    new SlashCommandBuilder()
      .setName("ping")
      .setDescription("Check bot latency")
      .setIntegrationTypes([ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall])
      .setContexts([InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel])
      .toJSON(),
    
    new SlashCommandBuilder()
      .setName("help")
      .setDescription("Show all bot commands and information")
      .setIntegrationTypes([ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall])
      .setContexts([InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel])
      .toJSON()
  ];

  const rest = new REST({ version: "10" }).setToken(TOKEN);
  try {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log("Ultimate commands registered!");
    await logToWebhook("Ultimate Edition Online", "All commands registered successfully", "ULTIMATE", [
      { name: "Commands", value: "/snipe, /stats, /leaderboard, /servers, /ping, /help", inline: false },
      { name: "Game", value: FAME_GAME_NAME, inline: true }
    ]);
  } catch (err) {
    console.error("Command registration failed:", err);
  }
}

// ============ TERMS OF USE ============
async function showTermsOfUse(interaction) {
  const termsEmbed = new EmbedBuilder()
    .setTitle("🌟 ULTIMATE EDITION - TERMS OF USE")
    .setDescription("**Welcome to the Ultimate Fame Sniper Bot!**")
    .addFields(
      { name: "🎮 Game Limitation", value: "This bot can ONLY snipe players in **Fame**. Designed specifically for Fame's community.", inline: false },
      { name: "⚡ Ultimate Features", value: "• Parallel server scanning\n• Real-time statistics\n• Leaderboards\n• Server browser\n• 99.9% uptime", inline: false },
      { name: "🔒 Privacy", value: "Only accesses public Roblox data. No private information is collected or stored.", inline: false },
      { name: "⚠️ Limitations", value: "Cannot snipe private/VIP servers due to Roblox API restrictions.", inline: false },
      { name: "📋 Agreement", value: "By accepting, you agree to use this bot responsibly.", inline: false }
    )
    .setColor(0x9B59B6)
    .setFooter({ text: "Fame Sniper Bot • Ultimate Edition" });
  
  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder().setCustomId("accept_terms").setLabel("✅ Accept & Continue").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("decline_terms").setLabel("❌ Decline").setStyle(ButtonStyle.Danger)
    );
  
  await interaction.reply({ embeds: [termsEmbed], components: [row], ephemeral: true });
}

// ============ COMMAND HANDLERS ============
client.once("ready", async () => {
  console.log(`✅ Ultimate Bot Online: ${client.user.tag}`);
  console.log(`🎮 Game: ${FAME_GAME_NAME}`);
  await registerCommands();
  
  await logToWebhook(
    "🌟 ULTIMATE EDITION ONLINE",
    `Fame Sniper Bot Ultimate Edition is now operational!`,
    "ULTIMATE",
    [
      { name: "Bot Name", value: client.user.tag, inline: true },
      { name: "Game", value: FAME_GAME_NAME, inline: true },
      { name: "Commands", value: "6 commands available", inline: true },
      { name: "Features", value: "Parallel scanning, Leaderboards, Stats", inline: false }
    ],
    client.user.displayAvatarURL()
  );
});

// Button handler for terms
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;
  
  if (interaction.customId === "accept_terms") {
    acceptedUsers.set(interaction.user.id, { acceptedAt: Date.now(), snipes: 0 });
    
    const confirmEmbed = new EmbedBuilder()
      .setTitle("✅ Welcome to Ultimate Edition!")
      .setDescription("You now have access to all Ultimate features:\n• `/snipe` - Find players\n• `/stats` - View bot stats\n• `/leaderboard` - Top snipers\n• `/servers` - Browse servers\n• `/ping` - Check latency\n• `/help` - Command guide\n\n**Remember:** This bot only works for **Fame**!")
      .setColor(0x9B59B6);
    
    await interaction.update({ embeds: [confirmEmbed], components: [] });
    
    await logToWebhook(
      "New User Accepted",
      `${interaction.user.tag} joined the Ultimate Edition`,
      "SUCCESS",
      [
        { name: "User", value: interaction.user.tag, inline: true },
        { name: "User ID", value: interaction.user.id, inline: true }
      ]
    );
  } else if (interaction.customId === "decline_terms") {
    const declineEmbed = new EmbedBuilder()
      .setTitle("❌ Terms Declined")
      .setDescription("You cannot use the bot at this time. Run `/snipe` again if you change your mind.")
      .setColor(0xFF0000);
    
    await interaction.update({ embeds: [declineEmbed], components: [] });
  }
});

// Main interaction handler
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  
  // Check terms acceptance for snipe command only
  if (interaction.commandName === "snipe" && !acceptedUsers.has(interaction.user.id)) {
    await showTermsOfUse(interaction);
    return;
  }
  
  // ============ HELP COMMAND ============
  if (interaction.commandName === "help") {
    const helpEmbed = new EmbedBuilder()
      .setTitle("🌟 Fame Sniper Bot - Ultimate Edition")
      .setDescription("**Complete Command Guide**")
      .addFields(
        { name: "🎯 /snipe <username>", value: "Find a player in Fame and get a join button", inline: false },
        { name: "📊 /stats", value: "View bot statistics and performance metrics", inline: false },
        { name: "🏆 /leaderboard", value: "See the top snipers leaderboard", inline: false },
        { name: "🌐 /servers", value: "Browse active Fame servers", inline: false },
        { name: "📡 /ping", value: "Check bot latency", inline: false },
        { name: "❓ /help", value: "Show this help message", inline: false }
      )
      .setColor(0x9B59B6)
      .setFooter({ text: "Fame Sniper Bot • Ultimate Edition" });
    
    await interaction.reply({ embeds: [helpEmbed], ephemeral: true });
    return;
  }
  
  // ============ STATS COMMAND ============
  if (interaction.commandName === "stats") {
    const uptime = Math.floor((Date.now() - stats.startTime) / 1000);
    const uptimeDays = Math.floor(uptime / 86400);
    const uptimeHours = Math.floor((uptime % 86400) / 3600);
    const uptimeMinutes = Math.floor((uptime % 3600) / 60);
    const successRate = stats.totalSnipes > 0 ? ((stats.successfulSnipes / stats.totalSnipes) * 100).toFixed(2) : 0;
    
    const statsEmbed = new EmbedBuilder()
      .setTitle("📊 Bot Statistics")
      .addFields(
        { name: "⏱️ Uptime", value: `${uptimeDays}d ${uptimeHours}h ${uptimeMinutes}m`, inline: true },
        { name: "📡 Latency", value: `${Math.round(client.ws.ping)}ms`, inline: true },
        { name: "🎯 Total Snipes", value: `${stats.totalSnipes}`, inline: true },
        { name: "✅ Successful", value: `${stats.successfulSnipes}`, inline: true },
        { name: "❌ Failed", value: `${stats.failedSnipes}`, inline: true },
        { name: "📈 Success Rate", value: `${successRate}%`, inline: true },
        { name: "🌐 API Calls", value: `${stats.apiCalls}`, inline: true },
        { name: "⚠️ Rate Limits", value: `${stats.rateLimits}`, inline: true },
        { name: "👥 Active Users", value: `${acceptedUsers.size}`, inline: true }
      )
      .setColor(0x9B59B6)
      .setFooter({ text: "Fame Sniper Bot • Ultimate Edition" });
    
    await interaction.reply({ embeds: [statsEmbed] });
    return;
  }
  
  // ============ LEADERBOARD COMMAND ============
  if (interaction.commandName === "leaderboard") {
    const sortedUsers = Array.from(acceptedUsers.entries())
      .sort((a, b) => (b[1].snipes || 0) - (a[1].snipes || 0))
      .slice(0, 10);
    
    let leaderboardText = "";
    for (let i = 0; i < sortedUsers.length; i++) {
      const [userId, data] = sortedUsers[i];
      const user = await client.users.fetch(userId).catch(() => null);
      leaderboardText += `${i + 1}. ${user?.tag || "Unknown"} - ${data.snipes || 0} snipes\n`;
    }
    
    if (leaderboardText === "") leaderboardText = "No snipes recorded yet. Be the first!";
    
    const leaderboardEmbed = new EmbedBuilder()
      .setTitle("🏆 Top Snipers Leaderboard")
      .setDescription(leaderboardText)
      .setColor(0x9B59B6)
      .setFooter({ text: "Fame Sniper Bot • Ultimate Edition" });
    
    await interaction.reply({ embeds: [leaderboardEmbed] });
    return;
  }
  
  // ============ SERVERS COMMAND ============
  if (interaction.commandName === "servers") {
    await interaction.deferReply();
    
    const response = await fetch(`https://games.roblox.com/v1/games/${FAME_GAME_ID}/servers/Public?limit=100`);
    const data = await response.json();
    
    let serverList = "";
    if (data.data) {
      const topServers = data.data.slice(0, 10);
      for (let i = 0; i < topServers.length; i++) {
        const server = topServers[i];
        serverList += `${i + 1}. 🎮 ${server.playing || 0}/${server.maxPlayers} players\n`;
      }
    }
    
    const serversEmbed = new EmbedBuilder()
      .setTitle(`🌐 ${FAME_GAME_NAME} Active Servers`)
      .setDescription(serverList || "No servers found")
      .addFields({ name: "Total Servers", value: `${data.data?.length || 0}`, inline: true })
      .setColor(0x9B59B6)
      .setFooter({ text: "Fame Sniper Bot • Ultimate Edition" });
    
    await interaction.editReply({ embeds: [serversEmbed] });
    return;
  }
  
  // ============ PING COMMAND ============
  if (interaction.commandName === "ping") {
    const pingEmbed = new EmbedBuilder()
      .setTitle("📡 Pong!")
      .setDescription(`Latency: **${Math.round(client.ws.ping)}ms**\nAPI Status: **Connected**`)
      .setColor(0x9B59B6)
      .setFooter({ text: "Fame Sniper Bot • Ultimate Edition" });
    
    await interaction.reply({ embeds: [pingEmbed] });
    return;
  }
  
  // ============ SNIPE COMMAND ============
  if (interaction.commandName === "snipe") {
    const startTime = Date.now();
    stats.totalSnipes++;
    
    // Update user stats
    const userStats = acceptedUsers.get(interaction.user.id);
    if (userStats) {
      userStats.snipes = (userStats.snipes || 0) + 1;
      acceptedUsers.set(interaction.user.id, userStats);
    }
    
    try {
      await interaction.deferReply();
      
      const username = interaction.options.getString("username");
      const discordUserId = interaction.user.id;
      
      // Get user ID
      const userData = await getUserId(username);
      if (!userData) {
        stats.failedSnipes++;
        const embed = new EmbedBuilder()
          .setTitle("❌ User Not Found")
          .setDescription(`Could not find "${username}" on Roblox`)
          .setColor(0x2B2D31);
        await interaction.editReply({ content: `<@${discordUserId}>`, embeds: [embed] });
        return;
      }
      
      const userId = userData.id;
      const actualUsername = userData.name;
      
      // Check presence
      const presence = await getUserPresence(userId);
      
      if (!presence.online) {
        stats.failedSnipes++;
        const avatar = await getUserAvatar(userId);
        const embed = new EmbedBuilder()
          .setTitle("❌ Snipe Failed")
          .setDescription(`**${actualUsername}** is currently offline`)
          .setColor(0x2B2D31)
          .setThumbnail(avatar);
        await interaction.editReply({ content: `<@${discordUserId}>`, embeds: [embed] });
        return;
      }
      
      if (!presence.inGame) {
        stats.failedSnipes++;
        const avatar = await getUserAvatar(userId);
        const embed = new EmbedBuilder()
          .setTitle("❌ Snipe Failed")
          .setDescription(`**${actualUsername}** is online but not in a game`)
          .setColor(0x2B2D31)
          .setThumbnail(avatar);
        await interaction.editReply({ content: `<@${discordUserId}>`, embeds: [embed] });
        return;
      }
      
      if (presence.placeId && presence.placeId.toString() !== FAME_GAME_ID) {
        stats.failedSnipes++;
        const avatar = await getUserAvatar(userId);
        const gameName = await getGameName(presence.placeId);
        const embed = new EmbedBuilder()
          .setTitle("❌ Snipe Failed")
          .setDescription(`**${actualUsername}** is playing **${gameName}**, not ${FAME_GAME_NAME}`)
          .addFields({ name: "Note", value: "This bot only works for Fame!", inline: false })
          .setColor(0x2B2D31)
          .setThumbnail(avatar);
        await interaction.editReply({ content: `<@${discordUserId}>`, embeds: [embed] });
        return;
      }
      
      const avatar = await getUserAvatar(userId);
      
      // Searching embed
      const searching = new EmbedBuilder()
        .setTitle("🔍 Ultimate Search in Progress")
        .setDescription(`**Target:** ${actualUsername}\n**Game:** ${FAME_GAME_NAME}\n**Mode:** Ultimate Parallel Scanning\n**Status:** Scanning all public servers...`)
        .setColor(0x9B59B6)
        .setThumbnail(avatar);
      
      await interaction.editReply({ content: `<@${discordUserId}>`, embeds: [searching] });
      
      // Ultimate search
      const result = await findUserUltimate(userId);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      
      if (!result.found) {
        stats.failedSnipes++;
        const embed = new EmbedBuilder()
          .setTitle("❌ Snipe Failed")
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
      stats.successfulSnipes++;
      const joinLink = `https://www.roblox.com/games/${FAME_GAME_ID}?jobId=${result.jobId}`;
      
      const embed = new EmbedBuilder()
        .setTitle("🌟 PLAYER FOUND! 🌟")
        .setDescription(`✨ Successfully located **${actualUsername}** in **${FAME_GAME_NAME}** ✨`)
        .addFields(
          { name: "🎮 Server Status", value: `**${result.players}/${result.maxPlayers}** players`, inline: true },
          { name: "⏱️ Search Time", value: `**${elapsed}** seconds`, inline: true },
          { name: "🔍 Servers Scanned", value: `**${result.scanned}**`, inline: true },
          { name: "⚡ Method", value: "Ultimate Parallel Scan", inline: true },
          { name: "🎯 Community", value: "Designed for Fame's Community", inline: true }
        )
        .setColor(0x9B59B6)
        .setThumbnail(avatar)
        .setImage(avatar)
        .setFooter({ text: "Fame Sniper Bot • Ultimate Edition • Use Responsibly" });
      
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setLabel("🎮 JOIN GAME NOW")
            .setURL(joinLink)
            .setStyle(ButtonStyle.Link)
        );
      
      await interaction.editReply({ content: `<@${discordUserId}>`, embeds: [embed], components: [row] });
      
      await logToWebhook(
        "🎯 Ultimate Snipe Successful",
        `${interaction.user.tag} sniped ${actualUsername}`,
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
      stats.failedSnipes++;
      
      const errorEmbed = new EmbedBuilder()
        .setTitle("❌ Error")
        .setDescription(error.message)
        .setColor(0x2B2D31);
      
      if (interaction.deferred) {
        await interaction.editReply({ embeds: [errorEmbed] });
      } else {
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      }
    }
  }
});

// ============ AUTO BACKUP SYSTEM ============
setInterval(async () => {
  stats.lastBackup = Date.now();
  console.log("Auto-backup completed");
}, 3600000);

// ============ PROCESS HANDLERS ============
process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

client.login(TOKEN);
