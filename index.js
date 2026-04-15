const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  Partials
} = require("discord.js");

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const PORT = process.env.PORT || 3000;

if (!TOKEN || !CLIENT_ID) {
  console.error("❌ Missing DISCORD_TOKEN or CLIENT_ID in environment variables");
  process.exit(1);
}

/* ---------------- KEEP ALIVE SERVER (Render) ---------------- */
const http = require("http");

http.createServer((req, res) => {
  res.writeHead(200);
  res.end("Bot is alive");
}).listen(PORT, () => {
  console.log("🌐 Web server running on port", PORT);
});

/* ---------------- DISCORD CLIENT ---------------- */

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
  partials: [Partials.Channel]
});

/* ---------------- REGISTER SLASH COMMANDS ---------------- */

async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName("snipe")
      .setDescription("Test command to confirm bot works")
      .addStringOption(option =>
        option
          .setName("username")
          .setDescription("Enter a username")
          .setRequired(true)
      )
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
    console.error("❌ Failed to register commands:", err);
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
      .setDescription(`You used /snipe with **${username}**`)
      .setColor(0x00ff99);

    return interaction.reply({ embeds: [embed] });
  }
});

/* ---------------- LOGIN ---------------- */

client.login(TOKEN);
