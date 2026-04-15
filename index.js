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
  InteractionContextType,
  PermissionFlagsBits
} = require("discord.js");

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const ROBLOX_COOKIE = process.env.ROBLOX_COOKIE;
const PORT = process.env.PORT || 3000;

// Configuration
const FOUNDER_ROLE_ID = "1482560426972549232"; // Your Founder role ID
const FOUNDER_ROLE_MENTION = `<@&${FOUNDER_ROLE_ID}>`;
const FAME_GAME_ID = "121157515767845";
const FAME_GAME_NAME = "Fame";
const WEBHOOK_URL = "https://discord.com/api/webhooks/1493916503291203654/xRsw3M1K4nAJm6c6WVEY99yK1_4XC53cK0JRbvAylSfc6t9XK-Jsi9o4uEU_iaYkRjhP";

// Store accepted users
const acceptedUsers = new Map();

// Statistics
let stats = {
  totalSnipes: 0,
  successfulSnipes: 0,
  failedSnipes: 0,
  startTime: Date.now(),
  apiCalls: 0,
  rateLimits: 0,
  dmsSent: 0
};

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

// ============ CHECK IF USER HAS FOUNDER ROLE ============
async function hasFounderRole(interaction) {
  const member = await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);
  if (!member) return false;
  return member.roles.cache.has(FOUNDER_ROLE_ID);
}

// ============ ULTIMATE LOGGING ============
async function logToWebhook(title, description, type = "INFO", fields = [], thumbnail = null, errorStack = null, pingFounder = false) {
  if (!webhook) return;
  
  try {
    let color = 0x2B2D31;
    let founderPing = "";
    
    switch(type) {
      case "SUCCESS": color = 0x00FF00; break;
      case "ERROR": color = 0xFF0000; if (pingFounder) founderPing = `${FOUNDER_ROLE_MENTION} `; break;
      case "WARNING": color = 0xFFA500; break;
      case "FOUNDER": color = 0x9B59B6; break;
      default: color = 0x2B2D31;
    }
    
    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor(color)
      .setTimestamp()
      .setFooter({ text: "Fame Sniper Bot • Founder Edition" });
    
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

// ============ HTTP SERVER ============
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
      dmsSent: stats.dmsSent,
      version: "Founder Edition 3.0"
    }));
  } else {
    res.end(JSON.stringify({ status: "online", message: "Fame Sniper Bot Founder Edition" }));
  }
}).listen(PORT, () => console.log(`Server on port ${PORT}`));

// ============ ROBLOX API ============
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
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

