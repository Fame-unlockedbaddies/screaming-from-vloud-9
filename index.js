const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  ApplicationIntegrationType,
  InteractionContextType,
  Partials
} = require("discord.js");

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
  partials: [Partials.Channel]
});

/* ---------------- REGISTER COMMAND ---------------- */

async function register() {
  const commands = [
    new SlashCommandBuilder()
      .setName("snipe")
      .setDescription("Check what Roblox game a user is currently playing")
      .addStringOption(opt =>
        opt.setName("username")
          .setDescription("Roblox username")
          .setRequired(true)
      )
      .setIntegrationTypes([
        ApplicationIntegrationType.GuildInstall,
        ApplicationIntegrationType.UserInstall
      ])
      .setContexts([
        InteractionContextType.Guild,
        InteractionContextType.BotDM,
        InteractionContextType.PrivateChannel
      ])
      .toJSON()
  ];

  const rest = new REST({ version: "10" }).setToken(TOKEN);

  await rest.put(
    Routes.applicationCommands(CLIENT_ID),
    { body: commands }
  );

  console.log("Commands registered");
}

/* ---------------- ROBLOX API ---------------- */

async function getUserId(username) {
  const res = await fetch("https://users.roblox.com/v1/usernames/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usernames: [username], excludeBannedUsers: true })
  });

  const data = await res.json();
  return data?.data?.[0]?.id || null;
}

async function getPresence(userId) {
  const res = await fetch("https://presence.roblox.com/v1/presence/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userIds: [userId] })
  });

  const data = await res.json();
  return data?.userPresences?.[0] || null;
}

async function getGame(universeId) {
  const res = await fetch(
    `https://games.roblox.com/v1/games?universeIds=${universeId}`
  );
  const data = await res.json();
  return data?.data?.[0];
}

/* ---------------- BOT ---------------- */

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await register();
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "snipe") {
    const username = interaction.options.getString("username");

    await interaction.reply("🔍 Checking Roblox presence...");

    const userId = await getUserId(username);
    if (!userId) {
      return interaction.editReply("❌ User not found.");
    }

    const presence = await getPresence(userId);

    if (!presence || presence.userPresenceType === 0) {
      return interaction.editReply("❌ User is currently offline.");
    }

    const game = await getGame(presence.universeId);

    const embed = new EmbedBuilder()
      .setTitle("🎮 Roblox Presence Found")
      .setDescription(`**${username}** is currently playing:`)
      .addFields(
        { name: "Game", value: game?.name || "Unknown", inline: true },
        { name: "Place ID", value: String(presence.placeId || "Unknown"), inline: true }
      )
      .setColor(0x00ff99);

    return interaction.editReply({ content: "", embeds: [embed] });
  }
});

client.login(TOKEN);
