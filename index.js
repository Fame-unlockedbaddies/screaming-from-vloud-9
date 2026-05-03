process.on("uncaughtException", console.error);
process.on("unhandledRejection", console.error);

const {
  Client,
  GatewayIntentBits,
  Events,
  REST,
  Routes,
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder
} = require("discord.js");

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// ---------------- COMMAND ----------------
const commands = [
  new SlashCommandBuilder()
    .setName("make")
    .setDescription("Create things")
    .addSubcommand(sub =>
      sub
        .setName("audio")
        .setDescription("Generate music")
    )
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
  console.log("Commands registered");
})();

// ---------------- READY ----------------
client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// ---------------- HANDLER ----------------
client.on(Events.InteractionCreate, async (interaction) => {

  // ===== OPEN MODAL =====
  if (interaction.isChatInputCommand()) {
    if (
      interaction.commandName === "make" &&
      interaction.options.getSubcommand() === "audio"
    ) {
      const modal = new ModalBuilder()
        .setCustomId("audioModal")
        .setTitle("Create a Song");

      const songName = new TextInputBuilder()
        .setCustomId("songName")
        .setLabel("Song Name")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const genre = new TextInputBuilder()
        .setCustomId("genre")
        .setLabel("Genre (phonk, pop, rock...)")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(songName),
        new ActionRowBuilder().addComponents(genre)
      );

      return interaction.showModal(modal);
    }
  }

  // ===== HANDLE FORM =====
  if (interaction.isModalSubmit()) {
    if (interaction.customId === "audioModal") {
      const name = interaction.fields.getTextInputValue("songName");
      const genre = interaction.fields.getTextInputValue("genre");

      // 🔥 For now: fake generation
      await interaction.reply({
        content:
          `🎵 **Generating your song...**\n\n` +
          `**Title:** ${name}\n` +
          `**Genre:** ${genre}\n\n` +
          `⏳ Please wait...`
      });

      // Simulate delay
      setTimeout(async () => {
        await interaction.followUp({
          content:
            `✅ **Your song is ready!**\n\n` +
            `**${name}** (${genre})\n` +
            `🔊 [Download Song](https://example.com/fake-audio.mp3)`
        });
      }, 5000);
    }
  }
});

client.login(TOKEN);
