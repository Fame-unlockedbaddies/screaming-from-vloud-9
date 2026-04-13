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

// ==================== KEEP-ALIVE SERVER FOR FREE RENDER ====================
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
      .setName("avatarhistory")
      .setDescription("View Roblox outfit history")
      .addStringOption(option =>
        option
          .setName("username")
          .setDescription("Roblox username")
          .setRequired(true)
      )
      .toJSON()
  ];

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

  try {
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );
    console.log("✅ Slash commands registered successfully");
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
    `https://avatar.roblox.com/v1/users/${userId}/outfits?limit=15&sortOrder=Asc`
  );
  const data = await res.json();
  return data.data || [];
}

// Reliable thumbnail function (best for free hosting)
async function getOutfitThumbnail(outfitId) {
  try {
    const res = await fetch(
      `https://thumbnails.roblox.com/v1/outfits?outfitIds=${outfitId}&size=420x420&format=Png&isCircular=false`
    );
    
    if (!res.ok) throw new Error("Thumbnail API failed");
    
    const data = await res.json();
    return data.data?.[0]?.imageUrl || null;
  } catch (err) {
    console.error(`Thumbnail error for outfit ${outfitId}:`, err.message);
    return null;
  }
}

// ==================== COMMAND HANDLER ====================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "avatarhistory") return;

  const username = interaction.options.getString("username");
  await interaction.deferReply({ ephemeral: false });

  try {
    const userId = await getUserId(username);
    if (!userId) return interaction.editReply("❌ Roblox user not found.");

    const outfits = await getOutfits(userId);
    if (!outfits.length) return interaction.editReply("❌ No outfits found for this user.");

    let page = 0;

    const makeEmbed = async (i) => {
      const outfit = outfits[i];
      const imageUrl = await getOutfitThumbnail(outfit.id);

      const embed = new EmbedBuilder()
        .setTitle(`${username}'s Outfits`)
        .setColor(0xff69b4)
        .setFooter({ 
          text: `Outfit ${i + 1} of ${outfits.length} • ${outfit.name}` 
        });

      if (imageUrl) {
        embed.setImage(imageUrl);
      } else {
        embed.setDescription("⚠️ Could not load the outfit image right now.");
      }

      return embed;
    };

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("back")
        .setLabel("◀ Back")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("next")
        .setLabel("Next ▶")
        .setStyle(ButtonStyle.Secondary)
    );

    // First message
    const initialEmbed = await makeEmbed(page);
    const msg = await interaction.editReply({
      embeds: [initialEmbed],
      components: [row]
    });

    const collector = msg.createMessageComponentCollector({
      time: 90000, // 1.5 minutes (good for free tier)
      filter: i => i.user.id === interaction.user.id
    });

    collector.on("collect", async (btn) => {
      if (btn.customId === "back") {
        page = page > 0 ? page - 1 : outfits.length - 1;
      } else if (btn.customId === "next") {
        page = page < outfits.length - 1 ? page + 1 : 0;
      }

      const newEmbed = await makeEmbed(page);
      await btn.update({
        embeds: [newEmbed],
        components: [row]
      });
    });

    collector.on("end", () => {
      msg.edit({ components: [] }).catch(() => {});
    });

  } catch (error) {
    console.error("Command error:", error);
    await interaction.editReply("❌ Something went wrong while fetching the outfits.").catch(() => {});
  }
});

// Login
client.login(process.env.TOKEN).catch(err => {
  console.error("❌ Failed to login:", err);
});
