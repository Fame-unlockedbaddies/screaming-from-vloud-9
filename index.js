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

// store file temporarily per user
const fileCache = new Map();

// ---------------- COMMAND ----------------
const commands = [
  new SlashCommandBuilder()
    .setName("audio")
    .setDescription("Advanced audio tools")
    .addSubcommand(sub =>
      sub
        .setName("edit")
        .setDescription("Edit audio with settings")
        .addAttachmentOption(opt =>
          opt
            .setName("file")
            .setDescription("Upload your audio first")
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

  // ===== STEP 1: COMMAND =====
  if (
    interaction.isChatInputCommand() &&
    interaction.commandName === "audio" &&
    interaction.options.getSubcommand() === "edit"
  ) {
    const file = interaction.options.getAttachment("file");

    if (!file.contentType || !file.contentType.startsWith("audio")) {
      return interaction.reply({ content: "Upload a valid audio file." });
    }

    // store file for modal step
    fileCache.set(interaction.user.id, file.url);

    const modal = new ModalBuilder()
      .setCustomId("audioEditModal")
      .setTitle("Audio Settings");

    const volume = new TextInputBuilder()
      .setCustomId("volume")
      .setLabel("Volume (default 1.0)")
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    const pitch = new TextInputBuilder()
      .setCustomId("pitch")
      .setLabel("Pitch (default 1.0)")
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    const bass = new TextInputBuilder()
      .setCustomId("bass")
      .setLabel("Bass (default 0)")
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    const treble = new TextInputBuilder()
      .setCustomId("treble")
      .setLabel("Treble (default 0)")
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder().addComponents(volume),
      new ActionRowBuilder().addComponents(pitch),
      new ActionRowBuilder().addComponents(bass),
      new ActionRowBuilder().addComponents(treble)
    );

    return interaction.showModal(modal);
  }

  // ===== STEP 2: MODAL =====
  if (interaction.isModalSubmit() && interaction.customId === "audioEditModal") {
    await interaction.deferReply();

    const fileUrl = fileCache.get(interaction.user.id);

    if (!fileUrl) {
      return interaction.editReply("File expired. Run the command again.");
    }

    fileCache.delete(interaction.user.id);

    // defaults if empty
    const volume = interaction.fields.getTextInputValue("volume") || "1.0";
    const pitch = interaction.fields.getTextInputValue("pitch") || "1.0";
    const bass = interaction.fields.getTextInputValue("bass") || "0";
    const treble = interaction.fields.getTextInputValue("treble") || "0";

    try {
      const originalName = fileUrl.split("/").pop().split("?")[0] || "audio.mp3";

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

      // FILTER
      const filter = `
        volume=${volume},
        asetrate=44100*${pitch},
        bass=g=${bass},
        treble=g=${treble}
      `.replace(/\s+/g, "");

      const command = `ffmpeg -i "${inputPath}" -af "${filter}" "${outputPath}" -y`;

      exec(command, async (err) => {
        if (err) {
          console.error(err);
          return interaction.editReply("Error processing audio.");
        }

        const embed = new EmbedBuilder()
          .setColor(0x2b2d31)
          .setTitle("Audio Edited")
          .setDescription(
            `Volume: ${volume}\nPitch: ${pitch}\nBass: ${bass}\nTreble: ${treble}`
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
      interaction.editReply("Failed to process file.");
    }
  }
});

// ---------------- START ----------------
client.login(TOKEN);
