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
  ApplicationIntegrationType,
  InteractionContextType
} = require("discord.js");

const http = require("http");

// ==================== KEEP-ALIVE SERVER ====================
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Discord bot is alive! ✅");
});
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`✅ Keep-alive server running on port ${PORT}`));

// ==================== DISCORD CLIENT ====================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.DirectMessages
  ]
});

// In-memory TOS (resets when bot restarts)
const tosAccepted = new Set();

// ==================== ROBLOX COOKIE (Add in Render Environment Variables) ====================
const ROBLOX_COOKIE = process.env.ROBLOX_COOKIE || "";
if (ROBLOX_COOKIE) {
  console.log("✅ Roblox cookie loaded");
} else {
  console.log("⚠️ No ROBLOX_COOKIE set — running without authentication");
}

// ==================== HELPER FUNCTIONS ====================
async function getUserId(username) {
  try {
    const res = await fetch("https://users.roblox.com/v1/usernames/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usernames: [username] })
    });
    const data = await res.json();
    return data.data?.[0]?.id || null;
  } catch { return null; }
}

async function getUserPresence(userId) {
  try {
    const headers = {
      "Content-Type": "application/json",
      "User-Agent": "Roblox/WinInet"
    };
    if (ROBLOX_COOKIE) headers.Cookie = ROBLOX_COOKIE;

    const res = await fetch("https://presence.roblox.com/v1/presence/users", {
      method: "POST",
      headers,
      body: JSON.stringify({ userIds: [parseInt(userId)] })
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.userPresences?.[0] || null;
  } catch { return null; }
}

async function getGameName(universeId) {
  if (!universeId) return "Unknown Game";
  try {
    const res = await fetch(`https://games.roblox.com/v1/games?universeIds=${universeId}`);
    const data = await res.json();
    return data.data?.[0]?.name || `Game ${universeId}`;
  } catch { return `Game ${universeId}`; }
}

async function getCurrentAvatar(userId) {
  try {
    const res = await fetch(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${userId}&size=420x420&format=Png&isCircular=false`);
    const data = await res.json();
    return data.data?.[0]?.imageUrl || null;
  } catch { return null; }
}

async function getAllPublicServers(universeId) {
  if (!universeId) return [];
  let servers = [];
  let cursor = null;

  while (true) {
    const url = `https://games.roblox.com/v1/games/${universeId}/servers/Public?limit=100&sortOrder=Asc${cursor ? `&cursor=${cursor}` : ""}`;
    try {
      const res = await fetch(url);
      if (!res.ok) break;
      const data = await res.json();
      if (!data.data?.length) break;

      servers = servers.concat(data.data);
      if (!data.nextPageCursor) break;
      cursor = data.nextPageCursor;
      await new Promise(r => setTimeout(r, 200));
    } catch { break; }
  }
  return servers;
}

// ==================== READY EVENT & COMMAND REGISTRATION ====================
client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  const commands = [
    new SlashCommandBuilder()
      .setName("roblox")
      .setDescription("Roblox utilities")
      .addSubcommand(sub =>
        sub
          .setName("avatarhistory")
          .setDescription("View full avatar history")
          .addStringOption(o => o.setName("username").setDescription("Roblox username").setRequired(true))
      )
      .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
      .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel)
      .toJSON(),

    new SlashCommandBuilder()
      .setName("snipe")
      .setDescription("Advanced Bloxiana-style snipe (works in DMs & Group Chats)")
      .addStringOption(option =>
        option.setName("target").setDescription("Roblox username").setRequired(true)
      )
      .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
      .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel)
      .toJSON()
  ];

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
  try {
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    console.log("✅ Commands registered with full DM + Group Chat support");
  } catch (error) {
    console.error("❌ Command registration failed:", error);
  }
});

// ==================== INTERACTION HANDLER ====================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // TOS for snipe
  if (interaction.commandName === "snipe") {
    const target = interaction.options.getString("target");
    const userId = interaction.user.id;

    if (!tosAccepted.has(userId)) {
      const tosEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle("Terms of Service - Snipe Command")
        .setDescription(
          "Before using the snipe command, please read and accept our Terms of Service.\n\n" +
          "**Important:**\n" +
          "• Educational and entertainment purposes only\n" +
          "• Do not harass or harm others\n" +
          "• Respect privacy\n" +
          "• Misuse may result in a ban"
        );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("tos_accept").setLabel("Accept").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("tos_decline").setLabel("Decline").setStyle(ButtonStyle.Danger)
      );

      return interaction.reply({ embeds: [tosEmbed], components: [row] });
    }

    // ==================== ADVANCED SNIPE LOGIC ====================
    const startTime = Date.now();
    await interaction.deferReply();

    try {
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(0x00aaff)
          .setTitle("🔍 Advanced Scanning...")
          .setDescription(`Finding **${target}** and scanning all public servers...`)]
      });

      const robloxId = await getUserId(target);
      if (!robloxId) return interaction.editReply("❌ Roblox user not found.");

      const [avatarUrl, presence] = await Promise.all([
        getCurrentAvatar(robloxId),
        getUserPresence(robloxId)
      ]);

      if (!presence || (presence.userPresenceType !== 2 && presence.userPresenceType !== 3)) {
        return interaction.editReply(`❌ **${target}** is not currently in a game.`);
      }

      const universeId = presence.universeId || presence.placeId || presence.rootPlaceId;
      const placeId = presence.placeId || universeId;

      if (!universeId) {
        return interaction.editReply("⚠️ Could not get Game ID due to Roblox privacy.");
      }

      const [gameName, servers] = await Promise.all([
        getGameName(universeId),
        getAllPublicServers(universeId)
      ]);

      const scanTime = Date.now() - startTime;

      const resultEmbed = new EmbedBuilder()
        .setColor(0x00ff88)
        .setTitle("✅ Player Found")
        .setDescription(`**Search completed, ${servers.length} servers scanned!**\n\n**Game:** ${gameName}`)
        .setImage(avatarUrl || null)
        .addFields(
          { name: "Sniped in", value: `${scanTime} ms`, inline: true },
          { name: "Servers", value: servers.length.toString(), inline: true }
        )
        .setTimestamp();

      // Join buttons
      const rows = [];
      if (placeId) {
        rows.push(new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel(`🚀 Join ${target}'s Game`)
            .setStyle(ButtonStyle.Link)
            .setURL(`https://www.roblox.com/games/${placeId}`)
        ));
      }

      const maxBtns = Math.min(servers.length, 15);
      for (let i = 0; i < maxBtns; i += 5) {
        const row = new ActionRowBuilder();
        servers.slice(i, i + 5).forEach((s, idx) => {
          row.addComponents(
            new ButtonBuilder()
              .setLabel(`Join #${i + idx + 1}`)
              .setStyle(ButtonStyle.Link)
              .setURL(`https://www.roblox.com/games/${placeId}?serverId=${s.id}`)
          );
        });
        rows.push(row);
      }

      await interaction.editReply({
        content: `<@${userId}>`,
        embeds: [resultEmbed],
        components: rows
      });

    } catch (error) {
      console.error(error);
      await interaction.editReply("❌ Something went wrong. Please try again.").catch(() => {});
    }
  }
});

// TOS Button Handler
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId === "tos_accept") {
    tosAccepted.add(interaction.user.id);
    await interaction.update({ content: "✅ TOS Accepted! You can now use `/snipe`.", embeds: [], components: [] });
  } else if (interaction.customId === "tos_decline") {
    await interaction.update({ content: "❌ TOS Declined.", embeds: [], components: [] });
  }
});

client.login(process.env.TOKEN).catch(err => console.error("Login failed:", err));
