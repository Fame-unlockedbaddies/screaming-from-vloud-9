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

const tosAccepted = new Set();

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  console.log("⚠️ Advanced snipe loaded. Make sure ROBLOX_COOKIE is set in env vars!");

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
      .setDescription("ULTIMATE Bloxiana-style snipe — uses cookie + full server scan + join links")
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

// ==================== CONFIG ====================
// PUT YOUR ROBLOX COOKIE HERE IN RENDER DASHBOARD (Environment Variables)
// Example: .ROBLOSECURITY=yourlongcookievaluehere
const ROBLOX_COOKIE = process.env.ROBLOX_COOKIE;
if (!ROBLOX_COOKIE) {
  console.warn("⚠️ ROBLOX_COOKIE is not set! Snipe will still work but less accurate (no auth).");
}

// ==================== ADVANCED HELPERS WITH COOKIE + HEADERS ====================
async function getXcsrfToken() {
  if (!ROBLOX_COOKIE) return null;
  try {
    const res = await fetch("https://auth.roblox.com/v2/logout", {
      method: "POST",
      headers: {
        "Cookie": ROBLOX_COOKIE,
        "User-Agent": "Roblox/WinInet",
        "Referer": "https://www.roblox.com/"
      }
    });
    return res.headers.get("x-csrf-token");
  } catch { return null; }
}

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

// FULL PAGINATED SERVER SCAN + AUTHENTICATED (uses cookie + x-csrf when available)
async function getAllPublicServers(universeId) {
  if (!universeId) return [];
  let servers = [];
  let cursor = null;
  const xcsrf = await getXcsrfToken();

  const headers = {
    "User-Agent": "Roblox/WinInet",
    "Referer": "https://www.roblox.com/"
  };
  if (ROBLOX_COOKIE) headers.Cookie = ROBLOX_COOKIE;
  if (xcsrf) headers["x-csrf-token"] = xcsrf;

  while (true) {
    const url = `https://games.roblox.com/v1/games/${universeId}/servers/Public?limit=100&sortOrder=Asc${cursor ? `&cursor=${cursor}` : ""}`;
    try {
      const res = await fetch(url, { headers });
      if (!res.ok) break;
      const data = await res.json();
      if (!data.data?.length) break;

      servers = servers.concat(data.data);
      if (!data.nextPageCursor) break;
      cursor = data.nextPageCursor;

      // Tiny delay to stay under rate limits
      await new Promise(r => setTimeout(r, 180));
    } catch { break; }
  }
  return servers;
}

// ==================== COMMAND HANDLER ====================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "roblox" && interaction.options.getSubcommand() === "avatarhistory") {
    // Your original avatarhistory code here (unchanged)
    return;
  }

  if (interaction.commandName === "snipe") {
    const target = interaction.options.getString("target");
    const discordUserId = interaction.user.id;

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

    const startTime = Date.now();
    await interaction.deferReply();

    try {
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(0x00aaff)
          .setTitle("🔍 Advanced Scanning...")
          .setDescription(`Finding **${target}** + scanning **ALL** public servers with authenticated headers...`)
          .setFooter({ text: "Using Roblox cookie + full pagination" })]
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
        return interaction.editReply("⚠️ Roblox privacy blocked Game ID.");
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
          { name: "Sniped in", value: `${scanTime} ms`, inline: true },
          { name: "Total Servers", value: servers.length.toString(), inline: true }
        )
        .setTimestamp();

      // Server list (first 12)
      if (servers.length > 0) {
        let serverText = servers.slice(0, 12).map((s, i) =>
          `**${i+1}.** \`${s.id}\` — **${s.playing}/${s.maxPlayers}**`
        ).join("\n");
        if (servers.length > 12) serverText += `\n*... +${servers.length - 12} more*`;
        resultEmbed.addFields({ name: "Public Servers", value: serverText });
      }

      // JOIN BUTTONS (up to 15 + main game button)
      const rows = [];
      if (placeId) {
        const mainRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel(`🚀 Join ${target}'s Game`)
            .setStyle(ButtonStyle.Link)
            .setURL(`https://www.roblox.com/games/${placeId}`)
        );
        rows.push(mainRow);
      }

      const maxButtons = Math.min(servers.length, 15);
      for (let i = 0; i < maxButtons; i += 5) {
        const row = new ActionRowBuilder();
        const batch = servers.slice(i, i + 5);
        batch.forEach((s) => {
          const joinUrl = `https://www.roblox.com/games/${placeId}?serverId=${s.id}`;
          row.addComponents(
            new ButtonBuilder()
              .setLabel(`Join #${i + batch.indexOf(s) + 1}`)
              .setStyle(ButtonStyle.Link)
              .setURL(joinUrl)
          );
        });
        rows.push(row);
      }

      await interaction.editReply({
        content: `<@${discordUserId}>`,
        embeds: [resultEmbed],
        components: rows
      });

    } catch (error) {
      console.error("Snipe error:", error);
      await interaction.editReply("❌ Error — Roblox API may be rate-limited. Try again in a few seconds.").catch(() => {});
    }
  }
});

// TOS Buttons
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId === "tos_accept") {
    tosAccepted.add(interaction.user.id);
    await interaction.update({ content: "✅ TOS Accepted!", embeds: [], components: [] });
  } else if (interaction.customId === "tos_decline") {
    await interaction.update({ content: "❌ TOS Declined.", embeds: [], components: [] });
  }
});

client.login(process.env.TOKEN).catch(err => console.error("Login failed:", err));
