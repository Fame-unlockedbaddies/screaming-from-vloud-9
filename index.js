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

// Self-ping every 10 minutes to prevent Render free tier spin-down
// Set RENDER_URL env var to your Render URL e.g. https://your-bot.onrender.com
const RENDER_URL = process.env.RENDER_URL;
if (RENDER_URL) {
  setInterval(async () => {
    try {
      await fetch(RENDER_URL);
      console.log("✅ Self-ping sent");
    } catch (err) {
      console.error("❌ Self-ping failed:", err.message);
    }
  }, 10 * 60 * 1000);
} else {
  console.warn("⚠️ RENDER_URL not set — self-ping disabled. Set it to keep the bot alive.");
}

// ==================== DISCORD CLIENT ====================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.DirectMessages
  ]
});

const tosAccepted = new Set();
const pendingSnipe = new Map();

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  const commands = [
    new SlashCommandBuilder()
      .setName("roblox")
      .setDescription("Roblox utilities")
      .addSubcommand(sub =>
        sub.setName("avatarhistory")
          .setDescription("View full avatar history")
          .addStringOption(o =>
            o.setName("username").setDescription("Roblox username").setRequired(true)
          )
      )
      .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
      .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel)
      .toJSON(),

    new SlashCommandBuilder()
      .setName("snipe")
      .setDescription("Advanced snipe - works in DMs & Group Chats")
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
    console.log("✅ Commands registered (DM + Group Chat support)");
  } catch (error) {
    console.error("❌ Command registration failed:", error);
  }
});

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
    const res = await fetch("https://presence.roblox.com/v1/presence/users", {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "Roblox/WinInet" },
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

async function getAvatarHistory(userId) {
  try {
    const outfitsRes = await fetch(`https://avatar.roblox.com/v1/users/${userId}/outfits?page=1&itemsPerPage=25&isEditable=false`);
    const outfitsData = await outfitsRes.json();
    return outfitsData.data || [];
  } catch { return []; }
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

// ==================== SNIPE LOGIC ====================
async function runSnipe(interaction, target) {
  const startTime = Date.now();

  await interaction.deferReply();

  try {
    await interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(0x00aaff)
        .setTitle("🔍 Scanning...")
        .setDescription(`Finding **${target}** and scanning all public servers...`)]
    });

    const robloxId = await getUserId(target);
    if (!robloxId) {
      return interaction.editReply({ content: "❌ Roblox user not found.", embeds: [], components: [] });
    }

    const [avatarUrl, presence] = await Promise.all([
      getCurrentAvatar(robloxId),
      getUserPresence(robloxId)
    ]);

    // userPresenceType: 0 = offline, 1 = online, 2 = in-game, 3 = in Studio
    if (!presence || (presence.userPresenceType !== 2 && presence.userPresenceType !== 3)) {
      return interaction.editReply({
        content: `❌ **${target}** is not currently in a game.`,
        embeds: [],
        components: []
      });
    }

    const universeId = presence.universeId;
    const placeId = presence.placeId || presence.rootPlaceId;

    if (!universeId) {
      return interaction.editReply({
        content: "⚠️ Could not get Game ID — the user may have their game hidden.",
        embeds: [],
        components: []
      });
    }

    const [gameName, servers] = await Promise.all([
      getGameName(universeId),
      getAllPublicServers(universeId)
    ]);

    const scanTime = Date.now() - startTime;

    const resultEmbed = new EmbedBuilder()
      .setColor(0x00ff88)
      .setTitle("✅ Player Found")
      .setDescription(`**Search completed — ${servers.length} servers scanned!**\n\n**Game:** ${gameName}`)
      .addFields(
        { name: "⏱ Scan Time", value: `${scanTime}ms`, inline: true },
        { name: "🌐 Servers Scanned", value: `${servers.length}`, inline: true }
      )
      .setTimestamp();

    if (avatarUrl) resultEmbed.setImage(avatarUrl);

    const rows = [];

    if (placeId) {
      rows.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel(`🚀 Join ${target}'s Game`)
          .setStyle(ButtonStyle.Link)
          .setURL(`https://www.roblox.com/games/${placeId}`)
      ));
    }

    // Max 4 more rows = 20 server buttons
    const maxServers = Math.min(servers.length, 20);
    for (let i = 0; i < maxServers; i += 5) {
      const row = new ActionRowBuilder();
      servers.slice(i, i + 5).forEach((s, idx) => {
        row.addComponents(
          new ButtonBuilder()
            .setLabel(`Server ${i + idx + 1}`)
            .setStyle(ButtonStyle.Link)
            .setURL(`https://www.roblox.com/games/${placeId}?serverId=${s.id}`)
        );
      });
      rows.push(row);
    }

    await interaction.editReply({
      embeds: [resultEmbed],
      components: rows,
      allowedMentions: { users: [] }
    });

  } catch (error) {
    console.error("Snipe error:", error);
    await interaction.editReply({ content: "❌ Something went wrong. Please try again.", embeds: [], components: [] }).catch(() => {});
  }
}

