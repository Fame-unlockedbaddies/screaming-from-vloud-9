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
server.listen(PORT, () => {
  console.log(`✅ Keep-alive server running on port ${PORT}`);
});

// ==================== DISCORD CLIENT ====================
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  const commands = [
    // Your existing roblox avatarhistory command (unchanged)
    new SlashCommandBuilder()
      .setName("roblox")
      .setDescription("Roblox utilities")
      .addSubcommand(sub =>
        sub
          .setName("avatarhistory")
          .setDescription("View full avatar history with all outfit images")
          .addStringOption(option =>
            option.setName("username").setDescription("Roblox username").setRequired(true)
          )
      )
      .toJSON(),

    // Updated /snipe — only needs username (auto-detects game)
    new SlashCommandBuilder()
      .setName("snipe")
      .setDescription("Snipe a player — auto finds their game and lists public servers")
      .addStringOption(option =>
        option
          .setName("target")
          .setDescription("Roblox username of the player")
          .setRequired(true)
      )
      .toJSON()
  ];

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
  try {
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    console.log("✅ Slash commands registered (/snipe now auto-detects game)");
  } catch (error) {
    console.error("❌ Failed to register commands:", error);
  }
});

// ==================== ROBLOX HELPER FUNCTIONS ====================
async function getUserId(username) {
  try {
    const res = await fetch("https://users.roblox.com/v1/usernames/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usernames: [username] })
    });
    const data = await res.json();
    return data.data?.[0]?.id;
  } catch {
    return null;
  }
}

async function getUserPresence(userId) {
  try {
    const res = await fetch("https://presence.roblox.com/v1/presence/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userIds: [parseInt(userId)] })
    });
    if (!res.ok) return null;
    const data = await res.json();
    const presence = data.userPresences?.[0];
    if (!presence || presence.userPresenceType !== 2) return null; // 2 = In-Game
    return {
      universeId: presence.universeId,
      placeId: presence.placeId,
      gameName: presence.lastLocation || "Unknown Game",
    };
  } catch (e) {
    console.error("Presence error:", e.message);
    return null;
  }
}

async function getGameName(universeId) {
  try {
    const res = await fetch(`https://games.roblox.com/v1/games?universeIds=${universeId}`);
    const data = await res.json();
    return data.data?.[0]?.name || `Game ${universeId}`;
  } catch {
    return `Game ${universeId}`;
  }
}

async function getPublicServers(universeId) {
  try {
    const res = await fetch(
      `https://games.roblox.com/v1/games/${universeId}/servers/Public?limit=100&sortOrder=Asc`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.data || [];
  } catch (e) {
    console.error("Servers fetch error:", e.message);
    return [];
  }
}

// ==================== COMMAND HANDLER ====================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // Existing avatarhistory command (kept as-is)
  if (interaction.commandName === "roblox" && interaction.options.getSubcommand() === "avatarhistory") {
    // ... paste your original avatarhistory code here (unchanged) ...
    return;
  }

  // ==================== SNIPE COMMAND (Auto-detect only) ====================
  if (interaction.commandName === "snipe") {
    const target = interaction.options.getString("target");

    await interaction.deferReply();

    try {
      const userId = await getUserId(target);
      if (!userId) {
        return interaction.editReply("❌ Roblox user not found.");
      }

      const presence = await getUserPresence(userId);
      if (!presence) {
        return interaction.editReply(`❌ **${target}** is not currently in any game (or their presence is hidden).`);
      }

      const universeId = presence.universeId || presence.placeId;
      const gameName = await getGameName(universeId);

      const servers = await getPublicServers(universeId);

      const embed = new EmbedBuilder()
        .setColor(0x00ff88)
        .setTitle(`🔍 Snipe — ${target}`)
        .setDescription(`**Currently Playing:** ${gameName}\n**Game ID:** ${universeId}`)
        .setTimestamp();

      if (servers.length === 0) {
        embed.setColor(0xffaa00)
             .setDescription(`**Currently Playing:** ${gameName}\n**Game ID:** ${universeId}\n\n❌ No public servers found at the moment.`);
        return interaction.editReply({ embeds: [embed] });
      }

      let serverList = "**Public Servers:**\n\n";
      servers.slice(0, 12).forEach((s, i) => {
        serverList += `**${i+1}.** \`Server ID: ${s.id}\`\n` +
                      `Players: **${s.playing} / ${s.maxPlayers}**\n\n`;
      });

      if (servers.length > 12) {
        serverList += `*... and ${servers.length - 12} more servers*`;
      }

      embed.setDescription(
        `**Currently Playing:** ${gameName}\n` +
        `**Game ID:** ${universeId}\n\n` +
        serverList +
        `\n> ⚠️ **Region Information**: Roblox no longer exposes server region (US-East, EU, etc.) publicly. You can try joining the servers above using a Roblox server joiner tool.`
      )
      .setFooter({ text: "Auto-detected game • Limited by Roblox privacy changes" });

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error("Snipe error:", error);
      await interaction.editReply("❌ Something went wrong while trying to snipe.").catch(() => {});
    }
  }
});

client.login(process.env.TOKEN).catch(err => console.error("Login failed:", err));
