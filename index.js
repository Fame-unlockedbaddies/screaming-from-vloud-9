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
    // Existing roblox command (unchanged)
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

    // NEW /snipe command (like Bloxiana + auto-detect)
    new SlashCommandBuilder()
      .setName("snipe")
      .setDescription("Snipe a player → finds their current game + public servers (like Bloxiana)")
      .addStringOption(option =>
        option
          .setName("target")
          .setDescription("Roblox username of the player")
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName("game")
          .setDescription("Game ID (e.g. 121157515767845 for Fame) — leave blank to AUTO-DETECT their current game")
          .setRequired(false)
      )
      .toJSON()
  ];

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
  try {
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    console.log("✅ Slash commands registered (including /snipe with Fame support)");
  } catch (error) {
    console.error("❌ Failed to register commands:", error);
  }
});

// ==================== ROBLOX HELPER FUNCTIONS ====================
async function getUserId(username) {
  const res = await fetch("https://users.roblox.com/v1/usernames/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usernames: [username] })
  });
  const data = await res.json();
  return data.data?.[0]?.id;
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
    if (!presence || presence.userPresenceType !== 2) return null; // 2 = In Game
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
    console.error("Servers API error:", e.message);
    return [];
  }
}

// ==================== COMMAND HANDLER ====================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // ==================== EXISTING ROBLOX AVATARHISTORY ====================
  if (interaction.commandName === "roblox" && interaction.options.getSubcommand() === "avatarhistory") {
    // ... (your original avatarhistory code — unchanged) ...
    const username = interaction.options.getString("username");
    await interaction.deferReply();
    try {
      const userId = await getUserId(username);
      if (!userId) return interaction.editReply("❌ Roblox user not found.");
      const [outfits, currentImage] = await Promise.all([
        getOutfits(userId),
        getCurrentAvatarThumbnail(userId)
      ]);
      const savedCount = outfits.length;
      if (savedCount === 0 && !currentImage) {
        return interaction.editReply(`❌ No avatar data found for **${username}**.`);
      }
      let page = 0;
      const totalPages = savedCount + 1;
      const makeEmbed = async (p) => {
        const embed = new EmbedBuilder().setColor(0xff69b4).setTimestamp();
        if (p === 0) {
          embed
            .setTitle(`${username}'s Current Avatar`)
            .setDescription("Currently equipped avatar on Roblox.")
            .setFooter({ text: `Page 1 of ${totalPages} • ${savedCount} saved outfit${savedCount === 1 ? '' : 's'}` });
          if (currentImage) embed.setImage(currentImage);
        } else {
          const idx = p - 1;
          const outfit = outfits[idx];
          const imageUrl = await getOutfitThumbnail(outfit.id);
          embed
            .setTitle(`${username}'s Saved Outfits`)
            .setDescription(`**Outfit Name:** ${outfit.name}`)
            .setFooter({ text: `Outfit ${idx + 1} of ${savedCount} • Page ${p} of ${totalPages}` })
            .setImage(imageUrl);
        }
        return embed;
      };
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("back").setLabel("◀ Previous").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("next").setLabel("Next ▶").setStyle(ButtonStyle.Secondary)
      );
      const initialEmbed = await makeEmbed(page);
      const msg = await interaction.editReply({ embeds: [initialEmbed], components: [row] });
      const collector = msg.createMessageComponentCollector({ time: 180000, filter: i => i.user.id === interaction.user.id });
      collector.on("collect", async (btn) => {
        if (btn.customId === "back") page = page > 0 ? page - 1 : totalPages - 1;
        else if (btn.customId === "next") page = page < totalPages - 1 ? page + 1 : 0;
        const newEmbed = await makeEmbed(page);
        await btn.update({ embeds: [newEmbed], components: [row] });
      });
      collector.on("end", () => msg.edit({ components: [] }).catch(() => {}));
    } catch (error) {
      console.error("Command error:", error);
      interaction.editReply("❌ Something went wrong.").catch(() => {});
    }
    return;
  }

  // ==================== NEW SNIPE COMMAND (Bloxiana-style + auto-detect) ====================
  if (interaction.commandName === "snipe") {
    const target = interaction.options.getString("target");
    let gameId = interaction.options.getString("game"); // may be undefined

    await interaction.deferReply();

    try {
      const userId = await getUserId(target);
      if (!userId) {
        return interaction.editReply("❌ Roblox user not found.");
      }

      let universeId = null;
      let gameName = null;

      // Auto-detect if no game ID provided (exactly what you asked for)
      if (!gameId) {
        const presence = await getUserPresence(userId);
        if (!presence) {
          return interaction.editReply(`❌ **${target}** is not in any game right now (or their presence is hidden).`);
        }
        universeId = presence.universeId || presence.placeId;
        gameName = presence.gameName;
      } 
      // Manual game ID provided (like Bloxiana)
      else {
        universeId = gameId;
        gameName = await getGameName(universeId);
      }

      // Fetch public servers in that game
      const servers = await getPublicServers(universeId);

      const embed = new EmbedBuilder()
        .setColor(0x00ff88)
        .setTitle(`🔍 Snipe Result — ${target}`)
        .setDescription(`**Game:** ${gameName}\n**Game ID:** ${universeId}\n\nScanning public servers...`)
        .setTimestamp();

      if (servers.length === 0) {
        embed.setColor(0xff0000).setDescription(`**Game:** ${gameName}\n**Game ID:** ${universeId}\n\n❌ No public servers found. The game may be private or empty.`);
        return interaction.editReply({ embeds: [embed] });
      }

      // Build server list (region not available in public API)
      let serverList = "**Public Servers Found:**\n\n";
      servers.slice(0, 15).forEach((server, i) => {  // limit to 15 for clean embed
        serverList += `**${i + 1}.** Server ID: \`${server.id}\`\n` +
                      `Players: **${server.playing}/${server.maxPlayers}**\n\n`;
      });

      if (servers.length > 15) serverList += `*... and ${servers.length - 15} more servers*`;

      embed.setDescription(
        `**Game:** ${gameName}\n` +
        `**Game ID:** ${universeId}\n\n` +
        serverList +
        `\n> ⚠️ Roblox privacy update (2025) limits player visibility. Exact server of **${target}** can't always be confirmed, but these are all current public servers.`
      )
      .setFooter({ text: "Use a Roblox server joiner tool with the Server ID above" });

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error("Snipe error:", error);
      await interaction.editReply("❌ Something went wrong while sniping.").catch(() => {});
    }
  }
});

client.login(process.env.TOKEN).catch(err => console.error("Login failed:", err));
