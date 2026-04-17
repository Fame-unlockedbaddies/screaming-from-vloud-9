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
  InteractionContextType,
  PermissionsBitField
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
const WEBHOOK_URL = "https://discord.com/api/webhooks/1493916503291203654/xRsw3M1K4nAJm6c6WVEY99yK1_4XC53cK0JRbvAylSfc6t9XK-Jsi9o4uEU_iaYkRjhP";

// Allowed server IDs where invites are permitted (add your server ID here)
const ALLOWED_SERVER_IDS = [
  "YOUR_SERVER_ID_HERE" // Replace with your actual Discord server ID
];

// Track user violations
const userViolations = new Map();

// Statistics
let stats = {
  totalSnipes: 0,
  successfulSnipes: 0,
  failedSnipes: 0,
  startTime: Date.now(),
  apiCalls: 0,
  rateLimits: 0,
  blockedInvites: 0
};

// Webhook setup
let webhook = null;
try {
  webhook = new WebhookClient({ url: WEBHOOK_URL });
  console.log("Webhook logging enabled");
} catch (error) {
  console.error("Webhook failed:", error.message);
}

// Webhook logging function
async function logToWebhook(title, description, type = "INFO", fields = [], thumbnail = null, errorStack = null) {
  if (!webhook) return;
  
  try {
    let color = 0x2B2D31;
    switch(type) {
      case "SUCCESS": color = 0x00FF00; break;
      case "ERROR": color = 0xFF0000; break;
      case "WARNING": color = 0xFFA500; break;
      case "PROTECTION": color = 0x9B59B6; break;
      default: color = 0x2B2D31;
    }
    
    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor(color)
      .setTimestamp()
      .setFooter({ text: "Fame Sniper Bot • Protection System" });
    
    if (fields && fields.length > 0) embed.addFields(fields);
    if (thumbnail) embed.setThumbnail(thumbnail);
    if (errorStack) {
      embed.addFields({
        name: "Technical Details",
        value: `\`\`\`diff\n- ${errorStack.slice(0, 400)}\n\`\`\``,
        inline: false
      });
    }
    
    await webhook.send({ embeds: [embed] });
  } catch (error) {
    console.error("Webhook error:", error.message);
  }
}

// Keep alive server for Render
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
      blockedInvites: stats.blockedInvites,
      version: "2.0"
    }));
  } else {
    res.end(JSON.stringify({ status: "online", message: "Fame Sniper Bot" }));
  }
}).listen(PORT, () => console.log(`Server on port ${PORT}`));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

// Rate limiting
let lastRequest = 0;
const REQUEST_DELAY = 200;

async function waitForRateLimit() {
  const now = Date.now();
  const wait = lastRequest + REQUEST_DELAY - now;
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastRequest = Date.now();
  stats.apiCalls++;
}

// Get user ID from username
async function getUserId(username) {
  try {
    await waitForRateLimit();
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
    console.error("getUserId error:", error);
    return null;
  }
}

// Get user presence (online/offline/in game)
async function getUserPresence(userId) {
  try {
    await waitForRateLimit();
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
    console.error("getUserPresence error:", error);
    return { online: false, inGame: false, placeId: null };
  }
}

// Get user avatar
async function getUserAvatar(userId) {
  try {
    await waitForRateLimit();
    const res = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=720x720&format=Png&isCircular=false`);
    const data = await res.json();
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
    const res = await fetch(`https://games.roblox.com/v1/games?universeIds=${placeId}`);
    const data = await res.json();
    return data.data?.[0]?.name || "Unknown Game";
  } catch (error) {
    return "Unknown Game";
  }
}

