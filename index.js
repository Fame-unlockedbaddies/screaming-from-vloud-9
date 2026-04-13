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
      .toJSON()
  ];

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

  try {
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    console.log("✅ Slash commands registered");
  } catch (error) {
    console.error("❌ Failed to register commands:", error);
  }
});

// ==================== ROBLOX FUNCTIONS ====================
async function getUserId(username) {
  const res = await fetch("https://users.roblox.com/v1/usernames/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usernames: [username] })
  });
  const data = await res.json();
  return data.data?.[0]?.id;
}

async function getOutfits(userId) {
  const res = await fetch(
    `https://avatar.roblox.com/v1/users/${userId}/outfits?limit=30&sortOrder=Asc`
  );
  const data = await res.json();
  return data.data || [];
}

async function getCurrentAvatarThumbnail(userId) {
  try {
    const res = await fetch(
      `https://thumbnails.roblox.com/v1/users/avatar?userIds=${userId}&size=420x420&format=Png&isCircular=false`
    );
    const data = await res.json();
    return data.data?.[0]?.imageUrl || null;
  } catch (e) {
    console.error("Current avatar error:", e.message);
    return null;
  }
}

// Improved thumbnail function - tries multiple methods
async function getOutfitThumbnail(outfitId) {
  console.log(`Fetching thumbnail for outfit ${outfitId}...`);

  const modernUrl = `https://thumbnails.roblox.com/v1/outfits?outfitIds=${outfitId}&size=420x420&format=Png&isCircular=false`;

  // Try modern API up to 3 times
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(modernUrl);
      if (res.ok) {
        const data = await res.json();
        const imageUrl = data.data?.[0]?.imageUrl;
        if (imageUrl && !imageUrl.includes("pending")) {
          console.log(`✅ Success with modern API for outfit ${outfitId}`);
          return imageUrl;
        }
      }
    } catch (e) {
      // silent on retry
    }
    if (attempt < 3) await new Promise(r => setTimeout(r, 1200));
  }

  // Fallback 1: Old direct outfit thumbnail (still works for many outfits)
  const fallback1 = `https://www.roblox.com/outfit-thumbnail/image?outfitId=${outfitId}&width=420&height=420&format=png`;
  console.log(`⚠️ Using fallback 1 (old endpoint) for outfit ${outfitId}`);
  return fallback1;
}

// ==================== COMMAND HANDLER ====================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "roblox" || interaction.options.getSubcommand() !== "avatarhistory") return;

  const username = interaction.options.getString("username");
  await interaction.deferReply();

  try {
    const userId = await getUserId(username);
    if (!userId) return interaction.editReply("❌ Roblox user not found.");

    const [outfits, currentImage] = await Promise.all([
      getOutfits(userId),
      getCurrentAvatarThumbnail(userId)
    ]);

    if (outfits.length === 0 && !currentImage) {
      return interaction.editReply("❌ No avatar data found.");
    }

    let page = 0;
    const totalPages = outfits.length + 1;

    const makeEmbed = async (p) => {
      const embed = new EmbedBuilder()
        .setColor(0xff69b4)
        .setTimestamp();

      if (p === 0) {
        embed
          .setTitle(`${username}'s Current Avatar`)
          .setDescription("Currently equipped avatar.")
          .setFooter({ text: `Page 1 of ${totalPages}` });

        if (currentImage) embed.setImage(currentImage);
        else embed.setDescription("⚠️ Could not load current avatar.");
      } else {
        const idx = p - 1;
        const outfit = outfits[idx];
        const imageUrl = await getOutfitThumbnail(outfit.id);

        embed
          .setTitle(`${username}'s Saved Outfits`)
          .setDescription(`**Outfit Name:** ${outfit.name}`)
          .setFooter({ 
            text: `Outfit ${idx + 1} of ${outfits.length} • Page ${p + 1} of ${totalPages}` 
          })
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

    const collector = msg.createMessageComponentCollector({
      time: 180000,
      filter: i => i.user.id === interaction.user.id
    });

    collector.on("collect", async (btn) => {
      if (btn.customId === "back") page = page > 0 ? page - 1 : totalPages - 1;
      else if (btn.customId === "next") page = page < totalPages - 1 ? page + 1 : 0;

      const newEmbed = await makeEmbed(page);
      await btn.update({ embeds: [newEmbed], components: [row] });
    });

    collector.on("end", () => msg.edit({ components: [] }).catch(() => {}));

  } catch (error) {
    console.error("Command error:", error);
    interaction.editReply("❌ Error fetching avatar history.").catch(() => {});
  }
});

client.login(process.env.TOKEN).catch(err => console.error("Login failed:", err));
