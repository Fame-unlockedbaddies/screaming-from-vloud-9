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
    // Existing roblox command
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
      .toJSON(),

    // New /snipe command (like Bloxiana)
    new SlashCommandBuilder()
      .setName("snipe")
      .setDescription("Snipe a Roblox player and find their server")
      .addStringOption(option =>
        option
          .setName("target")
          .setDescription("Roblox username of the player you want to snipe")
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName("game")
          .setDescription("Game ID / Place ID to search in")
          .setRequired(true)
      )
      .toJSON()
  ];

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
  try {
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    console.log("✅ Slash commands registered (including /snipe)");
  } catch (error) {
    console.error("❌ Failed to register commands:", error);
  }
});

// ==================== ROBLOX FUNCTIONS (existing ones stay here) ====================
// ... your getUserId, getOutfits, getCurrentAvatarThumbnail, getOutfitThumbnail functions ...

// ==================== COMMAND HANDLER ====================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // ==================== EXISTING ROBLOX AVATARHISTORY ====================
  if (interaction.commandName === "roblox" && interaction.options.getSubcommand() === "avatarhistory") {
    // ... your existing avatarhistory code (unchanged) ...
  }

  // ==================== NEW SNIPE COMMAND ====================
  else if (interaction.commandName === "snipe") {
    const target = interaction.options.getString("target");
    const game = interaction.options.getString("game");

    await interaction.deferReply({ ephemeral: false }); // Change to true if you want private snipes by default

    try {
      // Basic validation
      if (!target || !game) {
        return interaction.editReply("❌ Please provide both `target` (username) and `game` (game ID).");
      }

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle("🔍 Snipe Started")
        .setDescription(`Searching for **${target}** in game **${game}**...\n\nThis may take a few seconds to a few minutes.`)
        .setFooter({ text: "Scanning servers..." })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      // TODO: Add your actual sniping logic here
      // Example structure:
      // 1. Get userId from username
      // 2. Scan servers for that game (using Roblox APIs like game servers list, presence, etc.)
      // 3. Show progress updates if possible (edit the reply multiple times)
      // 4. If found → show server info + "Join" button with the server link

      // Placeholder result for now
      await new Promise(r => setTimeout(r, 3000)); // Simulate delay

      const resultEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle("❌ No player found")
        .setDescription(`Could not find **${target}** in game **${game}**.\n\nMake sure they are online and playing that game.`)
        .setTimestamp();

      await interaction.editReply({ embeds: [resultEmbed] });

    } catch (error) {
      console.error("Snipe command error:", error);
      await interaction.editReply("❌ Something went wrong while sniping.").catch(() => {});
    }
  }
});

client.login(process.env.TOKEN).catch(err => console.error("Login failed:", err));
