const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits
} = require("discord.js");

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

if (!TOKEN || !CLIENT_ID) {
  console.error("Missing DISCORD_TOKEN or CLIENT_ID");
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

/* ---------------- REGISTER COMMAND ---------------- */

async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName("snipe")
      .setDescription("Test command (fix permissions first)")
      .addStringOption(option =>
        option.setName("username")
          .setDescription("Roblox username")
          .setRequired(true)
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.UseApplicationCommands)
      .toJSON()
  ];

  const rest = new REST({ version: "10" }).setToken(TOKEN);

  try {
    await rest.put(Routes.applicationCommands(CLIENT_ID), {
      body: commands,
    });

    console.log("Slash commands registered");
  } catch (err) {
    console.error("Failed to register commands:", err);
  }
}

/* ---------------- BOT READY ---------------- */

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
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
