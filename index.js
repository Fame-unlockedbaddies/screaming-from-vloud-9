const http = require("http");
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

/* ---------------- ENV ---------------- */
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const PORT = process.env.PORT || 3000;

if (!TOKEN || !CLIENT_ID) {
  console.error("❌ Missing TOKEN or CLIENT_ID");
  process.exit(1);
}

/* ---------------- KEEP ALIVE SERVER (REQUIRED FOR RENDER) ---------------- */
http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Bot is running");
}).listen(PORT, () => {
  console.log("🌐 Listening on port", PORT);
});

/* ---------------- DISCORD CLIENT ---------------- */
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
  partials: [Partials.Channel],
});

/* ---------------- REGISTER SLASH COMMANDS (GLOBAL + DM + GROUPS) ---------------- */
async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName("snipe")
      .setDescription("Check a Roblox user status (safe version)")
      .addStringOption(option =>
        option.setName("username")
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

  try {
    console.log("🔄 Registering slash commands...");

    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commands }
    );

    console.log("✅ Slash commands registered");
  } catch (err) {
    console.error("❌ Command registration failed:", err);
  }
}

/* ---------------- READY ---------------- */
client.once("ready", async () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
  await registerCommands();
});

/* ---------------- COMMAND HANDLER ---------------- */
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "snipe") {
    const username = interaction.options.getString("username");

    const embed = new EmbedBuilder()
      .setTitle("✅ Bot Working")
      .setDescription(`You used /snipe on **${username}**`)
      .setColor(0x00ff99);

    return interaction.reply({ embeds: [embed] });
  }
});

/* ---------------- LOGIN ---------------- */
client.login(TOKEN);
