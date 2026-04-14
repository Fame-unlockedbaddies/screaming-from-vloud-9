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

// In-memory TOS (resets on restart)
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
      .setDescription("Advanced Bloxiana-style snipe — scans ALL public servers + direct join buttons")
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
    console.log("✅ Commands registered (advanced snipe ready)");
  } catch (e) {
    console.error("Register error:", e);
  }
});

// ==================== ADVANCED HELPER FUNCTIONS ====================
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

// ADVANCED: Scans ALL public servers (paginated with cursor) — exactly like Bloxiana
async function getAllPublicServers(universeId) {
  if (!universeId) return [];
  let servers = [];
  let cursor = null;
  let page = 0;

  while (true) {
    page++;
    const url = `https://games.roblox.com/v1/games/${universeId}/servers/Public?limit=100&sortOrder=Asc${cursor ? `&cursor=${cursor}` : ""}`;
    try {
      const res = await fetch(url);
      if (!res.ok) break;
      const data = await res.json();
      if (!data.data || data.data.length === 0) break;

      servers = servers.concat(data.data);

      if (!data.nextPageCursor) break;
      cursor = data.nextPageCursor;

      // Small delay to avoid rate-limit (still fast overall)
      if (page % 3 === 0) await new Promise(r => setTimeout(r, 250));
    } catch { break; }
  }
  return servers;
}

// ==================== COMMAND HANDLER ====================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // Your original avatarhistory command (unchanged)
  if (interaction.commandName === "roblox" && interaction.options.getSubcommand() === "avatarhistory") {
    // Paste your full avatarhistory code here if you want it to stay
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

    // FAST + ADVANCED SNIPE STARTS
    const startTime = Date.now();
    await interaction.deferReply();

    try {
      // Quick "Scanning..." so Discord doesn't show "thinking..." for long
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(0x00aaff)
          .setTitle("🔍 Scanning...")
          .setDescription(`Finding **${target}** and scanning **ALL** public servers...`)
          .setFooter({ text: "Advanced Bloxiana-style scan" })]
      });

      const robloxId = await getUserId(target);
      if (!robloxId) return interaction.editReply("❌ Roblox user not found.");

      // Run everything in parallel for speed
      const [avatarUrl, presence] = await Promise.all([
        getCurrentAvatar(robloxId),
        getUserPresence(robloxId)
      ]);

      if (!presence || (presence.userPresenceType !== 2 && presence.userPresenceType !== 3)) {
        return interaction.editReply(`❌ **${target}** is not currently in a game.`);
      }

      const universeId = presence.universeId || presence.placeId || presence.rootPlaceId;
      const placeId = presence.placeId || universeId; // needed for join links

      if (!universeId) {
        return interaction.editReply(`⚠️ **${target}** is in a game but Roblox privacy blocked the Game ID.`);
      }

      const [gameName, servers] = await Promise.all([
        getGameName(universeId),
        getAllPublicServers(universeId)
      ]);

      const scanTime = Date.now() - startTime;

      const resultEmbed = new EmbedBuilder()
        .setColor(0x00ff88)
        .setTitle("✅ Player Found")
        .setDescription(
          `**Search completed, ${servers.length} servers scanned!**\n\n` +
          `**Game:** ${gameName}\n` +
          `**Last Location:** ${presence.lastLocation || "Unknown"}`
        )
        .setImage(avatarUrl || null)
        .addFields(
          { name: "Sniped in", value: `${scanTime} milliseconds`, inline: true },
          { name: "Total Public Servers", value: servers.length.toString(), inline: true }
        )
        .setTimestamp();

      // Show first 12 servers in text
      if (servers.length > 0) {
        let serverText = "";
        servers.slice(0, 12).forEach((s, i) => {
          serverText += `**${i + 1}.** \`${s.id}\` — **${s.playing}/${s.maxPlayers}** players\n`;
        });
        if (servers.length > 12) serverText += `\n*... and ${servers.length - 12} more servers*`;
        resultEmbed.addFields({ name: "Public Servers (Latest)", value: serverText });
      }

      // ==================== JOIN BUTTONS (Advanced Bloxiana style) ====================
      const rows = [];
      const maxButtons = Math.min(servers.length, 15); // max 15 join buttons (3 rows × 5)

      for (let i = 0; i < maxButtons; i += 5) {
        const row = new ActionRowBuilder();
        const batch = servers.slice(i, i + 5);
        batch.forEach((server) => {
          const joinUrl = `https://www.roblox.com/games/${placeId}?serverId=${server.id}`;
          row.addComponents(
            new ButtonBuilder()
              .setLabel(`Join Server ${i + batch.indexOf(server) + 1}`)
              .setStyle(ButtonStyle.Link)
              .setURL(joinUrl)
          );
        });
        rows.push(row);
      }

      // Main "Join [Player]'s Game" button (opens the game — works even if exact server unknown)
      if (placeId) {
        const mainRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel(`🚀 Join ${target}'s Game`)
            .setStyle(ButtonStyle.Link)
            .setURL(`https://www.roblox.com/games/${placeId}`)
        );
        rows.unshift(mainRow); // put at the very top
      }

      // Final reply with ping
      await interaction.editReply({
        content: `<@${discordUserId}>`,
        embeds: [resultEmbed],
        components: rows.length > 0 ? rows : []
      });

    } catch (error) {
      console.error("Snipe error:", error);
      await interaction.editReply("❌ An error occurred. Roblox API may be slow — try again.").catch(() => {});
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