// ==================== AVATAR HISTORY LOGIC ====================
async function runAvatarHistory(interaction, username) {
  await interaction.deferReply();

  try {
    const robloxId = await getUserId(username);
    if (!robloxId) {
      return interaction.editReply("❌ Roblox user not found.");
    }

    const [avatarUrl, outfits] = await Promise.all([
      getCurrentAvatar(robloxId),
      getAvatarHistory(robloxId)
    ]);

    const embed = new EmbedBuilder()
      .setColor(0x9b59b6)
      .setTitle(`🎭 Avatar Info — ${username}`)
      .setDescription(
        outfits.length > 0
          ? `Found **${outfits.length}** saved outfits.\n\n` +
            outfits.slice(0, 10).map((o, i) => `${i + 1}. ${o.name || "Unnamed Outfit"}`).join("\n")
          : "No public outfits found for this user."
      )
      .setTimestamp();

    if (avatarUrl) embed.setImage(avatarUrl);

    await interaction.editReply({
      embeds: [embed],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel("View Roblox Profile")
            .setStyle(ButtonStyle.Link)
            .setURL(`https://www.roblox.com/users/${robloxId}/profile`)
        )
      ]
    });

  } catch (error) {
    console.error("AvatarHistory error:", error);
    await interaction.editReply("❌ Something went wrong. Please try again.").catch(() => {});
  }
}

// ==================== UNIFIED INTERACTION HANDLER ====================
client.on("interactionCreate", async (interaction) => {

  // ── Slash Commands ──
  if (interaction.isChatInputCommand()) {

    if (interaction.commandName === "roblox" && interaction.options.getSubcommand() === "avatarhistory") {
      const username = interaction.options.getString("username");
      return runAvatarHistory(interaction, username);
    }

    if (interaction.commandName === "snipe") {
      const target = interaction.options.getString("target");
      const userId = interaction.user.id;

      if (!tosAccepted.has(userId)) {
        pendingSnipe.set(userId, target);

        const tosEmbed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle("📋 Terms of Service — Snipe Command")
          .setDescription(
            "Before using `/snipe`, please read and accept our Terms of Service.\n\n" +
            "**By accepting you agree to:**\n" +
            "• Use this for educational/entertainment purposes only\n" +
            "• Not harass or harm other players\n" +
            "• Respect the privacy of others\n" +
            "• Accept that misuse may result in a ban from this bot"
          );

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("tos_accept").setLabel("✅ Accept").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId("tos_decline").setLabel("❌ Decline").setStyle(ButtonStyle.Danger)
        );

        return interaction.reply({ embeds: [tosEmbed], components: [row], ephemeral: true });
      }

      return runSnipe(interaction, target);
    }
  }

  // ── Button Interactions ──
  if (interaction.isButton()) {
    if (interaction.customId === "tos_accept") {
      const userId = interaction.user.id;
      tosAccepted.add(userId);

      const pending = pendingSnipe.get(userId);
      pendingSnipe.delete(userId);

      await interaction.update({
        content: `✅ TOS Accepted! Now run \`/snipe target:${pending ?? "username"}\` and it will work immediately.`,
        embeds: [],
        components: []
      });

    } else if (interaction.customId === "tos_decline") {
      pendingSnipe.delete(interaction.user.id);
      await interaction.update({
        content: "❌ TOS Declined. You cannot use `/snipe` without accepting.",
        embeds: [],
        components: []
      });
    }
  }
});

// ==================== LOGIN ====================
client.login(process.env.TOKEN).catch(err => console.error("❌ Login failed:", err));
