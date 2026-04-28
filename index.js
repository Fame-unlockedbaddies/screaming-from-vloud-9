const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder
} = require("discord.js");

const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

// 🌐 Web server (required for Render Web Service)
app.get("/", (req, res) => {
  res.send("Bot is running!");
});

app.listen(PORT, () => {
  console.log(`Web server running on port ${PORT}`);
});

// 🔐 ENV VARIABLES
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID; // set this in Render too

// 🤖 Create bot
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: ["CHANNEL"]
});

// 🔑 Backup code (change this)
const BACKUP_CODE = "12345";

// 📌 Slash command definition
const commands = [
  new SlashCommandBuilder()
    .setName("findroleid")
    .setDescription("Get the ID of a role")
    .addRoleOption(option =>
      option.setName("role")
        .setDescription("Select a role")
        .setRequired(true)
    )
    .toJSON()
];

// 📡 Register slash command
const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  try {
    console.log("Registering slash command...");

    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );

    console.log("Slash command registered!");
  } catch (error) {
    console.error(error);
  }
})();

// ✅ Bot ready
client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// 💬 Message commands
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // 🔐 !backup command
  if (message.content === "!backup") {
    try {
      await message.author.send("📋 Backup Request\nPlease enter your backup code:");

      const filter = (m) => m.author.id === message.author.id;
      const dmChannel = await message.author.createDM();

      const collector = dmChannel.createMessageCollector({
        filter,
        time: 30000,
        max: 1
      });

      collector.on("collect", (msg) => {
        if (msg.content === BACKUP_CODE) {
          msg.reply("✅ Code correct! Backup process started.");
        } else {
          msg.reply("❌ Incorrect code. Access denied.");
        }
      });

      collector.on("end", (collected) => {
        if (collected.size === 0) {
          message.author.send("⌛ You didn’t enter a code in time.");
        }
      });

    } catch (err) {
      message.reply("❌ I couldn't DM you. Please enable DMs.");
    }
  }
});

// ⚡ Slash command handler
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "findroleid") {
    const role = interaction.options.getRole("role");
    await interaction.reply(`🆔 Role ID: \`${role.id}\``);
  }
});

// 🚀 Login
client.login(TOKEN);
