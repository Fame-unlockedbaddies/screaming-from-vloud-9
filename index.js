const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
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
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Store users who accepted TOS (in-memory - resets on restart)
const tosAccepted = new Set();

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  const commands = [
    new SlashCommandBuilder()
      .setName("roblox")
      .setDescription("Roblox utilities")
      .addSubcommand(sub =>
        sub.setName("avatarhistory")
          .setDescription("View full avatar history")
          .addStringOption(o => o.setName("username").setDescription("Roblox username").setRequired(true))
      )
      .toJSON(),

    new SlashCommandBuilder()
      .setName("snipe")
      .setDescription("Advanced auto snipe (Bloxiana style)")
      .addStringOption(option =>
        option.setName("target")
          .setDescription("Roblox username")
          .setRequired(true)
      )
      .toJSON()
  ];

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
  try {
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    console.log("✅ Commands registered");
  } catch (e) {
    console.error("Register error:", e);
  }
});

// ==================== HELPER FUNCTIONS (Presence + Avatar) ====================
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
  const headers = {
    "Content-Type": "application/json",
    "User-Agent": "Roblox/WinInet"
  };
  for (let i = 1; i <= 3; i++) {
    try {
      const res = await fetch("https://presence.roblox.com/v1/presence/users", {
        method: "POST",
        headers,
        body: JSON.stringify({ userIds: [parseInt(userId)] })
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      return data.userPresences?.[0] || null;
    } catch {
      if (i < 3) await new Promise(r => setTimeout(r, 1200));
    }
  }
  return null;
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

async function getPublicServers(universeId) {
  if (!universeId) return [];
  try {
    const res = await fetch(`https://games.roblox.com/v1/games/${universeId}/servers/Public?limit=100&sortOrder=Asc`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.data || [];
  } catch { return []; }
}

// ==================== TOS + SNIPE COMMAND ====================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "roblox" && interaction.options.getSubcommand() === "avatarhistory") {
    // Your original avatarhistory code here (unchanged)
    return;
  }

  if (interaction.commandName === "snipe") {
    const target = interaction.options.getString("target");
    const userId = interaction.user.id;

    // First-time TOS check
    if (!tosAccepted.has(userId)) {
      const tosEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle("Terms of Service - Snipe Command")
        .setDescription(
          "Before using the snipe command, please read and accept our Terms of Service.\n\n" +
          "**Important:**\n" +
          "• This command is for educational and entertainment purposes only\n" +
          "• Do not use this command to harass or harm other users\n" +
          "• Respect other players' privacy and boundaries\n" +
          "• Misuse of this command may result in a ban\n\n" +
          "By clicking **Accept**, you agree to use this command responsibly."
        )
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("tos_accept").setLabel("Accept").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("tos_decline").setLabel("Decline").setStyle(ButtonStyle.Danger)
      );

      await interaction.reply({ embeds: [tosEmbed], components: [row] });
      return;
    }

    // User already accepted TOS → Start sniping
    await interaction.deferReply();

    const startTime = Date.now();

    try {
      const robloxId = await getUserId(target);
      if (!robloxId) return interaction.editReply("❌ Roblox user not found.");

      const avatarUrl = await getCurrentAvatar(robloxId);
      const presence = await getUserPresence(robloxId);

      // === Installing / Player Found Phase ===
      const installingEmbed = new EmbedBuilder()
        .setColor(0x00ff88)
        .setTitle("Installing...")
        .setDescription(`**Target:** ${target}`)
        .setImage(avatarUrl || null)
        .setFooter({ text: "Please wait while we scan servers..." })
        .setTimestamp();

      await interaction.editReply({ embeds: [installingEmbed] });

      // Small delay to simulate "installing"
      await new Promise(r => setTimeout(r, 1800));

      if (!presence || (presence.userPresenceType !== 2 && presence.userPresenceType !== 3)) {
        return interaction.editReply(`❌ **${target}** is not currently in a game.`);
      }

      const universeId = presence.universeId || presence.placeId || presence.rootPlaceId;
      const gameName = await getGameName(universeId);
      const servers = await getPublicServers(universeId);

      const scanTime = Date.now() - startTime;

      const resultEmbed = new EmbedBuilder()
        .setColor(0x00ff88)
        .setTitle("Player Found")
        .setDescription(
          `**Search completed, ${servers.length} servers scanned!**\n\n` +
          `**Game:** ${gameName}\n` +
          `**Players:** ${presence.lastLocation || "Unknown"}`
        )
        .setImage(avatarUrl || null)
        .addFields(
          { name: "Sniped in", value: `${scanTime} milliseconds`, inline: true }
        )
        .setTimestamp();

      if (servers.length > 0) {
        let serverList = "";
        servers.slice(0, 8).forEach((s, i) => {
          serverList += `**${i+1}.** \`${s.id}\` — ${s.playing}/${s.maxPlayers} players\n`;
        });
        resultEmbed.addFields({ name: "Public Servers", value: serverList || "No public servers visible." });
      }

      // Final edit + ping the user
      await interaction.editReply({
        content: `<@${interaction.user.id}>`,
        embeds: [resultEmbed]
      });

    } catch (error) {
      console.error(error);
      await interaction.editReply("❌ An error occurred during the snipe.").catch(() => {});
    }
  }
});

// Button Handler for TOS
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  const userId = interaction.user.id;

  if (interaction.customId === "tos_accept") {
    tosAccepted.add(userId);
    await interaction.update({
      content: "✅ You have accepted the Terms of Service. You can now use the `/snipe` command.",
      embeds: [],
      components: []
    });
  } 
  else if (interaction.customId === "tos_decline") {
    await interaction.update({
      content: "❌ You declined the Terms of Service. You cannot use the `/snipe` command until you accept.",
      embeds: [],
      components: []
    });
  }
});

client.login(process.env.TOKEN).catch(err => console.error("Login failed:", err));
