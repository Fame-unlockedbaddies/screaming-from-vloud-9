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

// In-memory TOS accepted users (resets on restart)
const tosAccepted = new Set();

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  const commands = [
    // Your roblox avatarhistory command (keep as before)
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
      .setDescription("Fast auto snipe — finds game & public servers")
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

// ==================== FAST HELPER FUNCTIONS ====================
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

  try {
    const res = await fetch("https://presence.roblox.com/v1/presence/users", {
      method: "POST",
      headers,
      body: JSON.stringify({ userIds: [parseInt(userId)] })
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.userPresences?.[0] || null;
  } catch {
    return null;
  }
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

// ==================== TOS + SNIPE COMMAND (FAST VERSION) ====================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "roblox" && interaction.options.getSubcommand() === "avatarhistory") {
    // Your original avatarhistory code here
    return;
  }

  if (interaction.commandName === "snipe") {
    const target = interaction.options.getString("target");
    const discordUserId = interaction.user.id;

    // TOS Check
    if (!tosAccepted.has(discordUserId)) {
      const tosEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle("Terms of Service - Snipe Command")
        .setDescription(
          "Before using the snipe command, please read and accept our Terms of Service.\n\n" +
          "**Important:**\n" +
          "• This command is for educational and entertainment purposes only\n" +
          "• Do not use this command to harass or harm other users\n" +
          "• Respect other players' privacy and boundaries\n" +
          "• Misuse may result in a ban\n\n" +
          "By clicking **Accept**, you agree to use this command responsibly."
        );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("tos_accept").setLabel("Accept").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("tos_decline").setLabel("Decline").setStyle(ButtonStyle.Danger)
      );

      return interaction.reply({ embeds: [tosEmbed], components: [row] });
    }

    // === FAST SNIPE STARTS HERE ===
    const startTime = Date.now();
    await interaction.deferReply();

    try {
      // Quick initial message so Discord doesn't show "thinking..." for long
      const scanningEmbed = new EmbedBuilder()
        .setColor(0x00aaff)
        .setTitle("Scanning...")
        .setDescription(`Finding **${target}** and their current game...`)
        .setFooter({ text: "This should be quick" });

      await interaction.editReply({ embeds: [scanningEmbed] });

      // Run everything in parallel for maximum speed
      const robloxId = await getUserId(target);
      if (!robloxId) {
        return interaction.editReply("❌ Roblox user not found.");
      }

      const [avatarUrl, presence] = await Promise.all([
        getCurrentAvatar(robloxId),
        getUserPresence(robloxId)
      ]);

      if (!presence || (presence.userPresenceType !== 2 && presence.userPresenceType !== 3)) {
        return interaction.editReply(`❌ **${target}** is not currently in a game.`);
      }

      const universeId = presence.universeId || presence.placeId || presence.rootPlaceId;
      if (!universeId) {
        return interaction.editReply(`⚠️ **${target}** is in a game but Roblox didn't return the Game ID (privacy limitation).`);
      }

      // Parallel: get game name + servers
      const [gameName, servers] = await Promise.all([
        getGameName(universeId),
        getPublicServers(universeId)
      ]);

      const scanTime = Date.now() - startTime;

      const resultEmbed = new EmbedBuilder()
        .setColor(0x00ff88)
        .setTitle("Player Found")
        .setDescription(
          `**Search completed, ${servers.length} servers scanned!**\n\n` +
          `**Game:** ${gameName}\n` +
          `**Last Location:** ${presence.lastLocation || "Unknown"}`
        )
        .setImage(avatarUrl || null)
        .addFields(
          { name: "Sniped in", value: `${scanTime} ms`, inline: true }
        )
        .setTimestamp();

      if (servers.length > 0) {
        let serverList = servers.slice(0, 8).map((s, i) =>
          `**${i+1}.** \`${s.id}\` — ${s.playing}/${s.maxPlayers} players`
        ).join("\n");
        resultEmbed.addFields({ name: "Public Servers", value: serverList || "None visible." });
      }

      // Final reply with ping
      await interaction.editReply({
        content: `<@${discordUserId}>`,
        embeds: [resultEmbed]
      });

    } catch (error) {
      console.error("Snipe error:", error);
      await interaction.editReply("❌ Something went wrong. Please try again.").catch(() => {});
    }
  }
});

// TOS Button Handler
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId === "tos_accept") {
    tosAccepted.add(interaction.user.id);
    await interaction.update({
      content: "✅ TOS Accepted! You can now use `/snipe`.",
      embeds: [], components: []
    });
  } else if (interaction.customId === "tos_decline") {
    await interaction.update({
      content: "❌ You declined the TOS. You cannot use `/snipe` until you accept.",
      embeds: [], components: []
    });
  }
});

client.login(process.env.TOKEN).catch(err => console.error("Login failed:", err));
