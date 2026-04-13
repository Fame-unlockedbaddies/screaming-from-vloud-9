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

// ==================== KEEP-ALIVE SERVER FOR RENDER ====================
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Discord bot is alive! ✅");
});

const PORT = process.env.PORT || 10000;   // Render often uses 10000
server.listen(PORT, () => {
  console.log(`Keep-alive server running on port ${PORT}`);
});

// ==================== DISCORD CLIENT ====================
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  // Register slash commands
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

// ==================== COMMAND HANDLER ====================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "avatarhistory") return;

  const username = interaction.options.getString("username");
  await interaction.deferReply();

  const userId = await getUserId(username);
  if (!userId) return interaction.editReply("User not found on Roblox.");

  const outfits = await getOutfits(userId);
  if (!outfits.length) return interaction.editReply("No outfits found.");

  let page = 0;

  const makeEmbed = (i) => {
    const outfit = outfits[i];
    const imageUrl = `https://www.roblox.com/outfit-thumbnail/image?outfitId=${outfit.id}&width=420&height=420&format=png`;

    return new EmbedBuilder()
      .setTitle(`${username}'s Outfits`)
      .setImage(imageUrl)
      .setColor(0xff69b4)
      .setFooter({ text: `Outfit ${i + 1} of ${outfits.length}` });
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

  const msg = await interaction.editReply({
    embeds: [makeEmbed(page)],
    components: [row]
  });

  const collector = msg.createMessageComponentCollector({ time: 60000 });

  collector.on("collect", async (btn) => {
    if (btn.user.id !== interaction.user.id) return;

    if (btn.customId === "back") page = page > 0 ? page - 1 : outfits.length - 1;
    if (btn.customId === "next") page = page < outfits.length - 1 ? page + 1 : 0;

    await btn.update({
      embeds: [makeEmbed(page)],
      components: [row]
    });
  });

  collector.on("end", () => {
    msg.edit({ components: [] }).catch(() => {});
  });
});

// Login
client.login(process.env.TOKEN).catch(err => {
  console.error("❌ Failed to login:", err);
});
