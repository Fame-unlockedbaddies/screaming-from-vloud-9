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
      // userPresenceType: 0=Offline, 1=Online, 2=InGame, 3=InStudio
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
    // Scan up to 30 pages (3000 servers)
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
        
        // Check if user is in this server's player list
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

// Register slash command
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
    console.log("Snipe command registered!");
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
    
    console.log(`[SNIPE] Request for user: ${username}`);
    
    // STEP 1: Get user ID
    const userData = await getUserId(username);
    if (!userData) {
      const embed = new EmbedBuilder()
        .setTitle("User Not Found")
        .setDescription(`Could not find "${username}" on Roblox`)
        .setColor(0xFF0000);
      await interaction.editReply({ content: `<@${discordUserId}>`, embeds: [embed] });
      return;
    }
    
    const userId = userData.id;
    const actualUsername = userData.name;
    console.log(`[SNIPE] Found user: ${actualUsername} (${userId})`);
    
    // STEP 2: Check if they're online and in game
    const presence = await getUserPresence(userId);
    
    if (!presence.online) {
      const avatar = await getUserAvatar(userId);
      const embed = new EmbedBuilder()
        .setTitle("Snipe Failed")
        .setDescription(`**${actualUsername}** is currently offline`)
        .addFields({ name: "Status", value: "Offline", inline: true })
        .setColor(0xFF0000)
        .setThumbnail(avatar);
      await interaction.editReply({ content: `<@${discordUserId}>`, embeds: [embed] });
      return;
    }
    
    if (!presence.inGame) {
      const avatar = await getUserAvatar(userId);
      const embed = new EmbedBuilder()
        .setTitle("Snipe Failed")
        .setDescription(`**${actualUsername}** is online but not in a game`)
        .addFields({ name: "Status", value: "Online (Idle)", inline: true })
        .setColor(0xFFA500)
        .setThumbnail(avatar);
      await interaction.editReply({ content: `<@${discordUserId}>`, embeds: [embed] });
      return;
    }
    
    // STEP 3: Check if they're playing Fame
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
        .setColor(0xFFA500)
        .setThumbnail(avatar);
      await interaction.editReply({ content: `<@${discordUserId}>`, embeds: [embed] });
      return;
    }
    
    const avatar = await getUserAvatar(userId);
    
    // STEP 4: Searching embed
    const searching = new EmbedBuilder()
      .setTitle("Searching...")
      .setDescription(`Looking for **${actualUsername}** in **${FAME_GAME_NAME}**\nScanning public servers...`)
      .setColor(0x5865F2)
      .setThumbnail(avatar);
    
    await interaction.editReply({ content: `<@${discordUserId}>`, embeds: [searching] });
    
    // STEP 5: Scan all servers to find the user
    const result = await findUserInServers(userId);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    
    if (!result.found) {
      const embed = new EmbedBuilder()
        .setTitle("Snipe Failed")
        .setDescription(`Could not locate **${actualUsername}** in **${FAME_GAME_NAME}**`)
        .addFields(
          { name: "Servers Scanned", value: `${result.scanned} servers`, inline: true },
          { name: "Time", value: `${elapsed} seconds`, inline: true },
          { name: "Reason", value: "User may be in a private/VIP server", inline: false }
        )
        .setColor(0xFF0000)
        .setThumbnail(avatar);
      await interaction.editReply({ content: `<@${discordUserId}>`, embeds: [embed] });
      return;
    }
    
    // STEP 6: SUCCESS - Found the user!
    const joinLink = `https://www.roblox.com/games/${FAME_GAME_ID}?jobId=${result.jobId}`;
    
    const embed = new EmbedBuilder()
      .setTitle("Player Found!")
      .setDescription(`Successfully found **${actualUsername}** in **${FAME_GAME_NAME}**`)
      .addFields(
        { name: "Server Status", value: `${result.players}/${result.maxPlayers} players`, inline: false },
        { name: "Search Time", value: `${elapsed} seconds`, inline: true },
        { name: "Method", value: "public_api", inline: true }
      )
      .setColor(0x00FF00)
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
    
    console.log(`[SNIPE] SUCCESS - Found ${actualUsername} in ${result.scanned} servers`);
    
  } catch (error) {
    console.error("Snipe error:", error);
    const errorEmbed = new EmbedBuilder()
      .setTitle("Error")
      .setDescription(error.message)
      .setColor(0xFF0000);
    
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
