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

// Allowed server IDs where invites are permitted (add your server ID here)
const ALLOWED_SERVER_IDS = [
  "YOUR_SERVER_ID_HERE" // Replace with your actual Discord server ID
];

// Track user violations
const userViolations = new Map();

// Keep alive server for Render
http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Bot is alive");
}).listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

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
      try {
        await message.delete();
        console.log(`[PROTECTION] Deleted invite from ${message.author.tag}`);
        
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
              
              setTimeout(async () => {
                await member.roles.remove(muteRole);
                userViolations.delete(message.author.id);
                console.log(`[PROTECTION] ${message.author.tag} has been unmuted`);
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
    
    console.log(`[PROTECTION] Added ${serverId} (${serverName}) to allowed servers`);
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
    
    console.log(`[PROTECTION] Removed ${serverId} from allowed servers`);
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
      console.log(`[PROTECTION] Cleared warnings for ${targetUser.tag}`);
    } else {
      const embed = new EmbedBuilder()
        .setTitle("No Warnings Found")
        .setDescription(`${targetUser.tag} has no invite violation warnings.`)
        .setColor(0xFFA500);
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
    return;
  }
  
  // SNIPE COMMAND
  if (interaction.commandName !== "snipe") return;

  const startTime = Date.now();
  
  try {
    await interaction.deferReply();
    
    const username = interaction.options.getString("username");
    const discordUserId = interaction.user.id;
    const discordUserTag = interaction.user.tag;
    
    console.log(`[SNIPE] Request for user: ${username} by ${discordUserTag}`);
    
    const userData = await getUserId(username);
    if (!userData) {
      const embed = new EmbedBuilder()
        .setTitle("User Not Found")
        .setDescription(`${discordUserTag} tried to find "${username}" but they don't exist on Roblox`)
        .setColor(0xFF0000);
      await interaction.editReply({ embeds: [embed] });
      return;
    }
    
    const userId = userData.id;
    const actualUsername = userData.name;
    console.log(`[SNIPE] Found user: ${actualUsername} (${userId})`);
    
    const presence = await getUserPresence(userId);
    
    if (!presence.online) {
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
    
    console.log(`[SNIPE] SUCCESS - ${discordUserTag} found ${actualUsername} in ${result.scanned} servers`);
    
  } catch (error) {
    console.error("Snipe error:", error);
    const errorEmbed = new EmbedBuilder()
      .setTitle("Error")
      .setDescription(`An error occurred: ${error.message}`)
      .setColor(0xFF0000);
    
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
