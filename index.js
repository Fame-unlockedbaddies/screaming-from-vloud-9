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

const fetch = require("node-fetch");

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// ===== REGISTER SLASH COMMAND =====
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const commands = [
    new SlashCommandBuilder()
      .setName("avatarhistory")
      .setDescription("View a Roblox user's outfits")
      .addStringOption(option =>
        option.setName("username")
          .setDescription("Roblox username")
          .setRequired(true)
      )
      .toJSON()
  ];

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

  await rest.put(
    Routes.applicationCommands(client.user.id),
    { body: commands }
  );
});

// ===== ROBLOX HELPERS =====
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
    `https://avatar.roblox.com/v1/users/${userId}/outfits?limit=50&sortOrder=Asc`
  );

  const data = await res.json();
  return data.data || [];
}

// ===== COMMAND HANDLER =====
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName !== "avatarhistory") return;

  const username = interaction.options.getString("username");

  await interaction.reply("Loading outfits...");

  const userId = await getUserId(username);
  if (!userId) return interaction.editReply("User not found.");

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
      .setFooter({ text: `Outfit ${i + 1} / ${outfits.length}` });
  };

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("back")
      .setLabel("Back")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("next")
      .setLabel("Next")
      .setStyle(ButtonStyle.Secondary)
  );

  const msg = await interaction.editReply({
    embeds: [makeEmbed(page)],
    components: [row]
  });

  const collector = msg.createMessageComponentCollector({ time: 60000 });

  collector.on("collect", async (btn) => {
    if (btn.user.id !== interaction.user.id) return;

    if (btn.customId === "back") {
      page = page > 0 ? page - 1 : outfits.length - 1;
    }

    if (btn.customId === "next") {
      page = page < outfits.length - 1 ? page + 1 : 0;
    }

    await btn.update({
      embeds: [makeEmbed(page)],
      components: [row]
    });
  });
});

client.login(process.env.TOKEN);
