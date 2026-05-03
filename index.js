process.on("uncaughtException", console.error);
process.on("unhandledRejection", console.error);

const express = require("express");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { exec } = require("child_process");

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
  ActionRowBuilder,
  EmbedBuilder,
  AttachmentBuilder
} = require("discord.js");

// ---------------- WEB ----------------
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => res.send("Cálido running"));
app.listen(PORT, "0.0.0.0");

// ---------------- BOT ----------------
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

// cache file per user
const fileCache = new Map();

// ---------------- COMMAND ----------------
const commands = [
  new SlashCommandBuilder()
    .setName("audio")
    .setDescription("Advanced audio tools")
    .addSubcommand(sub =>
      sub
        .setName("edit")
        .setDescription("Edit audio with advanced controls")
        .addAttachmentOption(opt =>
          opt
            .setName("file")
            .setDescription("Upload your audio")
            .setRequired(true)
        )
    )
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
})();

// ---------------- READY ----------------
client.once("ready", () => {
  console.log(`Cálido online as ${client.user.tag}`);
});

// ---------------- HANDLER ----------------
client.on(Events.InteractionCreate, async interaction => {

  // ===== OPEN MODAL =====
  if (
    interaction.isChatInputCommand() &&
    interaction.commandName === "audio" &&
    interaction.options.getSubcommand() === "edit"
  ) {
    const file = interaction.options.getAttachment("file");

    if (!file.contentType || !file.contentType.startsWith("audio")) {
      return interaction.reply({ content: "Upload a valid audio file." });
    }

    fileCache.set(interaction.user.id, file.url);

    const modal = new ModalBuilder()
      .setCustomId("audioEditModal")
      .setTitle("Audio Mastering");

    const volume = new TextInputBuilder()
      .setCustomId("volume")
      .setLabel("Volume (default 1.0)")
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    const bass = new TextInputBuilder()
      .setCustomId("bass")
      .setLabel("Bass boost (0-15)")
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    const treble = new TextInputBuilder()
      .setCustomId("treble")
      .setLabel("Treble boost (0-10)")
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder().addComponents(volume),
      new ActionRowBuilder().addComponents(bass),
      new ActionRowBuilder().addComponents(treble)
    );

    return interaction.showModal(modal);
  }

  // ===== PROCESS AUDIO =====
  if (interaction.isModalSubmit() && interaction.customId === "audioEditModal") {
    await interaction.deferReply();

    const fileUrl = fileCache.get(interaction.user.id);
    if (!fileUrl) {
      return interaction.editReply("File expired. Run command again.");
    }

    fileCache.delete(interaction.user.id);

    const volume = interaction.fields.getTextInputValue("volume") || "1.0";
    const bass = interaction.fields.getTextInputValue("bass") || "6";
    const treble = interaction.fields.getTextInputValue("treble") || "4";

    try {
      const originalName =
        fileUrl.split("/").pop().split("?")[0] || "audio.mp3";

      const inputPath = path.join(__dirname, "input_" + originalName);
      const outputPath = path.join(__dirname, originalName);

      // DOWNLOAD
      const response = await axios({
        url: fileUrl,
        method: "GET",
        responseType: "stream"
      });

      const writer = fs.createWriteStream(inputPath);
      response.data.pipe(writer);

      await new Promise((res, rej) => {
        writer.on("finish", res);
        writer.on("error", rej);
      });

      // 🔥 ADVANCED AUDIO CHAIN
      const filter = `
        highpass=f=30,
        lowpass=f=18000,
        bass=g=${bass},
        equalizer=f=120:width_type=o:width=2:g=3,
        equalizer=f=300:width_type=o:width=2:g=-3,
        equalizer=f=3000:width_type=o:width=2:g=2,
        treble=g=${treble},
        acompressor=threshold=-18dB:ratio=3:attack=20:release=200,
        alimiter=limit=0.9,
        volume=${volume}
      `.replace(/\s+/g, "");

      const command = `ffmpeg -i "${inputPath}" -af "${filter}" -preset ultrafast -threads 2 -b:a 192k "${outputPath}" -y`;

      exec(command, async (err) => {
        if (err) {
          console.error(err);
          return interaction.editReply("Error processing audio.");
        }

        const embed = new EmbedBuilder()
          .setColor(0x2b2d31)
          .setTitle("Audio Mastered")
          .setDescription(
            `Volume: ${volume}\nBass: ${bass}\nTreble: ${treble}`
          );

        await interaction.editReply({
          embeds: [embed],
          files: [new AttachmentBuilder(outputPath)]
        });

        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);
      });

    } catch (err) {
      console.error(err);
      interaction.editReply("Failed to process audio.");
    }
  }
});

// ---------------- START ----------------
client.login(TOKEN);