async function findUserUltimate(userId) {
  let cursor = "";
  let serversScanned = 0;
  const userIdStr = userId.toString();
  
  try {
    const firstPage = await fetch(`https://games.roblox.com/v1/games/${FAME_GAME_ID}/servers/Public?limit=100`);
    const firstData = await firstPage.json();
    
    const allServers = [];
    if (firstData.data) allServers.push(...firstData.data);
    
    let nextCursor = firstData.nextPageCursor;
    while (nextCursor && allServers.length < 2000) {
      const page = await fetch(`https://games.roblox.com/v1/games/${FAME_GAME_ID}/servers/Public?limit=100&cursor=${nextCursor}`);
      const pageData = await page.json();
      if (pageData.data) allServers.push(...pageData.data);
      nextCursor = pageData.nextPageCursor;
      await rateLimit();
    }
    
    for (const server of allServers) {
      serversScanned++;
      if (server.playing && Array.isArray(server.playing)) {
        if (server.playing.map(p => p.toString()).includes(userIdStr)) {
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
    
    return { found: false, scanned: serversScanned };
  } catch (error) {
    return { found: false, scanned: serversScanned, error: true };
  }
}

// ============ REGISTER ALL COMMANDS (Public + Founder) ============
async function registerCommands() {
  const commands = [
    // Public Commands
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
      .toJSON(),
    
    // ============ FOUNDER ONLY COMMANDS ============
    new SlashCommandBuilder()
      .setName("dm")
      .setDescription("[FOUNDER ONLY] Send a DM to a user")
      .addUserOption(opt => opt.setName("user").setDescription("The user to DM").setRequired(true))
      .addStringOption(opt => opt.setName("message").setDescription("The message to send").setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .setIntegrationTypes([ApplicationIntegrationType.GuildInstall])
      .setContexts([InteractionContextType.Guild])
      .toJSON(),
    
    new SlashCommandBuilder()
      .setName("broadcast")
      .setDescription("[FOUNDER ONLY] Send a message to all users who have used the bot")
      .addStringOption(opt => opt.setName("message").setDescription("The message to broadcast").setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .setIntegrationTypes([ApplicationIntegrationType.GuildInstall])
      .setContexts([InteractionContextType.Guild])
      .toJSON(),
    
    new SlashCommandBuilder()
      .setName("resetstats")
      .setDescription("[FOUNDER ONLY] Reset bot statistics")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .setIntegrationTypes([ApplicationIntegrationType.GuildInstall])
      .setContexts([InteractionContextType.Guild])
      .toJSON(),
    
    new SlashCommandBuilder()
      .setName("setgame")
      .setDescription("[FOUNDER ONLY] Change bot's playing status")
      .addStringOption(opt => opt.setName("status").setDescription("The status message").setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .setIntegrationTypes([ApplicationIntegrationType.GuildInstall])
      .setContexts([InteractionContextType.Guild])
      .toJSON(),
    
    new SlashCommandBuilder()
      .setName("announce")
      .setDescription("[FOUNDER ONLY] Send an announcement to the current channel")
      .addStringOption(opt => opt.setName("title").setDescription("Announcement title").setRequired(true))
      .addStringOption(opt => opt.setName("message").setDescription("Announcement message").setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .setIntegrationTypes([ApplicationIntegrationType.GuildInstall])
      .setContexts([InteractionContextType.Guild])
      .toJSON(),
    
    new SlashCommandBuilder()
      .setName("eval")
      .setDescription("[FOUNDER ONLY] Execute JavaScript code")
      .addStringOption(opt => opt.setName("code").setDescription("Code to execute").setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .setIntegrationTypes([ApplicationIntegrationType.GuildInstall])
      .setContexts([InteractionContextType.Guild])
      .toJSON()
  ];

  const rest = new REST({ version: "10" }).setToken(TOKEN);
  try {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log("Founder commands registered!");
    await logToWebhook("Founder Edition Online", "All commands registered with Founder-only restrictions", "FOUNDER", [
      { name: "Public Commands", value: "/snipe, /stats, /leaderboard, /servers, /ping, /help", inline: false },
      { name: "Founder Commands", value: "/dm, /broadcast, /resetstats, /setgame, /announce, /eval", inline: false }
    ]);
  } catch (err) {
    console.error("Command registration failed:", err);
  }
}

// ============ TERMS OF USE ============
async function showTermsOfUse(interaction) {
  const termsEmbed = new EmbedBuilder()
    .setTitle("🌟 FOUNDER EDITION - TERMS OF USE")
    .setDescription("**Welcome to the Fame Sniper Bot!**")
    .addFields(
      { name: "🎮 Game Limitation", value: "This bot can ONLY snipe players in **Fame**. Designed specifically for Fame's community.", inline: false },
      { name: "🔒 Privacy", value: "Only accesses public Roblox data. No private information is collected.", inline: false },
      { name: "⚠️ Limitations", value: "Cannot snipe private/VIP servers due to Roblox API restrictions.", inline: false },
      { name: "📋 Agreement", value: "By accepting, you agree to use this bot responsibly.", inline: false }
    )
    .setColor(0x9B59B6)
    .setFooter({ text: "Fame Sniper Bot • Founder Edition" });
  
  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder().setCustomId("accept_terms").setLabel("✅ Accept & Continue").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("decline_terms").setLabel("❌ Decline").setStyle(ButtonStyle.Danger)
    );
  
  await interaction.reply({ embeds: [termsEmbed], components: [row], ephemeral: true });
}

// ============ BOT READY ============
client.once("ready", async () => {
  console.log(`✅ Founder Edition Online: ${client.user.tag}`);
  console.log(`🎮 Game: ${FAME_GAME_NAME}`);
  console.log(`👑 Founder Role ID: ${FOUNDER_ROLE_ID}`);
  await registerCommands();
  
  await logToWebhook(
    "👑 FOUNDER EDITION ONLINE",
    `Fame Sniper Bot Founder Edition is now operational!`,
    "FOUNDER",
    [
      { name: "Bot Name", value: client.user.tag, inline: true },
      { name: "Game", value: FAME_GAME_NAME, inline: true },
      { name: "Founder Commands", value: "/dm, /broadcast, /resetstats, /setgame, /announce, /eval", inline: false }
    ],
    client.user.displayAvatarURL()
  );
});

// ============ BUTTON HANDLER ============
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;
  
  if (interaction.customId === "accept_terms") {
    acceptedUsers.set(interaction.user.id, { acceptedAt: Date.now(), snipes: 0 });
    
    const confirmEmbed = new EmbedBuilder()
      .setTitle("✅ Welcome to Founder Edition!")
      .setDescription("You now have access to all public commands.\n\n**Commands:**\n• `/snipe` - Find players\n• `/stats` - View stats\n• `/leaderboard` - Top snipers\n• `/servers` - Browse servers\n• `/ping` - Check latency\n• `/help` - Command guide\n\n**Remember:** This bot only works for **Fame**!")
      .setColor(0x9B59B6);
    
    await interaction.update({ embeds: [confirmEmbed], components: [] });
    
    await logToWebhook(
      "New User Accepted",
      `${interaction.user.tag} joined the Founder Edition`,
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

// ============ COMMAND HANDLER ============
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  
  // Check terms acceptance for public commands
  const publicCommands = ["snipe", "stats", "leaderboard", "servers", "ping", "help"];
  if (publicCommands.includes(interaction.commandName) && !acceptedUsers.has(interaction.user.id)) {
    await showTermsOfUse(interaction);
    return;
  }
  
  // ============ FOUNDER COMMAND CHECK ============
  const founderCommands = ["dm", "broadcast", "resetstats", "setgame", "announce", "eval"];
  if (founderCommands.includes(interaction.commandName)) {
    const isFounder = await hasFounderRole(interaction);
    if (!isFounder) {
      const errorEmbed = new EmbedBuilder()
        .setTitle("❌ Access Denied")
        .setDescription(`This command is only available to users with the <@&${FOUNDER_ROLE_ID}> role.`)
        .setColor(0xFF0000);
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      return;
    }
  }
  
  // ============ HELP COMMAND ============
  if (interaction.commandName === "help") {
    const isFounder = await hasFounderRole(interaction);
    
    const helpEmbed = new EmbedBuilder()
      .setTitle("👑 Fame Sniper Bot - Founder Edition")
      .setDescription("**Complete Command Guide**")
      .addFields(
        { name: "🎯 PUBLIC COMMANDS", value: "━━━━━━━━━━━━━━━━━━", inline: false },
        { name: "/snipe <username>", value: "Find a player in Fame and get a join button", inline: false },
        { name: "/stats", value: "View bot statistics and performance metrics", inline: false },
        { name: "/leaderboard", value: "See the top snipers leaderboard", inline: false },
        { name: "/servers", value: "Browse active Fame servers", inline: false },
        { name: "/ping", value: "Check bot latency", inline: false },
        { name: "/help", value: "Show this help message", inline: false }
      )
      .setColor(0x9B59B6)
      .setFooter({ text: "Fame Sniper Bot • Founder Edition" });
    
    if (isFounder) {
      helpEmbed.addFields(
        { name: "👑 FOUNDER COMMANDS", value: "━━━━━━━━━━━━━━━━━━", inline: false },
        { name: "/dm <user> <message>", value: "Send a direct message to any user", inline: false },
        { name: "/broadcast <message>", value: "Broadcast a message to all bot users", inline: false },
        { name: "/resetstats", value: "Reset all bot statistics", inline: false },
        { name: "/setgame <status>", value: "Change the bot's playing status", inline: false },
        { name: "/announce <title> <message>", value: "Send an announcement to current channel", inline: false },
        { name: "/eval <code>", value: "Execute JavaScript code (dangerous!)", inline: false }
      );
    }
    
    await interaction.reply({ embeds: [helpEmbed], ephemeral: true });
    return;
  }
  
  // ============ FOUNDER: DM COMMAND ============
  if (interaction.commandName === "dm") {
    await interaction.deferReply({ ephemeral: true });
    
    const targetUser = interaction.options.getUser("user");
    const message = interaction.options.getString("message");
    
    try {
      await targetUser.send({
        embeds: [
          new EmbedBuilder()
            .setTitle("📨 Message from Founder")
            .setDescription(message)
            .setColor(0x9B59B6)
            .setFooter({ text: "Fame Sniper Bot • Founder Message" })
            .setTimestamp()
        ]
      });
      
      stats.dmsSent++;
      
      const successEmbed = new EmbedBuilder()
        .setTitle("✅ DM Sent")
        .setDescription(`Message successfully sent to ${targetUser.tag}`)
        .setColor(0x00FF00);
      
      await interaction.editReply({ embeds: [successEmbed] });
      
      await logToWebhook(
        "📨 Founder DM Sent",
        `${interaction.user.tag} sent a DM to ${targetUser.tag}`,
        "FOUNDER",
        [
          { name: "From", value: interaction.user.tag, inline: true },
          { name: "To", value: targetUser.tag, inline: true },
          { name: "Message", value: message.substring(0, 200), inline: false }
        ]
      );
    } catch (error) {
      const errorEmbed = new EmbedBuilder()
        .setTitle("❌ Failed to Send DM")
        .setDescription(`Could not send message to ${targetUser.tag}. They may have DMs disabled.`)
        .setColor(0xFF0000);
      
      await interaction.editReply({ embeds: [errorEmbed] });
    }
    return;
  }
  
  // ============ FOUNDER: BROADCAST COMMAND ============
  if (interaction.commandName === "broadcast") {
    await interaction.deferReply({ ephemeral: true });
    
    const message = interaction.options.getString("message");
    let successCount = 0;
    let failCount = 0;
    
    for (const [userId, data] of acceptedUsers) {
      try {
        const user = await client.users.fetch(userId);
        await user.send({
          embeds: [
            new EmbedBuilder()
              .setTitle("📢 Broadcast Message")
              .setDescription(message)
              .setColor(0x9B59B6)
              .setFooter({ text: "Fame Sniper Bot • Founder Broadcast" })
              .setTimestamp()
          ]
        });
        successCount++;
      } catch (error) {
        failCount++;
      }
      await new Promise(r => setTimeout(r, 500)); // Rate limit
    }
    
    const broadcastEmbed = new EmbedBuilder()
      .setTitle("📢 Broadcast Complete")
      .setDescription(`Message broadcast to ${successCount} users\nFailed: ${failCount}`)
      .setColor(0x9B59B6);
    
    await interaction.editReply({ embeds: [broadcastEmbed] });
    
    await logToWebhook(
      "📢 Broadcast Sent",
      `${interaction.user.tag} broadcast a message to ${successCount} users`,
      "FOUNDER",
      [
        { name: "Message", value: message.substring(0, 200), inline: false },
        { name: "Successful", value: `${successCount}`, inline: true },
        { name: "Failed", value: `${failCount}`, inline: true }
      ]
    );
    return;
  }
  
  // ============ FOUNDER: RESET STATS ============
  if (interaction.commandName === "resetstats") {
    await interaction.deferReply({ ephemeral: true });
    
    stats = {
      totalSnipes: 0,
      successfulSnipes: 0,
      failedSnipes: 0,
      startTime: Date.now(),
      apiCalls: 0,
      rateLimits: 0,
      dmsSent: 0
    };
    
    const resetEmbed = new EmbedBuilder()
      .setTitle("✅ Stats Reset")
      .setDescription("All bot statistics have been reset to zero.")
      .setColor(0x00FF00);
    
    await interaction.editReply({ embeds: [resetEmbed] });
    
    await logToWebhook(
      "📊 Stats Reset",
      `${interaction.user.tag} reset all bot statistics`,
      "FOUNDER"
    );
    return;
  }
  
  // ============ FOUNDER: SET GAME STATUS ============
  if (interaction.commandName === "setgame") {
    await interaction.deferReply({ ephemeral: true });
    
    const status = interaction.options.getString("status");
    
    await client.user.setActivity(status, { type: 0 });
    
    const gameEmbed = new EmbedBuilder()
      .setTitle("✅ Status Updated")
      .setDescription(`Bot status changed to: **${status}**`)
      .setColor(0x00FF00);
    
    await interaction.editReply({ embeds: [gameEmbed] });
    
    await logToWebhook(
      "🎮 Bot Status Changed",
      `${interaction.user.tag} changed bot status to "${status}"`,
      "FOUNDER"
    );
    return;
  }
  
  // ============ FOUNDER: ANNOUNCE COMMAND ============
  if (interaction.commandName === "announce") {
    const title = interaction.options.getString("title");
    const message = interaction.options.getString("message");
    
    const announceEmbed = new EmbedBuilder()
      .setTitle(`📢 ${title}`)
      .setDescription(message)
      .setColor(0x9B59B6)
      .setFooter({ text: `Announcement from Founder • ${interaction.user.tag}` })
      .setTimestamp();
    
    await interaction.reply({ embeds: [announceEmbed] });
    
    await logToWebhook(
      "📢 Announcement Made",
      `${interaction.user.tag} posted an announcement`,
      "FOUNDER",
      [
        { name: "Title", value: title, inline: true },
        { name: "Message", value: message.substring(0, 200), inline: false }
      ]
    );
    return;
  }
  
  // ============ FOUNDER: EVAL COMMAND (DANGEROUS) ============
  if (interaction.commandName === "eval") {
    await interaction.deferReply({ ephemeral: true });
    
    const code = interaction.options.getString("code");
    
    try {
      let result = eval(code);
      if (typeof result !== "string") {
        result = require("util").inspect(result);
      }
      
      const evalEmbed = new EmbedBuilder()
        .setTitle("✅ Eval Executed")
        .addFields(
          { name: "Input", value: `\`\`\`js\n${code.substring(0, 400)}\n\`\`\``, inline: false },
          { name: "Output", value: `\`\`\`js\n${result.substring(0, 400)}\n\`\`\``, inline: false }
        )
        .setColor(0x00FF00);
      
      await interaction.editReply({ embeds: [evalEmbed] });
      
      await logToWebhook(
        "💻 Eval Executed",
        `${interaction.user.tag} executed code`,
        "FOUNDER",
        [
          { name: "Code", value: code.substring(0, 200), inline: false }
        ]
      );
    } catch (error) {
      const errorEmbed = new EmbedBuilder()
        .setTitle("❌ Eval Failed")
        .setDescription(`\`\`\`js\n${error.message}\n\`\`\``)
        .setColor(0xFF0000);
      
      await interaction.editReply({ embeds: [errorEmbed] });
    }
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
        { name: "📨 DMs Sent", value: `${stats.dmsSent}`, inline: true },
        { name: "👥 Active Users", value: `${acceptedUsers.size}`, inline: true }
      )
      .setColor(0x9B59B6)
      .setFooter({ text: "Fame Sniper Bot • Founder Edition" });
    
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
      .setFooter({ text: "Fame Sniper Bot • Founder Edition" });
    
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
      .setFooter({ text: "Fame Sniper Bot • Founder Edition" });
    
    await interaction.editReply({ embeds: [serversEmbed] });
    return;
  }
  
  // ============ PING COMMAND ============
  if (interaction.commandName === "ping") {
    const pingEmbed = new EmbedBuilder()
      .setTitle("📡 Pong!")
      .setDescription(`Latency: **${Math.round(client.ws.ping)}ms**\nAPI Status: **Connected**`)
      .setColor(0x9B59B6)
      .setFooter({ text: "Fame Sniper Bot • Founder
