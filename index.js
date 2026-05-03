process.on("uncaughtException", console.error);
process.on("unhandledRejection", console.error);

const express = require("express");

// 🔥 START SERVER FIRST (IMPORTANT)
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Cálido is alive 🔥");
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Web server running on port ${PORT}`);
});

// ---------------- DISCORD ----------------
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
    .setDMPermission(true)
    .addSubcommand(sub =>
      sub.setName("audio").setDescription("Generate music")
    )
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  try {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log("✅ Commands registered");
  } catch (err) {
    console.error("Command error:", err);
  }
})();

// ---------------- READY ----------------
client.once("ready", () => {
  console.log(`🔥 Cálido online as ${client.user.tag}`);
});

// ---------------- HANDLER ----------------
client.on(Events.InteractionCreate, async (interaction) => {

  if (interaction.isChatInputCommand()) {
    if (
      interaction.commandName === "make" &&
      interaction.options.getSubcommand() === "audio"
    ) {
      const modal = new ModalBuilder()
        .setCustomId("audioModal")
        .setTitle("🎵 Create a Song");

      const songName = new TextInputBuilder()
        .setCustomId("songName")
        .setLabel("Song Name")
        .setStyle(TextInputStyle.Short);

      const genre = new TextInputBuilder()
        .setCustomId("genre")
        .setLabel("Genre")
        .setStyle(TextInputStyle.Short);

      modal.addComponents(
        new ActionRowBuilder().addComponents(songName),
        new ActionRowBuilder().addComponents(genre)
      );

      return interaction.showModal(modal);
    }
  }

  if (interaction.isModalSubmit()) {
    if (interaction.customId === "audioModal") {
      const name = interaction.fields.getTextInputValue("songName");
      const genre = interaction.fields.getTextInputValue("genre");

      await interaction.reply(
        `🎧 Generating **${name}** (${genre})...`
      );

      setTimeout(() => {
        interaction.followUp(
          `🔥 Done!\n🎵 **${name}** (${genre})\n🔊 https://example.com/audio.mp3`
        );
      }, 4000);
    }
  }
});

client.login(TOKEN);