// SCAN ALL SERVERS TO FIND THE USER
async function findUserInServers(userId) {
  let cursor = "";
  let serversScanned = 0;
  const userIdStr = userId.toString();
  
  console.log(`[SEARCH] Looking for user ${userIdStr} in ${FAME_GAME_NAME}`);
  
  try {
    for (let attempt = 0; attempt < 30; attempt++) {
      await waitForRateLimit();
      const url = `https://games.roblox.com/v1/games/${FAME_GAME_ID}/servers/Public?limit=100${cursor ? `&cursor=${cursor}` : ""}`;
      const res = await fetch(url);
      
      if (res.status === 429) {
        stats.rateLimits++;
        console.log("[SEARCH] Rate limited, waiting...");
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      
      const data = await res.json();
      if (!data.data || data.data.length === 0) break;
      
      for (const server of data.data) {
        serversScanned++;
        
        if (server.playing && Array.isArray(server.playing)) {
          if (server.playing.map(p => p.toString()).includes(userIdStr)) {
            console.log(`[SEARCH] FOUND user after scanning ${serversScanned} servers`);
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
    
    console.log(`[SEARCH] NOT FOUND after scanning ${serversScanned} servers`);
    return { found: false, scanned: serversScanned };
    
  } catch (error) {
    console.error("[SEARCH] Error:", error);
    return { found: false, scanned: serversScanned, error: true };
  }
}

// ============ INVITE PROTECTION ============
const inviteRegex = /(?:https?:\/\/)?(?:www\.)?(?:discord\.(?:gg|com\/invite)\/)([a-zA-Z0-9\-_]+)/gi;

async function isInviteAllowed(inviteCode) {
  try {
    const invite = await client.fetchInvite(inviteCode).catch(() => null);
    if (!invite) return false;
    return ALLOWED_SERVER_IDS.includes(invite.guild.id);
  } catch (error) {
    return false;
  }
}

async function sendViolationDM(user, violationCount, isMuted = false) {
  const dmEmbed = new EmbedBuilder()
    .setTitle("Invite Link Violation")
    .setDescription(`You have been detected posting an unauthorized invite link.`)
    .addFields(
      { name: "Violation Count", value: `${violationCount}/3`, inline: true },
      { name: "Consequence", value: isMuted ? "You have been muted for 10 minutes." : "Warning issued.", inline: true },
      { name: "Rule", value: "Only invites to approved servers are allowed.", inline: false }
    )
    .setColor(0xFF0000)
    .setFooter({ text: "Fame Sniper Bot • Protection System" });
  
  try {
    await user.send({ embeds: [dmEmbed] });
    console.log(`[PROTECTION] DM sent to ${user.tag} - Violation ${violationCount}/3`);
  } catch (error) {
    console.log(`[PROTECTION] Could not DM ${user.tag}`);
  }
}

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  
  const matches = message.content.match(inviteRegex);
  if (!matches) return;
  
  for (const match of matches) {
    const inviteCode = match.split("/").pop();
    const isAllowed = await isInviteAllowed(inviteCode);
    
    if (!isAllowed) {
      stats.blockedInvites++;
      
      try {
        await message.delete();
        console.log(`[PROTECTION] Deleted invite from ${message.author.tag}`);
        
        // Log to webhook
        await logToWebhook(
          "Invite Link Blocked",
          `Blocked invite from ${message.author.tag} in ${message.guild?.name || "DM"}`,
          "PROTECTION",
          [
            { name: "User", value: message.author.tag, inline: true },
            { name: "Channel", value: message.channel.name || "DM", inline: true },
            { name: "Content", value: message.content.substring(0, 100), inline: false }
          ]
        );
        
        // Track violations
        const violations = (userViolations.get(message.author.id) || 0) + 1;
        userViolations.set(message.author.id, violations);
        
        let consequence = "";
        let isMuted = false;
        
        if (violations >= 3) {
          // Mute the user for 10 minutes
          const member = await message.guild?.members.fetch(message.author.id).catch(() => null);
          if (member) {
            const muteRole = message.guild.roles.cache.find(r => r.name === "Muted");
            if (muteRole) {
              await member.roles.add(muteRole);
              isMuted = true;
              consequence = "You have been muted for 10 minutes.";
              
              await logToWebhook(
                "User Muted",
                `${message.author.tag} was muted for 10 minutes due to repeated invite violations`,
                "PROTECTION",
                [
                  { name: "User", value: message.author.tag, inline: true },
                  { name: "Violations", value: `${violations}/3`, inline: true }
                ]
              );
              
              setTimeout(async () => {
                await member.roles.remove(muteRole);
                userViolations.delete(message.author.id);
                console.log(`[PROTECTION] ${message.author.tag} has been unmuted`);
                
                await logToWebhook(
                  "User Unmuted",
                  `${message.author.tag} has been automatically unmuted after 10 minutes`,
                  "PROTECTION"
                );
              }, 600000);
            } else {
              consequence = "Warning issued. Create a 'Muted' role to enable automatic muting.";
            }
          } else {
            consequence = "Warning issued. (Could not find member in guild)";
          }
        } else {
          consequence = `Warning ${violations}/3. ${3 - violations} more violation(s) will result in a mute.`;
        }
        
        // Send DM to user
        await sendViolationDM(message.author, violations, isMuted);
        
        // Send public warning (auto-delete after 5 seconds)
        const warningEmbed = new EmbedBuilder()
          .setTitle("Invite Link Blocked")
          .setDescription(`${message.author}, you are not allowed to post invite links to other servers.`)
          .addFields(
            { name: "Consequence", value: consequence, inline: false }
          )
          .setColor(0xFF0000)
          .setFooter({ text: "Fame Sniper Bot • Protection System" });
        
        const warningMsg = await message.channel.send({ embeds: [warningEmbed] });
        setTimeout(() => warningMsg.delete().catch(() => {}), 5000);
        
      } catch (error) {
        console.error("[PROTECTION] Failed to delete message:", error);
        await logToWebhook(
          "Protection Error",
          `Failed to delete invite message from ${message.author.tag}`,
          "ERROR",
          [{ name: "Error", value: error.message, inline: false }]
        );
      }
      break;
    }
  }
});

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
      .toJSON(),
    
    new SlashCommandBuilder()
      .setName("allowserver")
      .setDescription("[ADMIN] Add a server ID to the allowed list for invites")
      .addStringOption(opt => 
        opt.setName("serverid")
          .setDescription("Discord server ID to allow")
          .setRequired(true)
      )
      .addStringOption(opt =>
        opt.setName("name")
          .setDescription("Server name (optional)")
          .setRequired(false)
      )
      .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
      .toJSON(),
    
    new SlashCommandBuilder()
      .setName("allowlist")
      .setDescription("[ADMIN] View allowed servers for invites")
      .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
      .toJSON(),
    
    new SlashCommandBuilder()
      .setName("removeallowed")
      .setDescription("[ADMIN] Remove a server from the allowed list")
      .addStringOption(opt => 
        opt.setName("serverid")
          .setDescription("Discord server ID to remove")
          .setRequired(true)
      )
      .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
      .toJSON(),
    
    new SlashCommandBuilder()
      .setName("clearwarnings")
      .setDescription("[ADMIN] Clear invite violations for a user")
      .addUserOption(opt =>
        opt.setName("user")
          .setDescription("User to clear warnings for")
          .setRequired(true)
      )
      .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
      .toJSON(),
    
    new SlashCommandBuilder()
      .setName("stats")
      .setDescription("View bot statistics")
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
      "Bot Online",
      `Fame Sniper Bot is now operational with invite protection enabled`,
      "SUCCESS",
      [
        { name: "Game", value: FAME_GAME_NAME, inline: true },
        { name: "Commands", value: "/snipe, /stats, /allowlist", inline: true },
        { name: "Protection", value: "Active", inline: true }
      ]
    );
  } catch (err) {
    console.error("Command registration failed:", err);
    await logToWebhook(
      "Command Registration Failed",
      err.message,
      "ERROR"
    );
  }
}

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  console.log(`Sniping game: ${FAME_GAME_NAME}`);
  console.log(`[PROTECTION] Invite protection enabled. Allowed servers: ${ALLOWED_SERVER_IDS.length}`);
  await registerCommands();
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  
  // Handle allowserver command
  if (interaction.commandName === "allowserver") {
    const serverId = interaction.options.getString("serverid");
    const serverName = interaction.options.getString("name") || "Unknown";
    
    if (ALLOWED_SERVER_IDS.includes(serverId)) {
      const embed = new EmbedBuilder()
        .setTitle("Server Already Allowed")
        .setDescription(`Server ID \`${serverId}\` is already in the allowed list.`)
        .setColor(0xFFA500);
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }
    
    ALLOWED_SERVER_IDS.push(serverId);
    const embed = new EmbedBuilder()
      .setTitle("Server Added to Allowlist")
      .setDescription(`Server **${serverName}** (\`${serverId}\`) has been added to the allowed invite list.`)
      .addFields({ name: "Total Allowed Servers", value: `${ALLOWED_SERVER_IDS.length}`, inline: true })
      .setColor(0x00FF00);
    await interaction.reply({ embeds: [embed], ephemeral: true });
    
    await logToWebhook(
      "Server Added to Allowlist",
      `${interaction.user.tag} added server ${serverName} (${serverId})`,
      "PROTECTION",
      [
        { name: "Added By", value: interaction.user.tag, inline: true },
        { name: "Server ID", value: serverId, inline: true }
      ]
    );
    return;
  }
  
  // Handle allowlist command
  if (interaction.commandName === "allowlist") {
    let listText = "";
    for (let i = 0; i < ALLOWED_SERVER_IDS.length; i++) {
      const serverId = ALLOWED_SERVER_IDS[i];
      let serverName = "Unknown";
      try {
        const guild = await client.guilds.fetch(serverId);
        serverName = guild.name;
      } catch (e) {}
      listText += `${i + 1}. **${serverName}** (\`${serverId}\`)\n`;
    }
    
    if (listText === "") listText = "No servers in allowlist yet.";
    
    const embed = new EmbedBuilder()
      .setTitle("Allowed Servers for Invites")
      .setDescription(listText)
      .addFields({ name: "Total", value: `${ALLOWED_SERVER_IDS.length} servers`, inline: true })
      .setColor(0x5865F2);
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }
  
  // Handle removeallowed command
  if (interaction.commandName === "removeallowed") {
    const serverId = interaction.options.getString("serverid");
    const index = ALLOWED_SERVER_IDS.indexOf(serverId);
    
    if (index === -1) {
      const embed = new EmbedBuilder()
        .setTitle("Server Not Found")
        .setDescription(`Server ID \`${serverId}\` is not in the allowed list.`)
        .setColor(0xFF0000);
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }
    
    ALLOWED_SERVER_IDS.splice(index, 1);
    const embed = new EmbedBuilder()
      .setTitle("Server Removed from Allowlist")
      .setDescription(`Server ID \`${serverId}\` has been removed from the allowed invite list.`)
      .addFields({ name: "Total Allowed Servers", value: `${ALLOWED_SERVER_IDS.length}`, inline: true })
      .setColor(0xFFA500);
    await interaction.reply({ embeds: [embed], ephemeral: true });
    
    await logToWebhook(
      "Server Removed from Allowlist",
      `${interaction.user.tag} removed server ${serverId}`,
      "PROTECTION",
      [
        { name: "Removed By", value: interaction.user.tag, inline: true },
        { name: "Server ID", value: serverId, inline: true }
      ]
    );
    return;
  }
  
  // Handle clearwarnings command
  if (interaction.commandName === "clearwarnings") {
    const targetUser = interaction.options.getUser("user");
    
    if (userViolations.has(targetUser.id)) {
      userViolations.delete(targetUser.id);
      const embed = new EmbedBuilder()
        .setTitle("Warnings Cleared")
        .setDescription(`Cleared all invite violation warnings for ${targetUser.tag}.`)
        .setColor(0x00FF00);
      await interaction.reply({ embeds: [embed], ephemeral: true });
      
      await logToWebhook(
        "Warnings Cleared",
        `${interaction.user.tag} cleared warnings for ${targetUser.tag}`,
        "PROTECTION",
        [
          { name: "Cleared By", value: interaction.user.tag, inline: true },
          { name: "User", value: targetUser.tag, inline: true }
        ]
      );
    } else {
      const embed = new EmbedBuilder()
        .setTitle("No Warnings Found")
        .setDescription(`${targetUser.tag} has no invite violation warnings.`)
        .setColor(0xFFA500);
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
    return;
  }
  
  // Handle stats command
  if (interaction.commandName === "stats") {
    const uptime = Math.floor((Date.now() - stats.startTime) / 1000);
    const uptimeDays = Math.floor(uptime / 86400);
    const uptimeHours = Math.floor((uptime % 86400) / 3600);
    const uptimeMinutes = Math.floor((uptime % 3600) / 60);
    const successRate = stats.totalSnipes > 0 ? ((stats.successfulSnipes / stats.totalSnipes) * 100).toFixed(2) : 0;
    
    const statsEmbed = new EmbedBuilder()
      .setTitle("Bot Statistics")
      .addFields(
        { name: "Uptime", value: `${uptimeDays}d ${uptimeHours}h ${uptimeMinutes}m`, inline: true },
        { name: "Latency", value: `${Math.round(client.ws.ping)}ms`, inline: true },
        { name: "Total Snipes", value: `${stats.totalSnipes}`, inline: true },
        { name: "Successful", value: `${stats.successfulSnipes}`, inline: true },
        { name: "Failed", value: `${stats.failedSnipes}`, inline: true },
        { name: "Success Rate", value: `${successRate}%`, inline: true },
        { name: "API Calls", value: `${stats.apiCalls}`, inline: true },
        { name: "Rate Limits", value: `${stats.rateLimits}`, inline: true },
        { name: "Blocked Invites", value: `${stats.blockedInvites}`, inline: true }
      )
      .setColor(0x5865F2);
    
    await interaction.reply({ embeds: [statsEmbed] });
    return;
  }
  
  // SNIPE COMMAND
  if (interaction.commandName !== "snipe") return;

  const startTime = Date.now();
  stats.totalSnipes++;
  
  try {
    await interaction.deferReply();
    
    const username = interaction.options.getString("username");
    const discordUserId = interaction.user.id;
    const discordUserTag = interaction.user.tag;
    
    console.log(`[SNIPE] Request for user: ${username} by ${discordUserTag}`);
    
    const userData = await getUserId(username);
    if (!userData) {
      stats.failedSnipes++;
      const embed = new EmbedBuilder()
        .setTitle("User Not Found")
        .setDescription(`${discordUserTag} tried to find "${username}" but they don't exist on Roblox`)
        .setColor(0xFF0000);
      await interaction.editReply({ embeds: [embed] });
      
      await logToWebhook(
        "Snipe Failed - User Not Found",
        `${discordUserTag} tried to snipe ${username}`,
        "ERROR",
        [{ name: "Username", value: username, inline: true }]
      );
      return;
    }
    
    const userId = userData.id;
    const actualUsername = userData.name;
    console.log(`[SNIPE] Found user: ${actualUsername} (${userId})`);
    
    const presence = await getUserPresence(userId);
    
    if (!presence.online) {
      stats.failedSnipes++;
      const avatar = await getUserAvatar(userId);
      const embed = new EmbedBuilder()
        .setTitle("Snipe Failed")
        .setDescription(`${discordUserTag} tried to snipe **${actualUsername}** but they are offline`)
        .addFields({ name: "Status", value: "Offline", inline: true })
        .setColor(0xFF0000)
        .setThumbnail(avatar);
      await interaction.editReply({ embeds: [embed] });
      return;
    }
    
    if (!presence.inGame) {
      stats.failedSnipes++;
      const avatar = await getUserAvatar(userId);
      const embed = new EmbedBuilder()
        .setTitle("Snipe Failed")
        .setDescription(`${discordUserTag} tried to snipe **${actualUsername}** but they are online and not in a game`)
        .addFields({ name: "Status", value: "Online (Idle)", inline: true })
        .setColor(0xFFA500)
        .setThumbnail(avatar);
      await interaction.editReply({ embeds: [embed] });
      return;
    }
    
    if (presence.placeId && presence.placeId.toString() !== FAME_GAME_ID) {
      stats.failedSnipes++;
      const avatar = await getUserAvatar(userId);
      const gameName = await getGameName(presence.placeId);
      const embed = new EmbedBuilder()
        .setTitle("Snipe Failed")
        .setDescription(`${discordUserTag} tried to snipe **${actualUsername}** but they are playing **${gameName}**, not ${FAME_GAME_NAME}`)
        .addFields(
          { name: "Current Game", value: gameName, inline: true },
          { name: "Target Game", value: FAME_GAME_NAME, inline: true }
        )
        .setColor(0xFFA500)
        .setThumbnail(avatar);
      await interaction.editReply({ embeds: [embed] });
      return;
    }
    
    const avatar = await getUserAvatar(userId);
    
    const searching = new EmbedBuilder()
      .setTitle("Searching for player...")
      .setDescription(`${discordUserTag} is looking for **${actualUsername}** in **${FAME_GAME_NAME}**\n\nScanning public servers...`)
      .setColor(0x5865F2)
      .setThumbnail(avatar);
    
    await interaction.editReply({ embeds: [searching] });
    
    const result = await findUserInServers(userId);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    
    if (!result.found) {
      stats.failedSnipes++;
      const embed = new EmbedBuilder()
        .setTitle("Snipe Failed")
        .setDescription(`${discordUserTag} could not find **${actualUsername}** in **${FAME_GAME_NAME}**`)
        .addFields(
          { name: "Servers Scanned", value: `${result.scanned} servers`, inline: true },
          { name: "Time", value: `${elapsed} seconds`, inline: true },
          { name: "Reason", value: "User may be in a private/VIP server", inline: false }
        )
        .setColor(0xFF0000)
        .setThumbnail(avatar);
      await interaction.editReply({ embeds: [embed] });
      return;
    }
    
    stats.successfulSnipes++;
    const joinLink = `https://www.roblox.com/games/${FAME_GAME_ID}?jobId=${result.jobId}`;
    
    const embed = new EmbedBuilder()
      .setTitle("Player Found")
      .setDescription(`${discordUserTag} successfully found **${actualUsername}** in **${FAME_GAME_NAME}**`)
      .addFields(
        { name: "Server Status", value: `${result.players}/${result.maxPlayers} players`, inline: true },
        { name: "Search Time", value: `${elapsed} seconds`, inline: true },
        { name: "Servers Scanned", value: `${result.scanned} servers`, inline: true },
        { name: "Method", value: "public_api", inline: true }
      )
      .setColor(0x00FF00)
      .setThumbnail(avatar)
      .setImage(avatar)
      .setFooter({ text: `Sniped by ${discordUserTag}` });
    
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setLabel("Join Game")
          .setURL(joinLink)
          .setStyle(ButtonStyle.Link)
      );
    
    await interaction.editReply({ embeds: [embed], components: [row] });
    
    await logToWebhook(
      "Snipe Successful",
      `${discordUserTag} sniped ${actualUsername}`,
      "SUCCESS",
      [
        { name: "Target", value: actualUsername, inline: true },
        { name: "Server", value: `${result.players}/${result.maxPlayers}`, inline: true },
        { name: "Time", value: `${elapsed}s`, inline: true },
        { name: "Servers Scanned", value: `${result.scanned}`, inline: true }
      ],
      avatar
    );
    
  } catch (error) {
    console.error("Snipe error:", error);
    stats.failedSnipes++;
    const errorEmbed = new EmbedBuilder()
      .setTitle("Error")
      .setDescription(`An error occurred: ${error.message}`)
      .setColor(0xFF0000);
    
    await logToWebhook(
      "Snipe Error",
      `Error occurred during snipe command`,
      "ERROR",
      [{ name: "Error", value: error.message, inline: false }],
      null,
      error.stack
    );
    
    if (interaction.deferred) {
      await interaction.editReply({ embeds: [errorEmbed] });
    } else {
      await interaction.reply({ embeds: [errorEmbed] });
    }
  }
});

process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

client.login(TOKEN);
